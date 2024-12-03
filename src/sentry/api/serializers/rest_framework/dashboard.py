import re
from collections.abc import Sequence
from datetime import datetime, timedelta
from enum import Enum
from typing import TypedDict

from django.db.models import Max
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field, extend_schema_serializer
from rest_framework import serializers

from sentry import features, options
from sentry.api.issue_search import parse_search_query
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.api.serializers.rest_framework.base import convert_dict_key_case, snake_to_camel_case
from sentry.constants import ALL_ACCESS_PROJECTS
from sentry.discover.arithmetic import ArithmeticError, categorize_columns
from sentry.exceptions import InvalidSearchQuery
from sentry.models.dashboard import Dashboard
from sentry.models.dashboard_permissions import DashboardPermissions
from sentry.models.dashboard_widget import (
    DashboardWidget,
    DashboardWidgetDisplayTypes,
    DashboardWidgetQuery,
    DashboardWidgetQueryOnDemand,
    DashboardWidgetTypes,
    DatasetSourcesTypes,
)
from sentry.models.organization import Organization
from sentry.models.team import Team
from sentry.relay.config.metric_extraction import get_current_widget_specs, widget_exceeds_max_specs
from sentry.search.events.builder.discover import UnresolvedQuery
from sentry.search.events.fields import is_function
from sentry.search.events.types import ParamsType, QueryBuilderConfig
from sentry.snuba.dataset import Dataset
from sentry.tasks.on_demand_metrics import (
    _get_widget_on_demand_specs,
    check_field_cardinality,
    set_or_create_on_demand_state,
)
from sentry.tasks.relay import schedule_invalidate_project_config
from sentry.users.models.user import User
from sentry.utils.dates import parse_stats_period
from sentry.utils.strings import oxfordize_list

AGGREGATE_PATTERN = r"^(\w+)\((.*)?\)$"
AGGREGATE_BASE = r".*(\w+)\((.*)?\)"
EQUATION_PREFIX = "equation|"

OnDemandExtractionState = DashboardWidgetQueryOnDemand.OnDemandExtractionState
DATASET_SOURCE_MAP = {source[1]: source[0] for source in DatasetSourcesTypes.as_choices()}


class QueryWarning(TypedDict):
    queries: list[str | None]
    columns: dict[str, str]


def is_equation(field: str) -> bool:
    """check if a public alias is an equation, which start with the equation prefix
    eg. `equation|5 + 5`
    """
    return field.startswith(EQUATION_PREFIX)


def is_aggregate(field: str) -> bool:
    field_match = re.match(AGGREGATE_PATTERN, field)
    if field_match:
        return True

    equation_match = re.match(AGGREGATE_BASE, field)
    if equation_match and is_equation(field):
        return True

    return False


def get_next_dashboard_order(dashboard_id):
    max_order = DashboardWidget.objects.filter(dashboard_id=dashboard_id).aggregate(Max("order"))[
        "order__max"
    ]

    return max_order + 1 if max_order else 1


def get_next_query_order(widget_id):
    max_order = DashboardWidgetQuery.objects.filter(widget_id=widget_id).aggregate(Max("order"))[
        "order__max"
    ]

    return max_order + 1 if max_order else 1


def validate_id(self, value):
    try:
        return int(value)
    except ValueError:
        raise serializers.ValidationError("Invalid ID format. Must be a numeric string")


def is_table_display_type(display_type):
    return (
        display_type
        == DashboardWidgetDisplayTypes.as_text_choices()[DashboardWidgetDisplayTypes.TABLE][0]
    )


@extend_schema_field(field=OpenApiTypes.OBJECT)
class LayoutField(serializers.Field):
    REQUIRED_KEYS = {
        "x",
        "y",
        "w",
        "h",
        "min_h",
    }

    def to_internal_value(self, data):
        if data is None:
            return None

        missing_keys = self.REQUIRED_KEYS - set(data.keys())
        if missing_keys:
            missing_key_str = ", ".join(sorted(snake_to_camel_case(key) for key in missing_keys))
            raise serializers.ValidationError(f"Missing required keys: {missing_key_str}")

        layout_to_store = {}
        for key in self.REQUIRED_KEYS:
            value = data.get(key)
            if value is None:
                continue

            if not isinstance(value, int):
                raise serializers.ValidationError(f"Expected number for: {key}")
            layout_to_store[key] = value

        # Store the layout with camel case dict keys because they'll be
        # served as camel case in outgoing responses anyways
        return convert_dict_key_case(layout_to_store, snake_to_camel_case)


