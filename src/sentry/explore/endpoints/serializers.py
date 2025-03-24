from drf_spectacular.utils import extend_schema_serializer
from rest_framework import serializers
from rest_framework.serializers import ListField

from sentry.constants import ALL_ACCESS_PROJECTS
from sentry.explore.models import ExploreSavedQueryDataset
from sentry.utils.dates import parse_stats_period, validate_interval


class VisualizeSerializer(serializers.Serializer):
    chartType = serializers.IntegerField()
    yAxes = serializers.ListField(child=serializers.CharField())


@extend_schema_serializer(exclude_fields=["groupby"])
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

    groupby = ListField(child=serializers.CharField(), required=False, allow_null=True)
    environment = ListField(
        child=serializers.CharField(),
        required=False,
        allow_null=True,
        help_text="The name of environments to filter by.",
    )
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
    interval = serializers.CharField(
        required=False, allow_null=True, help_text="Resolution of the time series."
    )
    mode = serializers.ChoiceField(
        choices=[
            "samples",
            "aggregate",
        ],
        help_text="The mode of the query.",
    )

    def validate_projects(self, projects):
        from sentry.api.validators import validate_project_ids

        return validate_project_ids(projects, self.context["params"]["project_id"])

    def validate(self, data):
        query = {}
        query_keys = [
            "environment",
            "query",
            "fields",
            "range",
            "start",
            "end",
            "orderby",
            "visualize",
            "interval",
            "mode",
        ]

        for key in query_keys:
            if data.get(key) is not None:
                query[key] = data[key]

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
