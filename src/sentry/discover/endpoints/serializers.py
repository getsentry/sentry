import re
from collections.abc import Sequence

import sentry_sdk
from django.db.models import Count, Max, QuerySet
from drf_spectacular.utils import extend_schema_serializer
from rest_framework import serializers
from rest_framework.serializers import ListField

from sentry import features
from sentry.api.fields.empty_integer import EmptyIntegerField
from sentry.api.utils import get_date_range_from_params
from sentry.constants import ALL_ACCESS_PROJECTS
from sentry.discover.arithmetic import ArithmeticError, categorize_columns
from sentry.discover.models import (
    MAX_TEAM_KEY_TRANSACTIONS,
    DiscoverSavedQueryTypes,
    TeamKeyTransaction,
)
from sentry.exceptions import InvalidParams, InvalidSearchQuery
from sentry.models.organization import Organization
from sentry.models.team import Team
from sentry.search.events.builder.discover import DiscoverQueryBuilder
from sentry.search.events.types import QueryBuilderConfig
from sentry.snuba.dataset import Dataset
from sentry.users.models import User
from sentry.utils.dates import parse_stats_period, validate_interval
from sentry.utils.snuba import SENTRY_SNUBA_MAP


class DiscoverQuerySerializer(serializers.Serializer):
    projects = ListField(child=serializers.IntegerField(), required=True, allow_null=False)
    start = serializers.CharField(required=False, allow_null=True)
    end = serializers.CharField(required=False, allow_null=True)
    range = serializers.CharField(required=False, allow_null=True)
    statsPeriod = serializers.CharField(required=False, allow_null=True)
    statsPeriodStart = serializers.CharField(required=False, allow_null=True)
    statsPeriodEnd = serializers.CharField(required=False, allow_null=True)
    fields = ListField(child=serializers.CharField(), required=False, default=[])  # type: ignore[assignment]  # XXX: clobbers Serializer.fields
    conditionFields = ListField(child=ListField(), required=False, allow_null=True)
    limit = EmptyIntegerField(min_value=0, max_value=10000, required=False, allow_null=True)
    rollup = EmptyIntegerField(required=False, allow_null=True)
    orderby = serializers.CharField(required=False, default="", allow_blank=True)
    conditions = ListField(child=ListField(), required=False, allow_null=True)
    aggregations = ListField(child=ListField(), required=False, default=[])
    groupby = ListField(child=serializers.CharField(), required=False, allow_null=True)
    turbo = serializers.BooleanField(required=False)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        data = kwargs["data"]

        fields = data.get("fields") or []

        match = next(
            (
                self.get_array_field(field).group(1)
                for field in fields
                if self.get_array_field(field) is not None
            ),
            None,
        )
        self.arrayjoin = match if match else None

    def validate(self, data):
        data["arrayjoin"] = self.arrayjoin

        # prevent conflicting date ranges from being supplied
        date_fields = ["start", "statsPeriod", "range", "statsPeriodStart"]
        date_fields_provided = len([data.get(f) for f in date_fields if data.get(f) is not None])
        if date_fields_provided == 0:
            raise serializers.ValidationError("You must specify a date filter")
        elif date_fields_provided > 1:
            raise serializers.ValidationError("Conflicting date filters supplied")

        if not data.get("fields") and not data.get("aggregations"):
            raise serializers.ValidationError("Specify at least one field or aggregation")

        try:
            start, end = get_date_range_from_params(
                {
                    "start": data.get("start"),
                    "end": data.get("end"),
                    "statsPeriod": data.get("statsPeriod") or data.get("range"),
                    "statsPeriodStart": data.get("statsPeriodStart"),
                    "statsPeriodEnd": data.get("statsPeriodEnd"),
                },
                optional=True,
            )
        except InvalidParams as e:
            raise serializers.ValidationError(str(e))

        if start is None or end is None:
            raise serializers.ValidationError("Either start and end dates or range is required")

        data["start"] = start
        data["end"] = end

        return data

    def validate_conditions(self, value):
        # Handle error (exception_stacks), stack(exception_frames)
        return [self.get_condition(condition) for condition in value]

    def validate_aggregations(self, value):
        valid_functions = {"count()", "uniq", "avg", "sum"}
        requested_functions = {agg[0] for agg in value}

        if not requested_functions.issubset(valid_functions):
            invalid_functions = ", ".join(requested_functions - valid_functions)

            raise serializers.ValidationError(f"Invalid aggregate function - {invalid_functions}")

        return value

    def get_array_field(self, field):
        pattern = r"^(error|stack)\..+"
        term = re.search(pattern, field)
        if term and SENTRY_SNUBA_MAP.get(field):
            return term
        return None

    def get_condition(self, condition):
        array_field = self.get_array_field(condition[0])
        has_equality_operator = condition[1] in ("=", "!=")

        # Cast boolean values to 1 / 0
        if isinstance(condition[2], bool):
            condition[2] = int(condition[2])

        # Strip double quotes on strings
        if isinstance(condition[2], str):
            match = re.search(r'^"(.*)"$', condition[2])
            if match:
                condition[2] = match.group(1)

        # Apply has function to any array field if it's = / != and not part of arrayjoin
        if array_field and has_equality_operator and (array_field.group(1) != self.arrayjoin):
            value = condition[2]

            if isinstance(value, str):
                value = f"'{value}'"

            bool_value = 1 if condition[1] == "=" else 0

            return [["has", [array_field.group(0), value]], "=", bool_value]

        return condition


