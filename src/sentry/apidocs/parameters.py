from typing import Any

from drf_spectacular.plumbing import build_array_type, build_basic_type
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter
from rest_framework import serializers

from sentry.constants import SentryAppStatus
from sentry.snuba.sessions import STATS_PERIODS

# NOTE: Please add new params by path vs query, then in alphabetical order


def build_typed_list(type: Any):
    """
    drf-spectacular doesn't support a list type in it's OpenApiTypes, so we manually build
    a typed list using this workaround. build_basic_type will dynamically check the type
    and pass a warning if it can't recognize it, failing any build command in the process as well.
    """
    return build_array_type(build_basic_type(type))


class GlobalParams:
    USER_ID = OpenApiParameter(
        name="user_id",
        description="The ID of the user the resource belongs to.",
        required=True,
        type=str,
        location="path",
    )
    ORG_ID_OR_SLUG = OpenApiParameter(
        name="organization_id_or_slug",
        description="The ID or slug of the organization the resource belongs to.",
        required=True,
        type=str,
        location="path",
    )
    PROJECT_ID_OR_SLUG = OpenApiParameter(
        name="project_id_or_slug",
        description="The ID or slug of the project the resource belongs to.",
        required=True,
        type=str,
        location="path",
    )
    TEAM_ID_OR_SLUG = OpenApiParameter(
        name="team_id_or_slug",
        description="The ID or slug of the team the resource belongs to.",
        required=True,
        type=str,
        location="path",
    )
    INTEGRATION_ID = OpenApiParameter(
        name="integration_id",
        description="The ID of the integration installed on the organization.",
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

For example, `24h`, to mean query data starting from 24 hours ago to now.""",
    )
    START = OpenApiParameter(
        name="start",
        location="query",
        required=False,
        type=OpenApiTypes.DATETIME,
        description="The start of the period of time for the query, expected in ISO-8601 format. For example, `2001-12-14T12:34:56.7890`.",
    )
    END = OpenApiParameter(
        name="end",
        location="query",
        required=False,
        type=OpenApiTypes.DATETIME,
        description="The end of the period of time for the query, expected in ISO-8601 format. For example, `2001-12-14T12:34:56.7890`.",
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


class EnvironmentParams:
    ENVIRONMENT = OpenApiParameter(
        name="environment",
        location="path",
        required=True,
        type=str,
        description="The name of the environment.",
    )
    VISIBILITY = OpenApiParameter(
        name="visibility",
        location="query",
        required=False,
        type=str,
        description="""The visibility of the environments to filter by. Defaults to `visible`.""",
        enum=["all", "hidden", "visible"],
    )


class OrganizationParams:
    PROJECT_ID_OR_SLUG = OpenApiParameter(
        name="project_id_or_slug",
        location="query",
        required=False,
        many=True,
        type=str,
        description="""The project slugs to filter by. Use `$all` to include all available projects. For example, the following are valid parameters:
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
For example, the following are valid parameters:
- `/?project=1234&project=56789`
- `/?project=-1`
""",
    )
    DETAILED = OpenApiParameter(
        name="detailed",
        location="query",
        required=False,
        type=str,
        description="""
Specify `"0"` to return organization details that do not include projects or teams.
""",
    )
    OWNER = OpenApiParameter(
        name="owner",
        location="query",
        required=False,
        type=bool,
        description="""Specify `true` to restrict results to organizations in which you are an owner.""",
    )
    QUERY = OpenApiParameter(
        name="query",
        location="query",
        required=False,
        type=str,
        description="""Filters results by using [query syntax](/product/sentry-basics/search/).

Valid query fields include:
- `id`: The organization ID
- `slug`: The organization slug
- `status`: The organization's current status (one of `active`, `pending_deletion`, or `deletion_in_progress`)
- `email` or `member_id`: Filter your organizations by the emails or [organization member IDs](/api/organizations/list-an-organizations-members/) of specific members included
- `platform`: Filter your organizations to those with at least one project using this platform
- `query`: Filter your organizations by name, slug, and members that contain this substring

Example: `query=(slug:foo AND status:active) OR (email:[thing-one@example.com,thing-two@example.com] AND query:bar)`
""",
    )
    SORT_BY = OpenApiParameter(
        name="sortBy",
        location="query",
        required=False,
        type=str,
        description="""The field to sort results by, in descending order. If not specified the results are sorted by the date they were created.

Valid fields include:
- `members`: By number of members
- `projects`: By number of projects
- `events`: By number of events in the past 24 hours
""",
    )

    EXTERNAL_USER_ID = OpenApiParameter(
        name="external_user_id",
        location="path",
        required=True,
        type=int,
        description="The ID of the external user object. This is returned when creating an external user.",
    )

    EXTERNAL_TEAM_ID = OpenApiParameter(
        name="external_team_id",
        location="path",
        required=True,
        type=int,
        description="The ID of the external team object. This is returned when creating an external team.",
    )


class ReleaseParams:
    VERSION = OpenApiParameter(
        name="version",
        location="path",
        required=True,
        type=str,
        description="The version identifier of the release",
    )
    PROJECT_ID = OpenApiParameter(
        name="project_id",
        location="query",
        required=False,
        type=str,
        description="The project ID to filter by.",
    )
    HEALTH = OpenApiParameter(
        name="health",
        location="query",
        required=False,
        type=bool,
        description="Whether or not to include health data with the release. By default, this is false.",
    )
    ADOPTION_STAGES = OpenApiParameter(
        name="adoptionStages",
        location="query",
        required=False,
        type=bool,
        description="Whether or not to include adoption stages with the release. By default, this is false.",
    )
    SUMMARY_STATS_PERIOD = OpenApiParameter(
        name="summaryStatsPeriod",
        location="query",
        required=False,
        type=str,
        description="The period of time used to query summary stats for the release. By default, this is 14d.",
        enum=list(STATS_PERIODS.keys()),
    )
    HEALTH_STATS_PERIOD = OpenApiParameter(
        name="healthStatsPeriod",
        location="query",
        required=False,
        type=str,
        description="The period of time used to query health stats for the release. By default, this is 24h if health is enabled.",
        enum=list(STATS_PERIODS.keys()),
    )
    SORT = OpenApiParameter(
        name="sort",
        location="query",
        required=False,
        type=str,
        description="The field used to sort results by. By default, this is `date`.",
        enum=["date", "sessions", "users", "crash_free_users", "crash_free_sessions"],
    )
    STATUS_FILTER = OpenApiParameter(
        name="status",
        location="query",
        required=False,
        type=str,
        description="Release statuses that you can filter by.",
        enum=["open", "archived"],
    )


class SCIMParams:
    TEAM_ID = OpenApiParameter(
        name="team_id",
        location="path",
        required=True,
        type=int,
        description="The ID of the team you'd like to query / update.",
    )


class IssueParams:
    KEY = OpenApiParameter(
        name="key",
        location=OpenApiParameter.PATH,
        type=OpenApiTypes.STR,
        description="The tag key to look the values up for.",
        required=True,
    )

    ISSUES_OR_GROUPS = OpenApiParameter(
        name="var",
        location="path",
        required=False,
        type=str,
        description="Issue URLs may be accessed with either `issues` or `groups`. This parameter is will be removed when building the API docs.",
    )
    ISSUE_ID = OpenApiParameter(
        name="issue_id",
        location="path",
        required=True,
        type=int,
        description="The ID of the issue you'd like to query.",
    )

    SORT = OpenApiParameter(
        name="sort",
        location="query",
        required=False,
        type=str,
        description="Sort order of the resulting tag values. Prefix with '-' for descending order. Default is '-id'.",
        enum=["id", "date", "age", "count"],
    )


class DetectorParams:
    DETECTOR_ID = OpenApiParameter(
        name="detector_id",
        location="path",
        required=True,
        type=int,
        description="The ID of the detector you'd like to query.",
    )


class WorkflowParams:
    WORKFLOW_ID = OpenApiParameter(
        name="workflow_id",
        location="path",
        required=True,
        type=int,
        description="The ID of the workflow you'd like to query.",
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


class SentryAppParams:
    SENTRY_APP_ID_OR_SLUG = OpenApiParameter(
        name="sentry_app_id_or_slug",
        location="path",
        required=True,
        many=False,
        type=str,
        description="The ID or slug of the custom integration.",
    )


class SentryAppStatusParams:
    SENTRY_APP_STATUS = OpenApiParameter(
        name="sentry_app_status",
        location="query",
        required=False,
        many=False,
        type=int,
        description=f"The status of the custom integration, values translate to the following: {SentryAppStatus.as_choices()}",
        enum=SentryAppStatus.as_int_choices(),
    )


class VisibilityParams:
    QUERY = OpenApiParameter(
        name="query",
        location="query",
        required=False,
        type=str,
        description="""Filters results by using [query syntax](/product/sentry-basics/search/).

Example: `query=(transaction:foo AND release:abc) OR (transaction:[bar,baz] AND release:def)`
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
- An equation when prefixed with `equation|`. Read more about [equations here](/product/discover-queries/query-builder/query-equations/).
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
    MONITOR_ID_OR_SLUG = OpenApiParameter(
        name="monitor_id_or_slug",
        location="path",
        required=True,
        type=str,
        description="The ID or slug of the monitor.",
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
    OWNER = OpenApiParameter(
        name="owner",
        location="query",
        required=False,
        type=str,
        description="The owner of the monitor, in the format `user:id` or `team:id`. May be specified multiple times.",
    )
    PROCESSING_ERROR_ID = OpenApiParameter(
        name="processing_error_id",
        location="path",
        required=False,
        type=OpenApiTypes.UUID,
        description="The ID of the processing error.",
    )


class UptimeParams:
    UPTIME_ALERT_ID = OpenApiParameter(
        name="uptime_subscription_id",
        location="path",
        required=True,
        type=int,
        description="The ID of the uptime alert rule you'd like to query.",
    )
    OWNER = OpenApiParameter(
        name="owner",
        location="query",
        required=False,
        type=str,
        description="The owner of the uptime alert, in the format `user:id` or `team:id`. May be specified multiple times.",
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

    EVENT_ID_EXTENDED = OpenApiParameter(
        name="event_id",
        type=OpenApiTypes.STR,
        location=OpenApiParameter.PATH,
        description="The ID of the event to retrieve, or 'latest', 'oldest', or 'recommended'.",
        required=True,
        enum=["latest", "oldest", "recommended"],
    )

    FULL_PAYLOAD = OpenApiParameter(
        name="full",
        type=OpenApiTypes.BOOL,
        location=OpenApiParameter.QUERY,
        description="Specify true to include the full event body, including the stacktrace, in the event payload.",
        required=False,
        default=False,
    )

    SAMPLE = OpenApiParameter(
        name="sample",
        type=OpenApiTypes.BOOL,
        location=OpenApiParameter.QUERY,
        description="Return events in pseudo-random order. This is deterministic so an identical query will always return the same events in the same order.",
        required=False,
        default=False,
    )

    QUERY = OpenApiParameter(
        name="query",
        location=OpenApiParameter.QUERY,
        type=OpenApiTypes.STR,
        description="An optional search query for filtering events.",
        required=False,
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
    COLLAPSE = OpenApiParameter(
        name="collapse",
        location="query",
        required=False,
        type=str,
        description="""
List of strings to opt out of certain pieces of data. Supports `organization`.
""",
    )

    EXPAND = OpenApiParameter(
        name="expand",
        location="query",
        required=False,
        type=str,
        description="""
List of strings to opt in to additional data. Supports `projects`, `externalTeams`.
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

    SEGMENT_ID = OpenApiParameter(
        name="segment_id",
        location="path",
        required=True,
        type=OpenApiTypes.INT,
        description="""The ID of the segment you'd like to retrieve.""",
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
- `alert-rule`
- `chat-unfurl`
- `codeowners`
- `commits`
- `data-forwarding`
- `deployment`
- `enterprise-alert-rule`
- `enterprise-incident-management`
- `incident-management`
- `issue-basic`
- `issue-sync`
- `mobile`
- `serverless`
- `session-replay`
- `stacktrace-link`
- `ticket-rules`
    """,
    )
    INCLUDE_CONFIG = OpenApiParameter(
        name="includeConfig",
        location="query",
        required=False,
        type=bool,
        description="""Specify `True` to fetch third-party integration configurations. Note that this can add several seconds to the response time.""",
    )


class SessionsParams:
    FIELD = OpenApiParameter(
        name="field",
        location="query",
        required=True,
        type=str,
        many=True,
        description="""The list of fields to query.

The available fields are
- `sum(session)`
- `count_unique(user)`
- `avg`, `p50`, `p75`, `p90`, `p95`, `p99`, `max` applied to `session.duration`. For example, `p99(session.duration)`. Session duration is [no longer being recorded](https://github.com/getsentry/sentry/discussions/42716) as of on Jan 12, 2023. Returned data may be incomplete.
- `crash_rate`, `crash_free_rate` applied to `user` or `session`. For example, `crash_free_rate(user)`
""",
    )
    INTERVAL = OpenApiParameter(
        name="interval",
        location="query",
        required=False,
        type=str,
        description="""Resolution of the time series, given in the same format as `statsPeriod`.\n\nThe default and
        the minimum interval is `1h`.""",
    )
    PER_PAGE = OpenApiParameter(
        name="per_page",
        location="query",
        required=False,
        type=int,
        description="""The number of groups to return per request.""",
    )
    GROUP_BY = OpenApiParameter(
        name="groupBy",
        location="query",
        required=False,
        type=str,
        many=True,
        description="""The list of properties to group by.\n\nThe available groupBy conditions are `project`,
        `release`, `environment` and `session.status`.""",
    )
    ORDER_BY = OpenApiParameter(
        name="orderBy",
        location="query",
        required=False,
        type=str,
        description="""An optional field to order by, which must be one of the fields provided in `field`. Use `-`
        for descending order, for example, `-sum(session)`""",
    )
    INCLUDE_TOTALS = OpenApiParameter(
        name="includeTotals",
        location="query",
        required=False,
        type=int,
        description="""Specify `0` to exclude totals from the response. The default is `1`""",
    )
    INCLUDE_SERIES = OpenApiParameter(
        name="includeSeries",
        location="query",
        required=False,
        type=int,
        description="""Specify `0` to exclude series from the response. The default is `1`""",
    )


class DashboardParams:
    DASHBOARD_ID = OpenApiParameter(
        name="dashboard_id",
        location="path",
        required=True,
        type=int,
        description="""The ID of the dashboard you'd like to retrieve.""",
    )


class DiscoverSavedQueryParams:
    DISCOVER_SAVED_QUERY_ID = OpenApiParameter(
        name="query_id",
        location="path",
        required=True,
        type=int,
        description="""The ID of the Discover query you'd like to retrieve.""",
    )


class DiscoverSavedQueriesParams:
    QUERY = OpenApiParameter(
        name="query",
        location="query",
        required=False,
        type=str,
        description="""The name of the Discover query you'd like to filter by.""",
    )

    SORT = OpenApiParameter(
        name="sortBy",
        location="query",
        required=False,
        type=str,
        description="""The property to sort results by. If not specified, the results are sorted by query name.

Available fields are:
- `name`
- `dateCreated`
- `dateUpdated`
- `mostPopular`
- `recentlyViewed`
- `myqueries`
        """,
    )