class DashboardWidgetQueryOnDemandSerializer(CamelSnakeSerializer[Dashboard]):
    extraction_state = serializers.CharField(required=False)
    enabled = serializers.BooleanField(required=False)

    def validate(self, data):
        return data


class DashboardWidgetQuerySerializer(CamelSnakeSerializer[Dashboard]):
    # Is a string because output serializers also make it a string.
    id = serializers.CharField(required=False)
    fields = serializers.ListField(child=serializers.CharField(), required=False)  # type: ignore[assignment]  # XXX: clobbering Serializer.fields
    aggregates = serializers.ListField(
        child=serializers.CharField(), required=False, allow_null=True
    )
    columns = serializers.ListField(child=serializers.CharField(), required=False, allow_null=True)
    field_aliases = serializers.ListField(
        child=serializers.CharField(allow_blank=True), required=False, allow_null=True
    )
    name = serializers.CharField(required=False, allow_blank=True)
    conditions = serializers.CharField(required=False, allow_blank=True)
    orderby = serializers.CharField(required=False, allow_blank=True)

    is_hidden = serializers.BooleanField(required=False)

    on_demand_extraction = DashboardWidgetQueryOnDemandSerializer(many=False, required=False)
    on_demand_extraction_disabled = serializers.BooleanField(required=False)

    selected_aggregate = serializers.IntegerField(required=False, allow_null=True)

    required_for_create = {"fields", "conditions"}

    validate_id = validate_id

    def get_metrics_features(
        self, organization: Organization | None, user: User | None
    ) -> dict[str, bool | None]:
        if organization is None or user is None:
            return {}

        feature_names = [
            "organizations:mep-rollout-flag",
            "organizations:dynamic-sampling",
            "organizations:performance-use-metrics",
            "organizations:dashboards-mep",
        ]
        batch_features = features.batch_has(
            feature_names,
            organization=organization,
            actor=user,
        )

        return (
            batch_features.get(f"organization:{organization.id}", {})
            if batch_features is not None
            else {
                feature_name: features.has(feature_name, organization=organization, actor=user)
                for feature_name in feature_names
            }
        )

    def validate(self, data):
        if not data.get("id"):
            keys = set(data.keys())
            if self.required_for_create - keys:
                raise serializers.ValidationError(
                    {
                        "fields": "fields are required during creation.",
                        "conditions": "conditions are required during creation.",
                    }
                )

        # Validate the query that would be created when run.
        conditions = self._get_attr(data, "conditions", "")
        orderby = self._get_attr(data, "orderby", "")
        is_table = is_table_display_type(self.context.get("display_type"))
        columns = self._get_attr(data, "columns", []).copy()
        aggregates = self._get_attr(data, "aggregates", []).copy()
        fields = columns + aggregates

        # Handle the orderby since it can be a value that's not included in fields
        # e.g. a custom equation, or a function that isn't plotted as a y-axis
        injected_orderby_equation, orderby_prefix = None, None
        stripped_orderby = orderby.lstrip("-")
        if is_equation(stripped_orderby):
            # The orderby is a custom equation and needs to be added to fields
            injected_orderby_equation = stripped_orderby
            fields.append(injected_orderby_equation)
            orderby_prefix = "-" if orderby.startswith("-") else ""
        elif is_function(stripped_orderby) and stripped_orderby not in fields:
            fields.append(stripped_orderby)

        equations, fields = categorize_columns(fields)

        if injected_orderby_equation is not None and orderby_prefix is not None:
            # Subtract one because the equation is injected to fields
            orderby = f"{orderby_prefix}equation[{len(equations) - 1}]"

        params: ParamsType = {
            "start": datetime.now() - timedelta(days=1),
            "end": datetime.now(),
            "project_id": [p.id for p in self.context["projects"]],
            "organization_id": self.context["organization"].id,
            "environment": self.context.get("environment", []),
        }

        try:
            parse_search_query(conditions, params=params)
        except InvalidSearchQuery as err:
            # We don't know if the widget that this query belongs to is an
            # Issue widget or Discover widget. Pass the error back to the
            # Widget serializer to decide if whether or not to raise this
            # error based on the Widget's type
            data["issue_query_error"] = {"conditions": [f"Invalid conditions: {err}"]}

        try:
            batch_features = self.get_metrics_features(
                self.context.get("organization"), self.context.get("user")
            )
            use_metrics = bool(
                (
                    batch_features.get("organizations:mep-rollout-flag", False)
                    and batch_features.get("organizations:dynamic-sampling", False)
                )
                or batch_features.get("organizations:performance-use-metrics", False)
                or batch_features.get("organizations:dashboards-mep", False)
            )
            # When using the eps/epm functions, they require an interval argument
            # or to provide the start/end so that the interval can be computed.
            # This uses a hard coded start/end to ensure the validation succeeds
            # since the values themselves don't matter.
            builder = UnresolvedQuery(
                dataset=Dataset.Discover,
                params=params,
                config=QueryBuilderConfig(
                    equation_config={
                        "auto_add": bool(not is_table or injected_orderby_equation),
                        "aggregates_only": not is_table,
                    },
                    use_aggregate_conditions=True,
                    has_metrics=use_metrics,
                ),
            )

            builder.resolve_time_conditions()
            builder.resolve_conditions(conditions)
            # We need to resolve params to set time range params here since some
            # field aliases might those params to be resolved (total.count)
            builder.where = builder.resolve_params()
        except InvalidSearchQuery as err:
            data["discover_query_error"] = {"conditions": [f"Invalid conditions: {err}"]}
            return data

        # TODO(dam): Add validation for metrics fields/queries
        try:
            builder.columns = builder.resolve_select(fields, equations)
        except (InvalidSearchQuery, ArithmeticError) as err:
            # We don't know if the widget that this query belongs to is an
            # Issue widget or Discover widget. Pass the error back to the
            # Widget serializer to decide if whether or not to raise this
            # error based on the Widget's type
            data["discover_query_error"] = {"fields": f"Invalid fields: {err}"}

        try:
            builder.resolve_orderby(orderby)
        except InvalidSearchQuery as err:
            data["discover_query_error"] = {"orderby": f"Invalid orderby: {err}"}

        return data

    def _get_attr(self, data, attr, empty_value=None):
        value = data.get(attr)
        if value is not None:
            return value
        if self.instance:
            return getattr(self.instance, attr)
        return empty_value