@extend_schema_serializer(
    exclude_fields=["rollup", "aggregations", "groupby", "conditions", "limit", "version", "widths"]
)
class DiscoverSavedQuerySerializer(serializers.Serializer):
    name = serializers.CharField(
        required=True, max_length=255, help_text="The user-defined saved query name."
    )
    projects = ListField(
        child=serializers.IntegerField(),
        required=False,
        default=[],
        help_text="The saved projects filter for this query.",
    )
    queryDataset = serializers.ChoiceField(
        choices=DiscoverSavedQueryTypes.as_text_choices(),
        default=DiscoverSavedQueryTypes.get_type_name(DiscoverSavedQueryTypes.ERROR_EVENTS),
        help_text="""The dataset you would like to query. Allowed values are:
- error-events
- transaction-like
""",
    )
    start = serializers.DateTimeField(
        required=False, allow_null=True, help_text="The saved start time for this saved query."
    )
    end = serializers.DateTimeField(
        required=False, allow_null=True, help_text="The saved end time for this saved query."
    )
    range = serializers.CharField(
        required=False,
        allow_null=True,
        help_text="The saved time range period for this saved query.",
    )
    fields = ListField(
        child=serializers.CharField(),
        required=False,
        allow_null=True,
        help_text="""The fields, functions, or equations that can be requested for the query. At most 20 fields can be selected per request. Each field can be one of the following types:
- A built-in key field. See possible fields in the [properties table](/product/sentry-basics/search/searchable-properties/#properties-table), under any field that is an event property.
    - example: `field=transaction`
- A tag. Tags should use the `tag[]` formatting to avoid ambiguity with any fields
    - example: `field=tag[isEnterprise]`
- A function which will be in the format of `function_name(parameters,...)`. See possible functions in the [query builder documentation](/product/discover-queries/query-builder/#stacking-functions).
    - when a function is included, Discover will group by any tags or fields
    - example: `field=count_if(transaction.duration,greater,300)`
- An equation when prefixed with `equation|`. Read more about [equations here](/product/discover-queries/query-builder/query-equations/).
    - example: `field=equation|count_if(transaction.duration,greater,300) / count() * 100`
""",
    )  # type: ignore[assignment]  # XXX: clobbers Serializer.fields
    orderby = serializers.CharField(
        required=False,
        allow_null=True,
        help_text="How to order the query results. Must be something in the `field` list, excluding equations.",
    )

    # This block of fields is only accepted by discover 1 which omits the version
    # attribute or has it set to 1
    rollup = serializers.IntegerField(required=False, allow_null=True)
    aggregations = ListField(child=ListField(), required=False, allow_null=True)
    groupby = ListField(child=serializers.CharField(), required=False, allow_null=True)
    conditions = ListField(child=ListField(), required=False, allow_null=True)
    limit = serializers.IntegerField(min_value=0, max_value=1000, required=False, allow_null=True)

    # There are multiple versions of saved queries supported.
    version = serializers.IntegerField(min_value=1, max_value=2, required=False, allow_null=True)

    # Attributes that are only accepted if version = 2
    environment = ListField(
        child=serializers.CharField(),
        required=False,
        allow_null=True,
        help_text="The name of environments to filter by.",
    )
    query = serializers.CharField(
        required=False,
        allow_null=True,
        help_text="Filters results by using [query syntax](/product/sentry-basics/search/).",
    )
    widths = ListField(child=serializers.CharField(), required=False, allow_null=True)
    yAxis = ListField(
        child=serializers.CharField(),
        required=False,
        allow_null=True,
        help_text="Aggregate functions to be plotted on the chart.",
    )
    display = serializers.CharField(
        required=False,
        allow_null=True,
        help_text="""Visualization type for saved query chart. Allowed values are:
- default
- previous
- top5
- daily
- dailytop5
- bar
""",
    )
    topEvents = serializers.IntegerField(
        min_value=1,
        max_value=10,
        required=False,
        allow_null=True,
        help_text="Number of top events' timeseries to be visualized.",
    )
    interval = serializers.CharField(
        required=False, allow_null=True, help_text="Resolution of the time series."
    )

    disallowed_fields = {
        1: {"environment", "query", "yAxis", "display", "topEvents", "interval"},
        2: {"groupby", "rollup", "aggregations", "conditions", "limit"},
    }

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

    def validate_projects(self, projects):
        from sentry.api.validators import validate_project_ids

        return validate_project_ids(projects, self.context["params"]["project_id"])

    def validate_queryDataset(self, value):
        dataset = DiscoverSavedQueryTypes.get_id_for_type_name(value)
        if dataset == DiscoverSavedQueryTypes.DISCOVER or dataset is None:
            sentry_sdk.set_context(
                "discover",
                {
                    "org_slug": self.context["organization"].slug,
                },
            )
            sentry_sdk.capture_message("Created or updated saved query with discover dataset.")
            if features.has(
                "organizations:deprecate-discover-widget-type",
                self.context["organization"],
                actor=self.context["user"],
            ):
                raise serializers.ValidationError(
                    "Attribute value `discover` is deprecated. Please use `error-events` or `transaction-like`"
                )
        return dataset

    def validate(self, data):
        query = {}
        query_keys = [
            "environment",
            "query",
            "fields",
            "conditions",
            "aggregations",
            "range",
            "start",
            "end",
            "orderby",
            "limit",
            "widths",
            "yAxis",
            "display",
            "topEvents",
            "interval",
        ]

        for key in query_keys:
            if data.get(key) is not None:
                query[key] = data[key]

        version = data.get("version", 1)
        self.validate_version_fields(version, query)
        if version == 2:
            if len(query["fields"]) < 1:
                raise serializers.ValidationError("You must include at least one field.")

        if data["projects"] == ALL_ACCESS_PROJECTS:
            data["projects"] = []
            query["all_projects"] = True

        if "query" in query:
            if "interval" in query:
                interval = parse_stats_period(query["interval"])
                if interval is None:
                    raise serializers.ValidationError("Interval could not be parsed")
                date_range = self.context["params"]["end"] - self.context["params"]["start"]
                validate_interval(
                    interval,
                    serializers.ValidationError("Interval would cause too many results"),
                    date_range,
                    0,
                )
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

                equations, columns = categorize_columns(query["fields"])
                builder = DiscoverQueryBuilder(
                    dataset=Dataset.Discover,
                    params=self.context["params"],
                    query=query["query"],
                    selected_columns=columns,
                    equations=equations,
                    orderby=query.get("orderby"),
                    config=QueryBuilderConfig(has_metrics=use_metrics),
                )
                builder.get_snql_query().validate()
            except (InvalidSearchQuery, ArithmeticError) as err:
                raise serializers.ValidationError(f"Cannot save invalid query: {err}")

        return {
            "name": data["name"],
            "project_ids": data["projects"],
            "query": query,
            "version": version,
            "query_dataset": data["queryDataset"],
        }

    def validate_version_fields(self, version, query):
        try:
            not_allowed = self.disallowed_fields[version]
        except KeyError:
            raise serializers.ValidationError("Invalid version requested.")
        bad_fields = set(query.keys()) & not_allowed
        if bad_fields:
            raise serializers.ValidationError(
                "You cannot use the %s attribute(s) with the selected version"
                % ", ".join(sorted(bad_fields))
            )


