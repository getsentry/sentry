from rest_framework import serializers

VALID_FIELD_SET = (
    "activity",
    "browser",
    "count_dead_clicks",
    "count_errors",
    "count_rage_clicks",
    "count_segments",
    "count_urls",
    "device",
    "dist",
    "duration",
    "environment",
    "error_ids",
    "finished_at",
    "id",
    "is_archived",
    "os",
    "platform",
    "project_id",
    "releases",
    "sdk",
    "started_at",
    "tags",
    "trace_ids",
    "urls",
    "user",
    "clicks",
    "info_ids",
    "warning_ids",
    "count_warnings",
    "count_infos",
)


class ReplayValidator(serializers.Serializer):
    statsPeriod = serializers.CharField(
        help_text="""
This defines the range of the time series, relative to now. The range is given in a
`<number><unit>` format. For example `1d` for a one day range. Possible units are `m` for
minutes, `h` for hours, `d` for days and `w` for weeks. You must either provide a
`statsPeriod`, or a `start` and `end`.
""",
        required=False,
    )
    start = serializers.DateTimeField(
        help_text="""
This defines the start of the time series range as an explicit datetime, either in UTC
ISO8601 or epoch seconds. Use along with `end` instead of `statsPeriod`.
""",
        required=False,
    )
    end = serializers.DateTimeField(
        help_text="""
This defines the inclusive end of the time series range as an explicit datetime, either in
UTC ISO8601 or epoch seconds. Use along with `start` instead of `statsPeriod`.
""",
        required=False,
    )
    field = serializers.MultipleChoiceField(
        choices=VALID_FIELD_SET,
        help_text="Specifies a field that should be marshaled in the output. Invalid fields will be rejected.",
        required=False,
    )
    project = serializers.ListField(
        required=False,
        help_text="The ID of the projects to filter by.",
        child=serializers.IntegerField(),
    )
    environment = serializers.CharField(help_text="The environment to filter by.", required=False)
    sort = serializers.CharField(help_text="The field to sort the output by.", required=False)
    query = serializers.CharField(
        help_text="A structured query string to filter the output by.", required=False
    )
    per_page = serializers.IntegerField(
        help_text="Limit the number of rows to return in the result.", required=False
    )
    cursor = serializers.CharField(
        help_text="The cursor parameter is used to paginate results. See [here](https://docs.sentry.io/api/pagination/) for how to use this query parameter",
        required=False,
    )


class ReplaySelectorValidator(serializers.Serializer):
    statsPeriod = serializers.CharField(
        help_text=(
            "This defines the range of the time series, relative to now. "
            "The range is given in a `<number><unit>` format. "
            "For example `1d` for a one day range. Possible units are `m` for minutes, `h` for hours, `d` for days and `w` for weeks."
            "You must either provide a `statsPeriod`, or a `start` and `end`."
        ),
        required=False,
    )
    start = serializers.DateTimeField(
        help_text="This defines the start of the time series range as an explicit datetime, either in UTC ISO8601 or epoch seconds."
        "Use along with `end` instead of `statsPeriod`.",
        required=False,
    )
    end = serializers.DateTimeField(
        help_text=(
            "This defines the inclusive end of the time series range as an explicit datetime, either in UTC ISO8601 or epoch seconds."
            "Use along with `start` instead of `statsPeriod`."
        ),
        required=False,
    )
    project = serializers.ListField(
        required=False, help_text="The ID of the projects to filter by."
    )
    sort = serializers.CharField(help_text="The field to sort the output by.", required=False)
