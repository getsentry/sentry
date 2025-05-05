from drf_spectacular.utils import extend_schema_serializer
from rest_framework import serializers
from rest_framework.serializers import ListField

from sentry.constants import ALL_ACCESS_PROJECTS
from sentry.explore.models import ExploreSavedQueryDataset
from sentry.utils.dates import parse_stats_period, validate_interval


class VisualizeSerializer(serializers.Serializer):
    chartType = serializers.IntegerField(required=False)
    yAxes = serializers.ListField(child=serializers.CharField())


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
        help_text="How to order the query results. Must be something in the `field` list, excluding equations.",
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
    mode = serializers.ChoiceField(
        choices=[
            "samples",
            "aggregate",
        ],
        help_text="The mode of the query.",
    )


class ExploreSavedQuerySerializer(serializers.Serializer):
    name = serializers.CharField(
        required=True, max_length=255, help_text="The user-defined saved query name."
    )
    projects = ListField(
        child=serializers.IntegerField(),
        required=False,
        default=[],
        help_text="The saved projects filter for this query.",
    )
    dataset = serializers.ChoiceField(
        choices=ExploreSavedQueryDataset.as_text_choices(),
        default=ExploreSavedQueryDataset.get_type_name(ExploreSavedQueryDataset.SPANS),
        help_text="The dataset you would like to query. `spans` is the only supported value for now.",
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
        ]

        for key in query_keys:
            if data.get(key) is not None:
                query[key] = data[key]

        if "query" in data:
            query["query"] = []
            for q in data["query"]:
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