class TeamKeyTransactionSerializer(serializers.Serializer):
    transaction = serializers.CharField(required=True, max_length=200)
    team = serializers.ListField(child=serializers.IntegerField())

    def validate_team(self, team_ids: Sequence[int]) -> QuerySet[Team]:
        request = self.context["request"]
        organization = self.context["organization"]
        verified_teams = {team.id for team in Team.objects.get_for_user(organization, request.user)}

        teams = Team.objects.filter(id__in=team_ids)

        for team in teams:
            if team.id in verified_teams:
                continue

            if not request.access.has_team_access(team):
                raise serializers.ValidationError(
                    f"You do not have permission to access {team.name}"
                )

        return teams

    def validate(self, data):
        data = super().validate(data)
        if self.context.get("mode") == "create":
            team = data["team"]
            count = (
                TeamKeyTransaction.objects.values("project_team")
                .filter(project_team__team_id__in=[item.id for item in team])
                .annotate(total=Count("project_team"))
                .aggregate(max=Max("total"))
            )
            # Limit the number of key transactions for a team
            if count["max"] and count["max"] >= MAX_TEAM_KEY_TRANSACTIONS:
                raise serializers.ValidationError(
                    f"At most {MAX_TEAM_KEY_TRANSACTIONS} Key Transactions can be added for a team"
                )
        return data