class ThresholdMaxKeys(Enum):
    MAX_1 = "max1"
    MAX_2 = "max2"


@extend_schema_serializer(exclude_fields=["dataset_source"])
class DashboardWidgetSerializer(CamelSnakeSerializer[Dashboard]):
    # Is a string because output serializers also make it a string.
    id = serializers.CharField(required=False)
    title = serializers.CharField(required=False, allow_blank=True, max_length=255)
    description = serializers.CharField(
        required=False, max_length=255, allow_null=True, allow_blank=True
    )
    thresholds = serializers.JSONField(required=False, allow_null=True)
    display_type = serializers.ChoiceField(
        choices=DashboardWidgetDisplayTypes.as_text_choices(), required=False
    )
    interval = serializers.CharField(required=False, max_length=10)
    queries = DashboardWidgetQuerySerializer(many=True, required=False)
    widget_type = serializers.ChoiceField(
        choices=DashboardWidgetTypes.as_text_choices(), required=False
    )
    limit = serializers.IntegerField(min_value=1, max_value=10, required=False, allow_null=True)
    layout = LayoutField(required=False, allow_null=True)
    query_warnings: QueryWarning = {"queries": [], "columns": {}}
    dataset_source = serializers.ChoiceField(
        choices=DatasetSourcesTypes.as_text_choices(),
        required=False,
        help_text="A widgets's unique id.",
    )

    def validate_display_type(self, display_type):
        return DashboardWidgetDisplayTypes.get_id_for_type_name(display_type)

    def validate_widget_type(self, widget_type):
        return DashboardWidgetTypes.get_id_for_type_name(widget_type)

    validate_id = validate_id

    def validate_interval(self, interval):
        if parse_stats_period(interval) is None:
            raise serializers.ValidationError("Invalid interval")
        return interval

    def to_internal_value(self, data):
        # Update the context for the queries serializer because the display type is
        # required for validation of the queries
        queries_serializer = self.fields["queries"]
        additional_context = {}

        if data.get("display_type"):
            additional_context["display_type"] = data.get("display_type")
        if self.context.get("request") and self.context["request"].user:
            additional_context["user"] = self.context["request"].user

        queries_serializer.context.update(additional_context)
        return super().to_internal_value(data)

    def validate(self, data):
        query_errors = []
        all_columns: set[str] = set()
        has_query_error = False
        self.query_warnings = {"queries": [], "columns": {}}
        max_cardinality_allowed = options.get("on_demand.max_widget_cardinality.on_query_count")
        current_widget_specs = None
        organization = self.context["organization"]

        ondemand_feature = features.has(
            "organizations:on-demand-metrics-extraction-widgets", organization
        )

        if data.get("queries"):
            # Check each query to see if they have an issue or discover error depending on the type of the widget
            for query in data.get("queries"):
                if (
                    data.get("widget_type") == DashboardWidgetTypes.ISSUE
                    and "issue_query_error" in query
                ):
                    query_errors.append(query["issue_query_error"])
                    has_query_error = True
                elif (
                    "widget_type" not in data
                    or data.get("widget_type") == DashboardWidgetTypes.DISCOVER
                ) and "discover_query_error" in query:
                    query_errors.append(query["discover_query_error"])
                    has_query_error = True
                else:
                    query_errors.append({})

                if (
                    ondemand_feature
                    and data.get("widget_type")
                    in [DashboardWidgetTypes.DISCOVER, DashboardWidgetTypes.TRANSACTION_LIKE]
                    and not query.get("on_demand_extraction_disabled", False)
                ):
                    if query.get("columns"):
                        all_columns = all_columns.union(query.get("columns"))
                    # If this query wants ondemand check if we'll go over spec
                    widget_query = DashboardWidgetQuery(
                        fields=query["fields"],
                        aggregates=query.get("aggregates"),
                        columns=query.get("columns"),
                        field_aliases=query.get("field_aliases"),
                        conditions=query["conditions"],
                        name=query.get("name", ""),
                        orderby=query.get("orderby", ""),
                    )
                    # Get widget specs if we haven't yet

                    if current_widget_specs is None:
                        current_widget_specs = get_current_widget_specs(organization)
                    widget_specs = _get_widget_on_demand_specs(widget_query, organization)
                    if len(widget_specs) == 0:
                        # Disabled since there are no applicable widgets
                        self.query_warnings["queries"].append(
                            OnDemandExtractionState.DISABLED_NOT_APPLICABLE
                        )
                    elif widget_exceeds_max_specs(widget_specs, current_widget_specs, organization):
                        self.query_warnings["queries"].append(
                            OnDemandExtractionState.DISABLED_SPEC_LIMIT
                        )
                    else:
                        self.query_warnings["queries"].append(None)
                else:
                    self.query_warnings["queries"].append(None)
        if has_query_error:
            raise serializers.ValidationError({"queries": query_errors})
        if not data.get("id"):
            if not data.get("queries"):
                raise serializers.ValidationError(
                    {"queries": "One or more queries are required to create a widget"}
                )
            if not data.get("title"):
                if not data.get("widget_type") == DashboardWidgetTypes.METRICS:
                    raise serializers.ValidationError(
                        {"title": "Title is required during creation."}
                    )
            if data.get("display_type") is None:
                raise serializers.ValidationError(
                    {"displayType": "displayType is required during creation."}
                )

        # Validate widget thresholds
        thresholds = data.get("thresholds")
        if thresholds:
            max_values = thresholds.get("max_values")
            allowed_max_keys = [key.value for key in ThresholdMaxKeys]
            if max_values:
                for i in range(len(max_values)):
                    max_key = f"max{i+1}"

                    if max_key not in allowed_max_keys:
                        raise serializers.ValidationError(
                            {"thresholds": f"Invalid maximum key {max_key}"}
                        )

                    if max_values.get(max_key):
                        if max_values.get(max_key) < 0:
                            raise serializers.ValidationError(
                                {"thresholds": {max_key: "Maximum values can not be negative"}}
                            )
                        elif i > 0:
                            prev_max_key = f"max{i}"
                            if max_values.get(prev_max_key) and max_values.get(
                                prev_max_key
                            ) >= max_values.get(max_key):
                                raise serializers.ValidationError(
                                    {
                                        "thresholds": {
                                            max_key: "Maximum value must be greater than minimum."
                                        }
                                    }
                                )

                if len(max_values) < len(ThresholdMaxKeys):
                    for key in allowed_max_keys:
                        if max_values.get(key) is None:
                            raise serializers.ValidationError(
                                {
                                    "thresholds": {
                                        key: "Must set all threshold maximums or none at all."
                                    }
                                }
                            )
        if len(all_columns) > 0:
            field_cardinality = check_field_cardinality(
                list(all_columns), self.context["organization"], max_cardinality_allowed
            )
            for field, low_cardinality in field_cardinality.items():
                if not low_cardinality:
                    self.query_warnings["columns"][
                        field
                    ] = OnDemandExtractionState.DISABLED_HIGH_CARDINALITY

        widget_type = data.get("widget_type")
        if widget_type and widget_type in {
            DashboardWidgetTypes.ERROR_EVENTS,
            DashboardWidgetTypes.TRANSACTION_LIKE,
        }:
            data["discover_widget_split"] = widget_type

        dataset_source = data.get("dataset_source")
        if dataset_source is not None:
            data["dataset_source"] = DATASET_SOURCE_MAP[dataset_source]

        return data


