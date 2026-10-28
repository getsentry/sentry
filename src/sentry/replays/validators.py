from rest_framework import serializers
from rest_framework.exceptions import ParseError

from sentry.api.helpers.projects import ProjectIdOrSlugField
from sentry.apidocs.omissions import sentry_schema_serializer
from sentry.replays.post_process import ReplayDetailsResponse

VALID_FIELD_SET = tuple(sorted(ReplayDetailsResponse.__annotations__))


def validate_fields(fields: list[str]) -> list[str]:
    invalid = sorted(set(fields) - set(VALID_FIELD_SET))
    if invalid:
        raise ParseError(f"Invalid field: {', '.join(invalid)}")
    return fields


# ReplayDetailsResponse omits these from the public response, so the public
# `field` enum must not offer them either. They are still accepted at runtime.
@sentry_schema_serializer(
    omit_from_public_schema={
        "field.info_ids": "Internal breadcrumb index used by the replay UI.",
        "field.warning_ids": "Internal breadcrumb index used by the replay UI.",
    }
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
        help_text="A list of project IDs or slugs to filter by.",
        child=ProjectIdOrSlugField(),
    )
    projectSlug = serializers.ListField(
        required=False,
        allow_empty=True,
        child=serializers.CharField(),
        help_text=("A list of project slugs to filter your results by."),
    )
    environment = serializers.ListField(
        help_text="The environments to filter by.",
        required=False,
        child=serializers.CharField(),
    )
    sort = serializers.CharField(help_text="The field to sort the output by.", required=False)
    sortBy = serializers.CharField(help_text="The field to sort the output by.", required=False)
    orderBy = serializers.CharField(help_text="The field to sort the output by.", required=False)
    query = serializers.CharField(
        help_text="A structured query string to filter the output by.", required=False
    )
    queryReferrer = serializers.CharField(
        help_text="Internal referrer identifier used for query tracing.", required=False
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
        required=False,
        help_text="A list of project IDs or slugs to filter by.",
        child=ProjectIdOrSlugField(),
    )
    projectSlug = serializers.ListField(
        required=False,
        allow_empty=True,
        child=serializers.CharField(),
        help_text=("A list of project slugs to filter your results by."),
    )
    environment = serializers.ListField(
        help_text="The environment to filter by.",
        required=False,
        child=serializers.CharField(),
    )
    sort = serializers.CharField(help_text="The field to sort the output by.", required=False)
    sortBy = serializers.CharField(help_text="The field to sort the output by.", required=False)
    orderBy = serializers.CharField(help_text="The field to sort the output by.", required=False)
