import re
from datetime import datetime, timedelta

from django.db.models import Max
from rest_framework import serializers

from sentry.api.issue_search import parse_search_query
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.api.serializers.rest_framework.base import convert_dict_key_case, snake_to_camel_case
from sentry.discover.arithmetic import ArithmeticError, categorize_columns, resolve_equation_list
from sentry.exceptions import InvalidSearchQuery
from sentry.models import (
    Dashboard,
    DashboardWidget,
    DashboardWidgetDisplayTypes,
    DashboardWidgetQuery,
    DashboardWidgetTypes,
)
from sentry.search.events.fields import get_function_alias, resolve_field_list
from sentry.search.events.filter import get_filter
from sentry.utils.dates import parse_stats_period

AGGREGATE_PATTERN = r"^(\w+)\((.*)?\)$"
AGGREGATE_BASE = r".*(\w+)\((.*)?\)"
EQUATION_PREFIX = "equation|"


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


class DashboardWidgetQuerySerializer(CamelSnakeSerializer):
    # Is a string because output serializers also make it a string.
    id = serializers.CharField(required=False)
    fields = serializers.ListField(child=serializers.CharField(), required=False)
    aggregates = serializers.ListField(
        child=serializers.CharField(), required=False, allow_null=True
    )
    columns = serializers.ListField(child=serializers.CharField(), required=False, allow_null=True)
    name = serializers.CharField(required=False, allow_blank=True)
    conditions = serializers.CharField(required=False, allow_blank=True)
    orderby = serializers.CharField(required=False, allow_blank=True)

    required_for_create = {"fields", "conditions"}

    validate_id = validate_id

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
        is_table = is_table_display_type(self.context.get("displayType"))

        # TODO(dam): Use columns and aggregates for validation
        fields = self._get_attr(data, "fields", []).copy()
        equations, fields = categorize_columns(fields)

        # TODO(dam): Temp code while we are sure adoption
        # of fromtend code that sends this data is high enough
        columns = self._get_attr(data, "columns", []).copy()
        aggregates = self._get_attr(data, "aggregates", []).copy()

        if not columns and not aggregates:
            for field in fields:
                if is_aggregate(field):
                    aggregates.append(field)
                else:
                    columns.append(field)

            data["columns"] = columns
            data["aggregates"] = aggregates

        if equations is not None:
            try:
                resolved_equations, _, _ = resolve_equation_list(
                    equations,
                    fields,
                    auto_add=not is_table,
                    aggregates_only=not is_table,
                )
            except (InvalidSearchQuery, ArithmeticError) as err:
                raise serializers.ValidationError({"fields": f"Invalid fields: {err}"})
        else:
            resolved_equations = []

        try:
            parse_search_query(conditions)
        except InvalidSearchQuery as err:
            # We don't know if the widget that this query belongs to is an
            # Issue widget or Discover widget. Pass the error back to the
            # Widget serializer to decide if whether or not to raise this
            # error based on the Widget's type
            data["issue_query_error"] = {"conditions": [f"Invalid conditions: {err}"]}

        try:
            # When using the eps/epm functions, they require an interval argument
            # or to provide the start/end so that the interval can be computed.
            # This uses a hard coded start/end to ensure the validation succeeds
            # since the values themselves don't matter.
            params = {
                "start": datetime.now() - timedelta(days=1),
                "end": datetime.now(),
                "project_id": [p.id for p in self.context.get("projects")],
                "organization_id": self.context.get("organization").id,
            }

            snuba_filter = get_filter(conditions, params=params)
        except InvalidSearchQuery as err:
            data["discover_query_error"] = {"conditions": [f"Invalid conditions: {err}"]}
            return data

        if orderby:
            snuba_filter.orderby = get_function_alias(orderby)

        # TODO(dam): Add validation for metrics fields/queries
        try:
            resolve_field_list(fields, snuba_filter, resolved_equations=resolved_equations)
        except InvalidSearchQuery as err:
            # We don't know if the widget that this query belongs to is an
            # Issue widget or Discover widget. Pass the error back to the
            # Widget serializer to decide if whether or not to raise this
            # error based on the Widget's type
            data["discover_query_error"] = {"fields": f"Invalid fields: {err}"}

        return data

    def _get_attr(self, data, attr, empty_value=None):
        value = data.get(attr)
        if value is not None:
            return value
        if self.instance:
            return getattr(self.instance, attr)
        return empty_value