class DashboardPermissionsSerializer(CamelSnakeSerializer[Dashboard]):
    is_editable_by_everyone = serializers.BooleanField(
        help_text="Whether the dashboard is editable by everyone.",
    )
    teams_with_edit_access = serializers.ListField(
        child=serializers.IntegerField(),
        help_text="List of team IDs that have edit access to a dashboard.",
        required=False,
        default=[],
    )

    def validate(self, data):
        if "teams_with_edit_access" in data:
            team_ids = data["teams_with_edit_access"]
            existing_team_ids = set(
                Team.objects.filter(
                    id__in=team_ids, organization=self.context["organization"]
                ).values_list("id", flat=True)
            )
            invalid_team_ids = set(team_ids) - existing_team_ids
            if invalid_team_ids:
                invalid_team_ids_str = [str(id) for id in invalid_team_ids]
                raise serializers.ValidationError(
                    f"Cannot update dashboard edit permissions. Teams with IDs {oxfordize_list(invalid_team_ids_str)} do not exist."
                )
        return data


class DashboardDetailsSerializer(CamelSnakeSerializer[Dashboard]):
    # Is a string because output serializers also make it a string.
    id = serializers.CharField(required=False, help_text="A dashboard's unique id.")
    title = serializers.CharField(
        required=False, max_length=255, help_text="The user-defined dashboard title."
    )
    widgets = DashboardWidgetSerializer(
        many=True, required=False, help_text="A json list of widgets saved in this dashboard."
    )
    projects = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        help_text="The saved projects filter for this dashboard.",
    )
    environment = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        allow_null=True,
        help_text="The saved environment filter for this dashboard.",
    )
    period = serializers.CharField(
        required=False, allow_null=True, help_text="The saved time range period for this dashboard."
    )
    start = serializers.DateTimeField(
        required=False, allow_null=True, help_text="The saved start time for this dashboard."
    )
    end = serializers.DateTimeField(
        required=False, allow_null=True, help_text="The saved end time for this dashboard."
    )
    filters = serializers.DictField(
        required=False, help_text="The saved filters for this dashboard."
    )
    utc = serializers.BooleanField(
        required=False,
        help_text="Setting that lets you display saved time range for this dashboard in UTC.",
    )
    validate_id = validate_id
    permissions = DashboardPermissionsSerializer(
        required=False,
        allow_null=True,
        help_text="Permissions that restrict users from editing dashboards",
    )

    def validate_projects(self, projects):
        from sentry.api.validators import validate_project_ids

        return validate_project_ids(projects, {project.id for project in self.context["projects"]})

    def validate(self, data):
        start = data.get("start")
        end = data.get("end")

        if start and end and start >= end:
            raise serializers.ValidationError("start must be before end")

        if len(data.get("widgets", [])) > Dashboard.MAX_WIDGETS:
            raise serializers.ValidationError(
                f"Number of widgets must be less than {Dashboard.MAX_WIDGETS}"
            )

        if features.has(
            "organizations:dashboards-edit-access",
            self.context["organization"],
            actor=self.context["request"].user,
        ):
            permissions = data.get("permissions")
            if permissions and self.instance:
                currentUser = self.context["request"].user
                # managers and owners
                has_write_access = self.context["request"].access.has_scope("org:write")
                if self.instance.created_by_id != currentUser.id and not has_write_access:
                    raise serializers.ValidationError(
                        "Only the Dashboard Creator may modify Dashboard Edit Access"
                    )

        return data

    def update_dashboard_filters(self, instance, validated_data):
        page_filter_keys = ["environment", "period", "start", "end", "utc"]
        dashboard_filter_keys = ["release", "release_id"]

        filters = {}

        if "projects" in validated_data:
            if validated_data["projects"] == ALL_ACCESS_PROJECTS:
                filters["all_projects"] = True
                instance.projects.clear()
            else:
                if instance.filters and instance.filters.get("all_projects"):
                    filters["all_projects"] = False
                instance.projects.set(validated_data["projects"])

        for key in page_filter_keys:
            if key in validated_data:
                filters[key] = validated_data[key]

        for key in dashboard_filter_keys:
            if "filters" in validated_data and key in validated_data["filters"]:
                filters[key] = validated_data["filters"][key]

        if filters:
            instance.filters = filters
            instance.save()

    def update_permissions(self, instance, validated_data):
        if "permissions" in validated_data and validated_data["permissions"] is not None:
            permissions_data = validated_data["permissions"]
            permissions = DashboardPermissions.objects.update_or_create(
                dashboard=instance,
                defaults={
                    "is_editable_by_everyone": permissions_data["is_editable_by_everyone"],
                },
            )[0]
            if "teams_with_edit_access" in permissions_data:
                teams_data = permissions_data["teams_with_edit_access"]
                if teams_data == [] or permissions_data["is_editable_by_everyone"] is True:
                    permissions.teams_with_edit_access.clear()
                else:
                    permissions.teams_with_edit_access.set(
                        Team.objects.filter(
                            id__in=teams_data, organization=self.context["organization"]
                        )
                    )

            instance.permissions = permissions

    def create(self, validated_data):
        """
        Create a dashboard, and create any widgets and their queries

        Only call save() on this serializer from within a transaction or
        bad things will happen
        """
        self.instance = Dashboard.objects.create(
            organization=self.context["organization"],
            title=validated_data["title"],
            created_by_id=self.context["request"].user.id,
        )

        assert self.instance is not None

        if "widgets" in validated_data:
            self.update_widgets(self.instance, validated_data["widgets"])

        self.update_dashboard_filters(self.instance, validated_data)

        if features.has(
            "organizations:dashboards-edit-access",
            self.context["organization"],
            actor=self.context["request"].user,
        ):
            self.update_permissions(self.instance, validated_data)

        schedule_update_project_configs(self.instance)

        return self.instance

    def update(self, instance, validated_data):
        """
        Update a dashboard, the connected widgets and queries

        - Widgets in the dashboard currently, but not in validated_data will be removed.
        - Widgets without ids will be created.
        - Widgets with matching IDs will be updated.
        - The order of the widgets will be updated based on the order in the request data.

        Only call save() on this serializer from within a transaction or
        bad things will happen
        """
        instance.title = validated_data.get("title", instance.title)
        instance.save()

        if "widgets" in validated_data:
            self.update_widgets(instance, validated_data["widgets"])

        self.update_dashboard_filters(instance, validated_data)

        if features.has(
            "organizations:dashboards-edit-access",
            self.context["organization"],
            actor=self.context["request"].user,
        ):
            self.update_permissions(instance, validated_data)

        schedule_update_project_configs(instance)

        return instance

    def update_widgets(self, instance, widget_data):
        widget_ids = [widget["id"] for widget in widget_data if "id" in widget]

        existing_widgets = DashboardWidget.objects.filter(dashboard=instance, id__in=widget_ids)
        existing_map = {widget.id: widget for widget in existing_widgets}

        # Remove widgets that are not in the current request.
        self.remove_missing_widgets(instance.id, widget_ids)

        # Get new ordering start point to avoid constraint errors
        next_order = get_next_dashboard_order(instance.id)

        for i, data in enumerate(widget_data):
            widget_id = data.get("id")
            if widget_id and widget_id in existing_map:
                # Update existing widget.
                self.update_widget(existing_map[widget_id], data, next_order + i)
            elif not widget_id:
                # Create a new widget.
                self.create_widget(instance, data, next_order + i)
            else:
                raise serializers.ValidationError(
                    "You cannot update widgets that are not part of this dashboard."
                )

    def remove_missing_widgets(self, dashboard_id, keep_ids):
        """
        Removes current widgets belonging to dashboard not in keep_ids.
        """
        DashboardWidget.objects.filter(dashboard_id=dashboard_id).exclude(id__in=keep_ids).delete()

    def create_widget(self, dashboard, widget_data, order):
        widget = DashboardWidget.objects.create(
            dashboard=dashboard,
            display_type=widget_data["display_type"],
            title=widget_data["title"],
            description=widget_data.get("description", None),
            thresholds=widget_data.get("thresholds", None),
            interval=widget_data.get("interval", "5m"),
            widget_type=widget_data.get("widget_type", DashboardWidgetTypes.DISCOVER),
            discover_widget_split=widget_data.get("discover_widget_split", None),
            order=order,
            limit=widget_data.get("limit", None),
            detail={"layout": widget_data.get("layout")},
            dataset_source=widget_data.get("dataset_source", DatasetSourcesTypes.USER.value),
        )

        new_queries = []
        for i, query in enumerate(widget_data.pop("queries")):
            new_queries.append(
                DashboardWidgetQuery(
                    widget=widget,
                    fields=query["fields"],
                    aggregates=query.get("aggregates"),
                    columns=query.get("columns"),
                    field_aliases=query.get("field_aliases"),
                    conditions=query["conditions"],
                    name=query.get("name", ""),
                    orderby=query.get("orderby", ""),
                    order=i,
                    is_hidden=query.get("is_hidden", False),
                    selected_aggregate=query.get("selected_aggregate"),
                )
            )

        DashboardWidgetQuery.objects.bulk_create(new_queries)

        if widget.widget_type in [
            DashboardWidgetTypes.DISCOVER,
            DashboardWidgetTypes.TRANSACTION_LIKE,
        ]:
            self._check_query_cardinality(new_queries)

    def _check_query_cardinality(self, new_queries: Sequence[DashboardWidgetQuery]):
        organization = self.context["organization"]

        max_cardinality_allowed = options.get("on_demand.max_widget_cardinality.on_query_count")
        # To match the format of the extraction state function in ondemand
        ondemand_feature = features.has(
            "organizations:on-demand-metrics-extraction-widgets", organization
        )
        current_widget_specs = get_current_widget_specs(organization)

        for new_query in new_queries:
            query_cardinality = all(
                check_field_cardinality(
                    new_query.columns, organization, max_cardinality_allowed
                ).values()
            )
            set_or_create_on_demand_state(
                new_query, organization, query_cardinality, ondemand_feature, current_widget_specs
            )

    def update_widget(self, widget, data, order):
        prev_layout = widget.detail.get("layout") if widget.detail else None
        widget.title = data.get("title", widget.title)
        widget.description = data.get("description", widget.description)
        widget.thresholds = data.get("thresholds", widget.thresholds)
        widget.display_type = data.get("display_type", widget.display_type)
        widget.interval = data.get("interval", widget.interval)
        widget.widget_type = data.get("widget_type", widget.widget_type)
        widget.discover_widget_split = data.get(
            "discover_widget_split", widget.discover_widget_split
        )
        widget.order = order
        widget.limit = data.get("limit", widget.limit)
        widget.dataset_source = data.get("dataset_source", widget.dataset_source)
        widget.detail = {"layout": data.get("layout", prev_layout)}
        widget.save()

        if "queries" in data:
            self.update_widget_queries(widget, data["queries"])

    def update_widget_queries(self, widget, data):
        query_ids = [query["id"] for query in data if "id" in query]
        self.remove_missing_queries(widget.id, query_ids)

        existing = DashboardWidgetQuery.objects.filter(widget=widget, id__in=query_ids)
        existing_map = {query.id: query for query in existing}

        # Get new ordering start point to avoid constraint errors
        next_order = get_next_query_order(widget.id)

        new_queries = []
        update_queries = []
        for i, query_data in enumerate(data):
            query_id = query_data.get("id")
            if query_id and query_id in existing_map:
                update_queries.append(
                    self.update_widget_query(existing_map[query_id], query_data, next_order + i)
                )
            elif not query_id:
                new_queries.append(
                    DashboardWidgetQuery(
                        widget=widget,
                        fields=query_data["fields"],
                        aggregates=query_data.get("aggregates"),
                        columns=query_data.get("columns"),
                        field_aliases=query_data.get("field_aliases"),
                        conditions=query_data["conditions"],
                        name=query_data.get("name", ""),
                        is_hidden=query_data.get("is_hidden", False),
                        orderby=query_data.get("orderby", ""),
                        order=next_order + i,
                        selected_aggregate=query_data.get("selected_aggregate"),
                    )
                )
            else:
                raise serializers.ValidationError("You cannot use a query not owned by this widget")
        DashboardWidgetQuery.objects.bulk_create(new_queries)

        if widget.widget_type in [
            DashboardWidgetTypes.DISCOVER,
            DashboardWidgetTypes.TRANSACTION_LIKE,
        ]:
            self._check_query_cardinality(new_queries + update_queries)

    def update_widget_query(self, query, data, order):
        query.name = data.get("name", query.name)
        query.fields = data.get("fields", query.fields)
        query.conditions = data.get("conditions", query.conditions)
        query.orderby = data.get("orderby", query.orderby)
        query.aggregates = data.get("aggregates", query.aggregates)
        query.columns = data.get("columns", query.columns)
        query.field_aliases = data.get("field_aliases", query.field_aliases)
        query.is_hidden = data.get("is_hidden", query.is_hidden)
        query.selected_aggregate = data.get("selected_aggregate", query.selected_aggregate)

        query.order = order
        query.save()
        return query

    def remove_missing_queries(self, widget_id, keep_ids):
        DashboardWidgetQuery.objects.filter(widget_id=widget_id).exclude(id__in=keep_ids).delete()


class DashboardSerializer(DashboardDetailsSerializer):
    title = serializers.CharField(
        required=True, max_length=255, help_text="The user defined title for this dashboard."
    )


def schedule_update_project_configs(dashboard: Dashboard):
    """
    Schedule a task to update project configs for all projects of an organization when a dashboard is updated.
    """
    org = dashboard.organization

    on_demand_metrics = features.has("organizations:on-demand-metrics-extraction", org)
    dashboard_on_demand_metrics = features.has(
        "organizations:on-demand-metrics-extraction-experimental", org
    )

    if not on_demand_metrics or not dashboard_on_demand_metrics:
        return

    schedule_invalidate_project_config(
        trigger="dashboards:create-on-demand-metric", organization_id=org.id
    )
