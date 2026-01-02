from drf_spectacular.utils import extend_schema_serializer
from rest_framework import serializers
from rest_framework.exceptions import ParseError, ValidationError
from rest_framework.serializers import ListField

from sentry.constants import ALL_ACCESS_PROJECTS
from sentry.explore.models import ExploreSavedQueryDataset
from sentry.utils.dates import parse_stats_period, validate_interval


class VisualizeSerializer(serializers.Serializer):
    chartType = serializers.IntegerField(required=False)
    yAxes = serializers.ListField(child=serializers.CharField())


class GroupBySerializer(serializers.Serializer):
    groupBy = serializers.CharField()


class AggregateFieldSerializer(serializers.Serializer):
    # visualizes
    chartType = serializers.IntegerField(required=False)
    yAxes = serializers.ListField(child=serializers.CharField(), required=False)

    # group bys
    groupBy = serializers.CharField(required=False)

    def validate(self, data):
        visualize_serializer = VisualizeSerializer(data=data)

        group_by_serializer = GroupBySerializer(data=data)

        # if one of them is valid, then it's good
        if visualize_serializer.is_valid() != group_by_serializer.is_valid():
            return data

        if visualize_serializer.is_valid() and group_by_serializer.is_valid():
            raise ParseError("Ambiguous aggregate field. Must specify groupBy or yAxes, not both.")

        # when neither are valid, we need to do some better error handling
        visualize_errors = visualize_serializer.errors
        group_by_errors = group_by_serializer.errors

        visualize_has_not_required_errors = any(
            error.code != "required" for error in visualize_errors.get("yAxes", [])
        )
        group_by_has_not_required_errors = any(
            error.code != "required" for error in group_by_errors.get("groupBy", [])
        )

        if visualize_has_not_required_errors:
            visualize_serializer.is_valid(raise_exception=True)
        elif group_by_has_not_required_errors:
            group_by_serializer.is_valid(raise_exception=True)

        raise ValidationError(
            {
                **visualize_errors,
                **group_by_errors,
            }
        )


class MetricSerializer(serializers.Serializer):
    name = serializers.CharField(
        required=True,
        help_text="The name of the metric.",
    )
    type = serializers.ChoiceField(
        choices=[
            "counter",
            "gauge",
            "distribution",
        ],
        required=True,
        help_text="The type of the metric.",
    )
    unit = serializers.CharField(
        required=False,
        allow_null=True,
        help_text="The unit of the metric (e.g., 'millisecond'). See MetricUnit in relay",
    )


@extend_schema_serializer(exclude_fields=["groupby"])
class QuerySerializer(serializers.Serializer):
    fields = ListField(
        child=serializers.CharField(),
        required=False,
        allow_null=True,
        help_text="The fields that can be requested for the query.",
    )  # type: ignore[assignment]  # XXX: clobbers Serializer.fields
    orderby = serializers.CharField(
        required=False,
        allow_null=True,
        help_text="How to order the query results. Must be something in the `field` list.",
    )
    groupby = ListField(child=serializers.CharField(), required=False, allow_null=True)
    query = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="Filters results by using [query syntax](/product/sentry-basics/search/).",
    )
    visualize = ListField(
        child=VisualizeSerializer(),
        required=False,
        allow_null=True,
        help_text="The visualizations to be plotted on the chart.",
    )
    aggregateField = ListField(
        child=AggregateFieldSerializer(),
        required=False,
        allow_null=True,
        help_text="The visualizations to be plotted on the chart.",
    )
    aggregateOrderby = serializers.CharField(
        required=False,
        allow_null=True,
        help_text="How to order the query results. Must be something in the `aggregateField` list, excluding equations.",
    )
    mode = serializers.ChoiceField(
        choices=[
            "samples",
            "aggregate",
        ],
        help_text="The mode of the query.",
    )
    metric = MetricSerializer(
        required=False,
        allow_null=True,
        help_text="The metric configuration (only used for metrics dataset).",
    )
    caseInsensitive = serializers.BooleanField(
        required=False,
        default=False,
        help_text="Whether the query should be case insensitive.",
    )


class ExploreSavedQuerySerializer(serializers.Serializer):
    name = serializers.CharField(
        required=True, max_length=255, help_text="The user-defined saved query name."
    )
    projects = ListField(
        child=serializers.IntegerField(),
        required=False,
        default=list,
        help_text="The saved projects filter for this query.",
    )
    dataset = serializers.ChoiceField(
        choices=ExploreSavedQueryDataset.as_text_choices(),
        default=ExploreSavedQueryDataset.get_type_name(ExploreSavedQueryDataset.SPANS),
        help_text="The dataset you would like to query. Supported values: `spans`, `logs`, `metrics`.",
    )
    start = serializers.DateTimeField(
        required=False,
        allow_null=True,
        help_text="The saved start time for this saved query.",
    )
    end = serializers.DateTimeField(
        required=False,
        allow_null=True,
        help_text="The saved end time for this saved query.",
    )
    range = serializers.CharField(
        required=False,
        allow_null=True,
        help_text="The saved time range period for this saved query.",
    )
    environment = ListField(
        child=serializers.CharField(),
        required=False,
        allow_null=True,
        help_text="The name of environments to filter by.",
    )
    interval = serializers.CharField(
        required=False, allow_null=True, help_text="Resolution of the time series."
    )
    query = ListField(child=QuerySerializer(), required=False, allow_null=True)

    def validate_projects(self, projects):
        from sentry.api.validators import validate_project_ids

        return validate_project_ids(projects, self.context["params"]["project_id"])

    # Avoid including any side-effecting logic here, since this logic is also used when generating prebuilt queries on first read
    def validate(self, data):
        query = {}
        query_keys = [
            "environment",
            "range",
            "start",
            "end",
            "interval",
        ]

        inner_query_keys = [
            "query",
            "fields",
            "orderby",
            "groupby",
            "visualize",
            "mode",
            "aggregateField",
            "aggregateOrderby",
            "metric",
            "caseInsensitive",
        ]

        for key in query_keys:
            if data.get(key) is not None:
                value = data[key]
                if key in ("start", "end"):
                    value = value.isoformat()
                query[key] = value

        if "query" in data:
            query["query"] = []
            for q in data["query"]:
                if "metric" in q and data["dataset"] != "metrics":
                    raise serializers.ValidationError(
                        "Metric field is only allowed for metrics dataset"
                    )
                if data["dataset"] == "metrics" and "metric" not in q:
                    raise serializers.ValidationError(
                        "Metric field is required for metrics dataset"
                    )
                inner_query = {}
                for key in inner_query_keys:
                    if key in q:
                        inner_query[key] = q[key]
                query["query"].append(inner_query)

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

        return {
            "name": data["name"],
            "project_ids": data["projects"],
            "query": query,
            "dataset": ExploreSavedQueryDataset.get_id_for_type_name(data["dataset"]),
        }
