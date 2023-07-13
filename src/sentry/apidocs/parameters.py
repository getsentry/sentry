from drf_spectacular.plumbing import build_array_type, build_basic_type
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, inline_serializer
from rest_framework import serializers

# NOTE: Please add new params by path vs query, then in alphabetical order


# drf-spectacular doesn't support a list type in it's OpenApiTypes, so we manually build
# a typed list using this workaround
def build_typed_list(type: OpenApiTypes):
    return build_array_type(build_basic_type(type))


class GlobalParams:
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
    TEAM_SLUG = OpenApiParameter(
        name="team_slug",
        description="The slug of the team the resource belongs to.",
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
        description="The start of the period of time for the query, expected in ISO-8601 format. For example `2001-12-14T12:34:56.7890`.",
    )
    END = OpenApiParameter(
        name="end",
        location="query",
        required=False,
        type=OpenApiTypes.DATETIME,
        description="The end of the period of time for the query, expected in ISO-8601 format. For example `2001-12-14T12:34:56.7890`.",
    )
    PROJECT = OpenApiParameter(
        name="project",
        location="query",
        required=False,
        many=True,
        type=int,
        description="The ids of projects to filter by. `-1` means all available projects. If this parameter is omitted, the request will default to using 'My Projects'.",
    )
    ENVIRONMENT = OpenApiParameter(
        name="environment",
        location="query",
        required=False,
        many=True,
        type=str,
        description="The name of environments to filter by.",
    )

    @staticmethod
    def name(description: str, required: bool = False) -> OpenApiParameter:
        return OpenApiParameter(
            name="name",
            location="query",
            required=required,
            type=str,
            description=description,
        )

    @staticmethod
    def slug(description: str, required: bool = False) -> OpenApiParameter:
        return OpenApiParameter(
            name="slug",
            location="query",
            required=required,
            type=str,
            description=description,
        )


class SCIMParams:
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


class IssueAlertParams:
    ISSUE_RULE_ID = OpenApiParameter(
        name="rule_id",
        location="path",
        required=True,
        type=int,
        description="The id of the rule you'd like to query.",
    )


class VisibilityParams:
    QUERY = OpenApiParameter(
        name="query",
        location="query",
        required=False,
        type=str,
        description="""The search filter for your query, read more about query syntax [here](https://docs.sentry.io/product/sentry-basics/search/).

example: `query=(transaction:foo AND release:abc) OR (transaction:[bar,baz] AND release:def)`
""",
    )
    FIELD = OpenApiParameter(
        name="field",
        location="query",
        required=True,
        type=str,
        many=True,
        description="""The fields, functions, or equations to request for the query. At most 20 fields can be selected per request. Each field can be one of the following types:
- A built-in key field. See possible fields in the [properties table](/product/sentry-basics/search/searchable-properties/#properties-table), under any field that is an event property.
    - example: `field=transaction`
- A tag. Tags should use the `tag[]` formatting to avoid ambiguity with any fields
    - example: `field=tag[isEnterprise]`
- A function which will be in the format of `function_name(parameters,...)`. See possible functions in the [query builder documentation](/product/discover-queries/query-builder/#stacking-functions).
    - when a function is included, Discover will group by any tags or fields
    - example: `field=count_if(transaction.duration,greater,300)`
- An equation when prefixed with `equation|`. Read more about [equations here](https://docs.sentry.io/product/discover-queries/query-builder/query-equations/).
    - example: `field=equation|count_if(transaction.duration,greater,300) / count() * 100`
""",
    )
    SORT = OpenApiParameter(
        name="sort",
        location="query",
        required=False,
        type=str,
        description="What to order the results of the query by. Must be something in the `field` list, excluding equations.",
    )
    PER_PAGE = OpenApiParameter(
        name="per_page",
        location="query",
        required=False,
        type=int,
        description="Limit the number of rows to return in the result. Default and maximum allowed is 100.",
    )


class CursorQueryParam(serializers.Serializer):
    cursor = serializers.CharField(
        help_text="A pointer to the last object fetched and its sort order; used to retrieve the next or previous results.",
        required=False,
    )


class MonitorParams:
    MONITOR_SLUG = OpenApiParameter(
        name="monitor_slug",
        location="path",
        required=True,
        type=str,
        description="The slug of the monitor.",
    )
    CHECKIN_ID = OpenApiParameter(
        name="checkin_id",
        location="path",
        required=True,
        type=OpenApiTypes.UUID,
        description="The id of the check-in.",
    )


class EventParams:
    EVENT_ID = OpenApiParameter(
        name="event_id",
        location="path",
        required=True,
        type=OpenApiTypes.UUID,
        description="The id of the event.",
    )

    FRAME_IDX = OpenApiParameter(
        name="frame_idx",
        location="query",
        required=True,  # TODO: make not required
        type=int,
        description="Index of the frame that should be used for source map resolution.",
    )

    EXCEPTION_IDX = OpenApiParameter(
        name="exception_idx",
        location="query",
        required=True,
        type=int,
        description="Index of the exception that should be used for source map resolution.",
    )


