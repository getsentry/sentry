from typing import Any

from drf_spectacular.plumbing import build_array_type, build_basic_type
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter
from rest_framework import serializers

# NOTE: Please add new params by path vs query, then in alphabetical order


def build_typed_list(type: Any):
    """
    drf-spectacular doesn't support a list type in it's OpenApiTypes, so we manually build
    a typed list using this workaround. build_basic_type will dynamically check the type
    and pass a warning if it can't recognize it, failing any build command in the process as well.
    """
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
    ENVIRONMENT = OpenApiParameter(
        name="environment",
        location="query",
        required=False,
        many=True,
        type=str,
        description="The name of environments to filter by.",
    )

    @staticmethod
    def member_id(description: str) -> OpenApiParameter:
        return OpenApiParameter(
            name="member_id",
            location="path",
            required=True,
            type=str,
            description=description,
        )


class OrganizationParams:
    PROJECT_SLUG = OpenApiParameter(
        name="project_slug",
        location="query",
        required=False,
        many=True,
        type=str,
        description="""The project slugs to filter by. Use `$all` to include all available projects. For example the following are valid parameters:
- `/?projectSlug=$all`
- `/?projectSlug=android&projectSlug=javascript-react`
""",
    )
    PROJECT = OpenApiParameter(
        name="project",
        location="query",
        required=False,
        many=True,
        type=int,
        description="""The IDs of projects to filter by. `-1` means all available projects.
For example the following are valid parameters:
- `/?project=1234&project=56789`
- `/?project=-1`
""",
    )


class SCIMParams:
    TEAM_ID = OpenApiParameter(
        name="team_id",
        location="path",
        required=True,
        type=int,
        description="The ID of the team you'd like to query / update.",
    )


class IssueAlertParams:
    ISSUE_RULE_ID = OpenApiParameter(
        name="rule_id",
        location="path",
        required=True,
        type=int,
        description="The ID of the rule you'd like to query.",
    )


class MetricAlertParams:
    METRIC_RULE_ID = OpenApiParameter(
        name="alert_rule_id",
        location="path",
        required=True,
        type=int,
        description="The ID of the rule you'd like to query.",
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
        description="The ID of the check-in.",
    )
    ENVIRONMENT = OpenApiParameter(
        name="environment",
        location="path",
        required=False,
        type=str,
        description="The name of environment for the monitor environment.",
    )


class EventParams:
    EVENT_ID = OpenApiParameter(
        name="event_id",
        location="path",
        required=True,
        type=OpenApiTypes.UUID,
        description="The ID of the event.",
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
- `browser-extensions` - Filter out errors known to be caused by browser extensions.
- `localhost` - Filter out events coming from localhost. This applies to both IPv4 (``127.0.0.1``)
and IPv6 (``::1``) addresses.
- `filtered-transaction` - Filter out transactions for healthcheck and ping endpoints.
- `web-crawlers` - Filter out known web crawlers. Some crawlers may execute pages in incompatible
ways which cause errors that are unlikely to be seen by a normal user.
- `legacy-browser` - Filter out known errors from legacy browsers. Older browsers often give less
accurate information, and while they may report valid issues, the context to understand them is
incorrect or missing.
""",
    )

    STATUS = OpenApiParameter(
        name="status",
        location="query",
        required=False,
        type=str,
        description="""
Filter client keys by `active` or `inactive`. Defaults to returning all
keys if not specified.
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
    def source_id(description: str, required: bool) -> OpenApiParameter:
        return OpenApiParameter(
            name="id",
            location="query",
            required=required,
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


class ReplayParams:
    REPLAY_ID = OpenApiParameter(
        name="replay_id",
        location="path",
        required=True,
        type=OpenApiTypes.UUID,
        description="""The ID of the replay you'd like to retrieve.""",
    )


class NotificationParams:
    TRIGGER_TYPE = OpenApiParameter(
        name="triggerType",
        location="query",
        required=False,
        type=str,
        description="Type of the trigger that causes the notification. The only supported value right now is: `spike-protection`",
    )
    ACTION_ID = OpenApiParameter(
        name="action_id",
        location="path",
        required=True,
        type=int,
        description="ID of the notification action to retrieve",
    )


class IntegrationParams:
    PROVIDER_KEY = OpenApiParameter(
        name="providerKey",
        location="query",
        required=False,
        type=str,
        description="""Specific integration provider to filter by such as `slack`. See our [Integrations Documentation](/product/integrations/) for an updated list of providers.""",
    )
    FEATURES = OpenApiParameter(
        name="features",
        location="query",
        required=False,
        type=str,
        many=True,
        description="""Integration features to filter by. See our [Integrations Documentation](/product/integrations/) for an updated list of features. Current available ones are:
- alert-rule
- chat-unfurl
- codeowners
- commits
- data-forwarding
- deployment
- enterprise-alert-rule
- enterprise-incident-management
- incident-management
- issue-basic
- issue-sync
- mobile
- serverless
- session-replay
- stacktrace-link
- ticket-rules
    """,
    )
    INCLUDE_CONFIG = OpenApiParameter(
        name="includeConfig",
        location="query",
        required=False,
        type=bool,
        description="""Specify `True` to fetch third-party integration configurations. Note that this can add several seconds to the response time.""",
    )
