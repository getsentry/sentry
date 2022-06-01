from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter
from rest_framework import serializers


class GLOBAL_PARAMS:
    ORG_SLUG = OpenApiParameter(
        name="organization_slug",
        description="The slug of the organization the resource belongs to.",
        required=True,
        type=str,
        location="path",
    )
    PROJECT_SLUG = OpenApiParameter(
        name="project_slug",
        description="The slug of the project the resource belongs to.",
        required=True,
        type=str,
        location="path",
    )
    STATS_PERIOD = OpenApiParameter(
        name="statsPeriod",
        location="query",
        required=False,
        type=str,
        description="""The period of time for the query, will override the start & end parameters, a number followed by one of:
- `d` for days
- `h` for hours
- `m` for minutes
- `s` for seconds
- `w` for weeks

For example `24h`, to mean query data starting from 24 hours ago to now.""",
    )
    START = OpenApiParameter(
        name="start",
        location="query",
        required=False,
        type=OpenApiTypes.DATETIME,
        description="The start of the period of time for the query, expected in ISO-8601 format. For example 2001-12-34T12:34:56.7890",
    )
    END = OpenApiParameter(
        name="end",
        location="query",
        required=False,
        type=OpenApiTypes.DATETIME,
        description="The end of the period of time for the query, expected in ISO-8601 format. For example 2001-12-34T12:34:56.7890",
    )
    PROJECT = OpenApiParameter(
        name="project",
        location="query",
        required=False,
        many=True,
        type=int,
        description="The ids of projects to filter by. `-1` means all available projects, if parameter omitted means 'My Projects'",
    )
    ENVIRONMENT = OpenApiParameter(
        name="environment",
        location="query",
        required=False,
        many=True,
        type=str,
        description="The name of environments to filter by.",
    )


class SCIM_PARAMS:
    MEMBER_ID = OpenApiParameter(
        name="member_id",
        location="path",
        required=True,
        type=int,
        description="The id of the member you'd like to query.",
    )
    TEAM_ID = OpenApiParameter(
        name="team_id",
        location="path",
        required=True,
        type=int,
        description="The id of the team you'd like to query / update.",
    )


class ISSUE_ALERT_PARAMS:
    ISSUE_RULE_ID = OpenApiParameter(
        name="rule_id",
        location="path",
        required=True,
        type=int,
        description="The id of the rule you'd like to query",
    )


class VISIBILITY_PARAMS:
    QUERY = OpenApiParameter(
        name="query",
        location="query",
        required=False,
        type=str,
        description="""The search query for your filter, read more about query syntax [here](https://docs.sentry.io/product/sentry-basics/search/)

example: `query=(transaction:foo AND release:abc) OR (transaction:[bar,baz] AND release:def)`
""",
    )
    FIELD = OpenApiParameter(
        name="field",
        location="query",
        required=True,
        type=str,
        many=True,
        description="""The fields, functions or equations to request for the query. At most 20 fields can be passed per request. Each field can be one of the following types:
- a built-in key field, see possible fields in the [properties table](/product/sentry-basics/search/searchable-properties/#properties-table), under any field that is an event property
    - example: `field=transaction`
- a tag, tags should use the `tag[]` formatting to avoid ambiguity with any fields
    - example: `field=tag[isEnterprise]`
- a function which will be in the format of `function_name(parameters,...)`, see possible functions in the [query builder documentation](/product/discover-queries/query-builder/#stacking-functions)
    - when a function is included, discover will group by any tags or fields
    - example: `field=count_if(transaction.duration,greater,300)`
- an equation when prefixed with `equation|`, read more about [equations here](https://docs.sentry.io/product/discover-queries/query-builder/query-equations/)
    - example: `field=equation|count_if(transaction.duration,greater,300) / count() * 100`
""",
    )
    SORT = OpenApiParameter(
        name="sort",
        location="query",
        required=False,
        type=str,
        description="What to order the results of the query by. Must be something in the field list, excluding equations.",
    )
    PER_PAGE = OpenApiParameter(
        name="per_page",
        location="query",
        required=False,
        type=int,
        description="Limit the number of rows to return in the result, maximum allowed is 100",
    )


class CURSOR_QUERY_PARAM(serializers.Serializer):  # type: ignore
    cursor = serializers.CharField(
        help_text="A pointer to the last object fetched and its' sort order; used to retrieve the next or previous results.",
        required=False,
    )