class ProjectParams:
    FILTER_ID = OpenApiParameter(
        name="filter_id",
        location="path",
        required=True,
        type=str,
        description="""The type of filter toggle to update. The options are:
- `browser-extensions`: Filter out errors known to be caused by browser extensions.
- `localhost`: Filter out events coming from localhost. This applies to both IPv4 (``127.0.0.1``)
and IPv6 (``::1``) addresses.
- `filtered-transaction`: Filter out transactions for healthcheck and ping endpoints.
- `web-crawlers`: Filter out known web crawlers. Some crawlers may execute pages in incompatible
ways which then cause errors that are unlikely to be seen by a normal user.
- `legacy-browser`: Filter out known errors from legacy browsers. Older browsers often give less
accurate information, and while they may report valid issues, the context to understand them is
incorrect or missing.
""",
    )

    ACTIVE = OpenApiParameter(
        name="active",
        location="query",
        required=False,
        type=bool,
        description="Toggle the browser-extensions, localhost, filtered-transaction, or web-crawlers filter on or off.",
    )

    BROWSER_SDK_VERSION = OpenApiParameter(
        name="browserSdkVersion",
        location="query",
        required=False,
        type=str,
        description="""
The Sentry Javascript SDK version to use. The currently supported options are:
- `7.x`
- `latest`
""",
    )

    DEFAULT_RULES = OpenApiParameter(
        name="default_rules",
        location="query",
        required=False,
        type=bool,
        description="Defaults to true where the behavior is to alert the user on every new issue. Setting this to false will turn this off and the user must create their own alerts to be notified of new issues.",
    )

    DYNAMIC_SDK_LOADER_OPTIONS = OpenApiParameter(
        name="dynamicSdkLoaderOptions",
        location="query",
        required=False,
        type=inline_serializer(
            name="DynamicSDKLoaderOptionsSerializer",
            fields={
                "hasReplay": serializers.BooleanField(required=False),
                "hasPerformance": serializers.BooleanField(required=False),
                "hasDebug": serializers.BooleanField(required=False),
            },
        ),
        description="""
Configures multiple options for the Javascript Loader Script.
- `Performance Monitoring`
- `Debug Bundles & Logging`
- `Session Replay`: Note that the loader will load the ES6 bundle instead of the ES5 bundle.
```json
{
    "dynamicSdkLoaderOptions": {
        "hasReplay": true,
        "hasPerformance": true,
        "hasDebug": true
    }
}
```
""",
    )

    IS_ACTIVE = OpenApiParameter(
        name="isActive",
        location="query",
        required=False,
        type=bool,
        description="Activate or deactivate the client key.",
    )

    IS_BOOKMARKED = OpenApiParameter(
        name="isBookmarked",
        location="query",
        required=False,
        type=bool,
        description="Enables starring the project within the projects tab.",
    )

    OPTIONS = OpenApiParameter(
        name="options",
        location="query",
        required=False,
        type=inline_serializer(
            name="OptionsSerializer",
            fields={
                "filters:react-hydration-errors": serializers.BooleanField(required=False),
                "filters:blacklisted_ips": serializers.CharField(required=False),
                "filters:releases": serializers.CharField(required=False),
                "filters:error_messages": serializers.CharField(required=False),
            },
        ),
        description="""
Configure various project filters:
- `Hydration Errors`: Filter out react hydration errors that are often unactionable
- `IP Addresses`: Filter events from these IP addresses separated with newlines.
- `Releases`: Filter events from these releases separated with newlines. Allows [glob pattern matching](https://docs.sentry.io/product/data-management-settings/filtering/#glob-matching).
- `Error Message`: Filter events by error messages separated with newlines. Allows [glob pattern matching](https://docs.sentry.io/product/data-management-settings/filtering/#glob-matching).
```json
{
    options: {
        filters:react-hydration-errors: true,
        filters:blacklisted_ips: "127.0.0.1\\n192.168. 0.1"
        filters:releases: "[!3]\\n4"
        filters:error_messages: "TypeError*\\n*ConnectionError*"
    }
}
```
""",
    )

    RATE_LIMIT = OpenApiParameter(
        name="rateLimit",
        location="query",
        required=False,
        type=inline_serializer(
            name="RateLimitParameterSerializer",
            fields={
                "window": serializers.IntegerField(required=False),
                "count": serializers.IntegerField(required=False),
            },
        ),
        description="""
Applies a rate limit to cap the number of errors accepted during a given time window. To
disable entirely set `rateLimit` to null.
```json
{
    "rateLimit": {
        "window": 7200, // time in seconds
        "count": 1000 // error cap
    }
}
```
        """,
    )

    SUB_FILTERS = OpenApiParameter(
        name="subfilters",
        location="query",
        required=False,
        type=build_typed_list(OpenApiTypes.STR),
        description="""
Specifies which legacy browser filters should be active. Anything excluded from the list will be
disabled. The options are:
- `ie_pre_9`: Internet Explorer Version 8 and lower
- `ie9`: Internet Explorer Version 9
- `ie10`: Internet Explorer Version 10
- `ie11`: Internet Explorer Version 11
- `safari_pre_6`: Safari Version 5 and lower
- `opera_pre_15`: Opera Version 14 and lower
- `opera_mini_pre_8`: Opera Mini Version 8 and lower
- `android_pre_4`: Android Version 3 and lower
""",
    )

    @staticmethod
    def key_id(description: str) -> OpenApiParameter:
        return OpenApiParameter(
            name="key_id",
            location="path",
            required=True,
            type=str,
            description=description,
        )

    @staticmethod
    def platform(description: str) -> OpenApiParameter:
        return OpenApiParameter(
            name="platform",
            location="query",
            required=False,
            type=str,
            description=description,
        )


class TeamParams:
    DETAILED = OpenApiParameter(
        name="detailed",
        location="query",
        required=False,
        type=str,
        description="""
Specify `"0"` to return team details that do not include projects.
""",
    )