class DashboardWidgetSerializer(CamelSnakeSerializer):
    # Is a string because output serializers also make it a string.
    id = serializers.CharField(required=False)
    title = serializers.CharField(required=False, max_length=255)
    display_type = serializers.ChoiceField(
        choices=DashboardWidgetDisplayTypes.as_text_choices(), required=False
    )
    interval = serializers.CharField(required=False, max_length=10)
    queries = DashboardWidgetQuerySerializer(many=True, required=False)
    widget_type = serializers.ChoiceField(
        choices=DashboardWidgetTypes.as_text_choices(), required=False
    )
    layout = LayoutField(required=False, allow_null=True)

    def validate_display_type(self, display_type):
        return DashboardWidgetDisplayTypes.get_id_for_type_name(display_type)

    def validate_widget_type(self, widget_type):
        return DashboardWidgetTypes.get_id_for_type_name(widget_type)

    validate_id = validate_id

    def validate_interval(self, interval):
        if parse_stats_period(interval) is None:
            raise serializers.ValidationError("Invalid interval")
        return interval

    def validate(self, data):
        query_errors = []
        has_query_error = False
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
        if has_query_error:
            raise serializers.ValidationError({"queries": query_errors})
        if not data.get("id"):
            if not data.get("queries"):
                raise serializers.ValidationError(
                    {"queries": "One or more queries are required to create a widget"}
                )
            if not data.get("title"):
                raise serializers.ValidationError({"title": "Title is required during creation."})
            if data.get("display_type") is None:
                raise serializers.ValidationError(
                    {"displayType": "displayType is required during creation."}
                )
        return data


class DashboardDetailsSerializer(CamelSnakeSerializer):
    # Is a string because output serializers also make it a string.
    id = serializers.CharField(required=False)
    title = serializers.CharField(required=False, max_length=255)
    widgets = DashboardWidgetSerializer(many=True, required=False)

    validate_id = validate_id

    def create(self, validated_data):
        """
        Create a dashboard, and create any widgets and their queries

        Only call save() on this serializer from within a transaction or
        bad things will happen
        """
        self.instance = Dashboard.objects.create(
            organization=self.context.get("organization"),
            title=validated_data["title"],
            created_by=self.context.get("request").user,
        )

        if "widgets" in validated_data:
            self.update_widgets(self.instance, validated_data["widgets"])

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
            interval=widget_data.get("interval", "5m"),
            widget_type=widget_data.get("widget_type", DashboardWidgetTypes.DISCOVER),
            order=order,
            detail={"layout": widget_data.get("layout")},
        )
        new_queries = []
        for i, query in enumerate(widget_data.pop("queries")):
            new_queries.append(
                DashboardWidgetQuery(
                    widget=widget,
                    fields=query["fields"],
                    aggregates=query.get("aggregates"),
                    columns=query.get("columns"),
                    conditions=query["conditions"],
                    name=query.get("name", ""),
                    orderby=query.get("orderby", ""),
                    order=i,
                )
            )
        DashboardWidgetQuery.objects.bulk_create(new_queries)

    def update_widget(self, widget, data, order):
        prev_layout = widget.detail.get("layout") if widget.detail else None
        widget.title = data.get("title", widget.title)
        widget.display_type = data.get("display_type", widget.display_type)
        widget.interval = data.get("interval", widget.interval)
        widget.widget_type = data.get("widget_type", widget.widget_type)
        widget.order = order
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
        for i, query_data in enumerate(data):
            query_id = query_data.get("id")
            if query_id and query_id in existing_map:
                self.update_widget_query(existing_map[query_id], query_data, next_order + i)
            elif not query_id:
                new_queries.append(
                    DashboardWidgetQuery(
                        widget=widget,
                        fields=query_data["fields"],
                        aggregates=query_data.get("aggregates"),
                        columns=query_data.get("columns"),
                        conditions=query_data["conditions"],
                        name=query_data.get("name", ""),
                        orderby=query_data.get("orderby", ""),
                        order=next_order + i,
                    )
                )
            else:
                raise serializers.ValidationError("You cannot use a query not owned by this widget")
        DashboardWidgetQuery.objects.bulk_create(new_queries)

    def update_widget_query(self, query, data, order):
        query.name = data.get("name", query.name)
        query.fields = data.get("fields", query.fields)
        query.conditions = data.get("conditions", query.conditions)
        query.orderby = data.get("orderby", query.orderby)
        query.aggregates = data.get("aggregates", query.aggregates)
        query.columns = data.get("columns", query.columns)
        query.order = order
        query.save()

    def remove_missing_queries(self, widget_id, keep_ids):
        DashboardWidgetQuery.objects.filter(widget_id=widget_id).exclude(id__in=keep_ids).delete()


class DashboardSerializer(DashboardDetailsSerializer):
    title = serializers.CharField(required=True, max_length=255)
