from __future__ import annotations

from collections import defaultdict
from collections.abc import Collection, Iterable, Mapping, MutableMapping, Sequence
from datetime import datetime, timedelta
from types import ModuleType
from typing import TYPE_CHECKING, Annotated, Any, Final, NotRequired, Protocol, TypedDict, cast

import orjson
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.db import connection
from django.db.models import prefetch_related_objects
from django.utils import timezone
from sentry_sdk import traces
from sentry_sdk.traces import StreamedSpan

from sentry import features, options, projectoptions, quotas, release_health, roles
from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.team import get_org_roles
from sentry.apidocs.descriptions import ApiDescription
from sentry.apidocs.formats import NumericId, Slug, numeric_id, slug
from sentry.app import env
from sentry.auth.access import Access
from sentry.auth.principal import has_user
from sentry.auth.superuser import is_active_superuser
from sentry.conf.types.sentry_config import SentryMode
from sentry.constants import ObjectStatus, StatsPeriod
from sentry.digests import backend as digests
from sentry.dynamic_sampling.utils import has_dynamic_sampling
from sentry.features.base import ProjectFeature
from sentry.ingest import legacy_filter_lists
from sentry.ingest.inbound_filters import FilterTypes
from sentry.issues.highlights import HighlightPreset, get_highlight_preset_for_project
from sentry.lang.native.sources import parse_sources, redact_source_secrets
from sentry.lang.native.utils import convert_crashreport_count
from sentry.models.environment import Environment, EnvironmentProject
from sentry.models.options.project_option import OPTION_KEYS, ProjectOption
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.project import Project
from sentry.models.projectbookmark import ProjectBookmark
from sentry.models.projectplatform import ProjectPlatform
from sentry.models.projectteam import ProjectTeam
from sentry.models.release import Release
from sentry.models.userreport import UserReport
from sentry.release_health.base import CurrentAndPreviousCrashFreeRate
from sentry.roles import organization_roles
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.services.eventstore.models import DEFAULT_SUBJECT_TEMPLATE
from sentry.snuba import discover
from sentry.snuba.spans_rpc import Spans
from sentry.tempest.utils import has_tempest_access
from sentry.users.api.serializers.user import SerializedAvatarFields
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser

if TYPE_CHECKING:
    from sentry.api.serializers.models.organization import OrganizationSummarySerializerResponse

STATUS_LABELS = {
    ObjectStatus.ACTIVE: "active",
    ObjectStatus.DISABLED: "deleted",
    ObjectStatus.PENDING_DELETION: "deleted",
    ObjectStatus.DELETION_IN_PROGRESS: "deleted",
}

STATS_PERIOD_CHOICES = {
    "90d": StatsPeriod(90, timedelta(days=1)),
    "30d": StatsPeriod(30, timedelta(hours=24)),
    "14d": StatsPeriod(14, timedelta(hours=24)),
    "7d": StatsPeriod(7, timedelta(hours=24)),
    "24h": StatsPeriod(24, timedelta(hours=1)),
    "1h": StatsPeriod(60, timedelta(minutes=1)),
}

_PROJECT_SCOPE_PREFIX = "projects:"

# Transactions live in the spans dataset as 'segment' spans, so counting them means
# counting spans matching `is_transaction:true` (might change later to is_segment)
TRANSACTION_STATS_QUERY = "is_transaction:true"
TRANSACTION_STATS_COUNT = "count(span.duration)"

LATEST_DEPLOYS_KEY: Final = "latestDeploys"
UNUSED_ON_FRONTEND_FEATURES: Final = "unusedFeatures"
ORGANIZATION_KEY: Final = "organization"


# These features are not used on the frontend,
# and add a lot of latency ~100-300ms per flag for large organizations
# so we exclude them from the response if the unusedFeatures collapse parameter is set
PROJECT_FEATURES_NOT_USED_ON_FRONTEND = {
    "discard-transaction",
    "first-event-severity-calculation",
    "servicehooks",
    "similarity-embeddings",
}


class CrashFreeRatesWithHealthData(CurrentAndPreviousCrashFreeRate):
    hasHealthData: Annotated[
        bool, ApiDescription("Whether the project has release health (session) data")
    ]


def _get_team_memberships(
    team_list: Collection[int], user: User | RpcUser | AnonymousUser
) -> list[OrganizationMemberTeam]:
    """Get memberships the user has in the provided team list"""
    if not has_user(user):
        return []

    return list(
        OrganizationMemberTeam.objects.filter(
            organizationmember__user_id=user.id, team__in=team_list
        ).select_related("organizationmember__organization")
    )


def get_access_by_project(
    projects: Sequence[Project], user: User | RpcUser | AnonymousUser
) -> dict[Project, dict[str, object]]:
    request = env.request

    project_teams = ProjectTeam.objects.filter(project__in=projects).values_list(
        "project_id", "team_id"
    )

    project_to_teams = defaultdict(list)
    teams_set: set[int] = set()
    for project_id, team_id in project_teams:
        project_to_teams[project_id].append(team_id)
        teams_set.add(team_id)

    team_memberships = _get_team_memberships(teams_set, user)

    memberships_by_team: dict[int, OrganizationMemberTeam] = {
        m.team_id: m for m in team_memberships
    }

    org_ids = {i.organization_id for i in projects}
    org_roles = get_org_roles(org_ids, user)
    is_superuser = request and is_active_superuser(request) and request.user == user
    prefetch_related_objects(projects, "organization")

    result: dict[Project, dict[str, object]] = {}
    has_team_roles_cache: dict[int, bool] = {}
    with traces.start_span(
        name="project.check-access", attributes={"sentry.op": "project.check-access"}
    ):
        for project in projects:
            member_teams = [
                memberships_by_team[tid]
                for tid in project_to_teams.get(project.id, ())
                if tid in memberships_by_team
            ]
            is_member = any(member_teams)
            org_role = org_roles.get(project.organization_id)

            has_access = bool(
                is_member
                or is_superuser
                or project.organization.flags.allow_joinleave
                or (org_role and roles.get(org_role).is_global)
            )

            team_scopes: set[str] = set()

            if has_access:
                # Project can be the child of several Teams, and the User can join
                # several Teams and receive roles at each of them,
                for member in member_teams:
                    team_scopes |= member.get_scopes(has_team_roles_cache)

                if is_superuser:
                    org_role = organization_roles.get_top_dog().id

                if org_role:
                    minimum_team_role = roles.get_minimum_team_role(org_role)
                    team_scopes |= minimum_team_role.scopes

            result[project] = {
                "is_member": is_member,
                "has_access": has_access,
                "access": team_scopes,
            }
    return result


def get_environments_by_projects(projects: Sequence[Project]) -> MutableMapping[int, list[str]]:
    project_envs = (
        EnvironmentProject.objects.filter(
            project_id__in=[i.id for i in projects],
            # Including the organization_id is necessary for postgres to use indexes
            # efficiently.
            environment__organization_id=projects[0].organization_id,
        )
        .exclude(
            is_hidden=True,
            # HACK(lb): avoiding the no environment value
        )
        .exclude(environment__name="")
        .values("project_id", "environment__name")
    )

    environments_by_project = defaultdict(list)
    for project_env in project_envs:
        environments_by_project[project_env["project_id"]].append(project_env["environment__name"])

    return environments_by_project


def get_features_for_projects(
    all_projects: Sequence[Project],
    user: User | RpcUser | AnonymousUser,
    filter_unused_on_frontend_features: bool = False,
) -> MutableMapping[Project, list[str]]:
    # Arrange to call features.has_for_batch rather than features.has
    # for performance's sake
    projects_by_org = defaultdict(list)
    for project in all_projects:
        projects_by_org[project.organization].append(project)

    features_by_project = defaultdict(list)
    project_features = [
        feature
        for feature in features.all(feature_type=ProjectFeature).keys()
        if feature.startswith(_PROJECT_SCOPE_PREFIX)
    ]
    if filter_unused_on_frontend_features:
        project_features = [
            feature
            for feature in project_features
            if feature[len(_PROJECT_SCOPE_PREFIX) :] not in PROJECT_FEATURES_NOT_USED_ON_FRONTEND
        ]

    batch_checked = set()
    for organization, projects in projects_by_org.items():
        batch_features = features.batch_has(
            project_features, actor=user, projects=projects, organization=organization
        )

        # batch_has has found some features
        if batch_features:
            for project in projects:
                for feature_name, active in batch_features.get(f"project:{project.id}", {}).items():
                    if active:
                        features_by_project[project].append(
                            feature_name[len(_PROJECT_SCOPE_PREFIX) :]
                        )

                    batch_checked.add(feature_name)

    for feature_name in project_features:
        if feature_name in batch_checked:
            continue
        abbreviated_feature = feature_name[len(_PROJECT_SCOPE_PREFIX) :]
        for organization, projects in projects_by_org.items():
            result = features.has_for_batch(feature_name, organization, projects, user)
            for project, flag in result.items():
                if flag:
                    features_by_project[project].append(abbreviated_feature)

    for project in all_projects:
        if project.flags.has_releases:
            features_by_project[project].append("releases")

    return features_by_project


# Determines hasLogs based on SENTRY_MODE for SAAS use flags, otherwise (single tenant and self hosted) skip onboarding
# This is because has_logs is currently set via the outcomes consumer, which doesn't run in all envs.
def get_has_logs(project: Project) -> bool:
    if settings.SENTRY_MODE == SentryMode.SAAS:
        return bool(project.flags.has_logs)
    return True


# Determines hasTraceMetrics based on SENTRY_MODE for SAAS use flags, otherwise (single tenant and self hosted) skip onboarding
# This is because has_trace_metrics is currently set via the outcomes consumer, which doesn't run in all envs.
def get_has_trace_metrics(project: Project) -> bool:
    if settings.SENTRY_MODE == SentryMode.SAAS:
        return bool(project.flags.has_trace_metrics)
    return True


class _ProjectSerializerOptionalBaseResponse(TypedDict, total=False):
    stats: Annotated[
        list[tuple[int, int]] | dict[str, int],
        ApiDescription(
            "Counts of non-transaction events per interval over the requested stats period, as [timestamp, count] pairs. Only included when a stats period is requested"
        ),
    ]
    transactionStats: Annotated[
        list[tuple[int, int]],
        ApiDescription(
            "Counts of transactions per interval over the requested stats period, as [timestamp, count] pairs. Only included when transaction stats are requested"
        ),
    ]
    sessionStats: Annotated[
        CrashFreeRatesWithHealthData,
        ApiDescription(
            "Crash-free session rates for the current and previous stats period. Only included when session stats are requested"
        ),
    ]


class ProjectSerializerBaseResponse(_ProjectSerializerOptionalBaseResponse):
    id: Annotated[NumericId, ApiDescription("ID of the project")]
    slug: Annotated[Slug, ApiDescription("Slug of the project")]
    # TODO: add deprecation about this field (not used in app)
    name: Annotated[str, ApiDescription("Name of the project")]
    platform: Annotated[str | None, ApiDescription("Platform of the project")]
    dateCreated: Annotated[datetime, ApiDescription("When the project was created (ISO 8601)")]
    isBookmarked: Annotated[
        bool, ApiDescription("Whether the requesting user bookmarked the project")
    ]
    isMember: Annotated[
        bool,
        ApiDescription(
            "Whether the requesting user is a member of a team with access to the project"
        ),
    ]
    features: Annotated[list[str], ApiDescription("Features enabled for the project")]
    firstEvent: Annotated[
        datetime | None, ApiDescription("When the project received its first event (ISO 8601)")
    ]
    firstTransactionEvent: Annotated[
        bool, ApiDescription("Whether the project has sent transactions")
    ]
    access: Annotated[
        list[str],
        ApiDescription(
            "Scopes the requesting user has on the project through team membership and organization role"
        ),
    ]
    hasAccess: Annotated[
        bool, ApiDescription("Whether the requesting user has access to the project")
    ]
    hasFeedbacks: Annotated[bool, ApiDescription("Whether the project has sent user feedback")]
    hasFlags: Annotated[bool, ApiDescription("Whether the project has sent feature flags")]
    hasMinifiedStackTrace: Annotated[
        bool, ApiDescription("Whether the project has sent an event with a minified stack trace")
    ]
    hasMonitors: Annotated[bool, ApiDescription("Whether the project has cron monitors")]
    hasNewFeedbacks: Annotated[
        bool,
        ApiDescription("Whether the project has sent user feedback from the user feedback widget"),
    ]
    hasProfiles: Annotated[bool, ApiDescription("Whether the project has sent profiles")]
    hasReplays: Annotated[bool, ApiDescription("Whether the project has sent replays")]
    hasSessions: Annotated[bool, ApiDescription("Whether the project has sent sessions")]
    hasInsightsHttp: Annotated[
        bool, ApiDescription("Whether the project has sent HTTP request spans used by Insights")
    ]
    hasInsightsDb: Annotated[
        bool, ApiDescription("Whether the project has sent database spans used by Insights")
    ]
    hasInsightsAssets: Annotated[
        bool, ApiDescription("Whether the project has sent asset spans used by Insights")
    ]
    hasInsightsAppStart: Annotated[
        bool, ApiDescription("Whether the project has sent app start spans used by Insights")
    ]
    hasInsightsScreenLoad: Annotated[
        bool, ApiDescription("Whether the project has sent screen load spans used by Insights")
    ]
    hasInsightsVitals: Annotated[
        bool, ApiDescription("Whether the project has sent web vitals spans used by Insights")
    ]
    hasInsightsCaches: Annotated[
        bool, ApiDescription("Whether the project has sent cache spans used by Insights")
    ]
    hasInsightsQueues: Annotated[
        bool, ApiDescription("Whether the project has sent queue spans used by Insights")
    ]
    hasInsightsAgentMonitoring: Annotated[
        bool, ApiDescription("Whether the project has sent AI agent spans used by Insights")
    ]
    hasInsightsMCP: Annotated[
        bool, ApiDescription("Whether the project has sent MCP spans used by Insights")
    ]
    hasLogs: Annotated[
        bool, ApiDescription("Whether the project has sent logs. Always true outside sentry.io")
    ]
    hasTraceMetrics: Annotated[
        bool,
        ApiDescription("Whether the project has sent trace metrics. Always true outside sentry.io"),
    ]


class ProjectSerializerResponse(ProjectSerializerBaseResponse):
    isInternal: Annotated[
        bool, ApiDescription("Whether this is the Sentry install's own internal project")
    ]
    isPublic: Annotated[bool, ApiDescription("Whether the project is public")]
    avatar: Annotated[
        SerializedAvatarFields, ApiDescription("Avatar of the project. Always a letter avatar")
    ]
    color: Annotated[
        str,
        ApiDescription(
            "Hex color code for the project, derived from its slug unless set explicitly"
        ),
    ]
    # TODO: enum/literal
    status: Annotated[str, ApiDescription("Status of the project: active, deleted, or unknown")]


@register(Project)
class ProjectSerializer(Serializer):
    """
    This is primarily used to summarize projects. We utilize it when doing bulk loads for things
    such as "show all projects for this organization", and its attributes be kept to a minimum.
    """

    dataset: ModuleType

    def __init__(
        self,
        environment_id: str | None = None,
        stats_period: str | None = None,
        expand: Iterable[str] | None = None,
        expand_context: Mapping[str, Any] | None = None,
        collapse: Iterable[str] | None = None,
        dataset: Any | None = None,
    ) -> None:
        if stats_period is not None:
            assert stats_period in STATS_PERIOD_CHOICES

        if dataset is None:
            self.dataset = discover
        else:
            self.dataset = dataset

        self.environment_id = environment_id
        self.stats_period = stats_period
        self.expand = expand
        self.expand_context = expand_context or {}
        self.collapse = collapse

    def _expand(self, key: str) -> bool:
        if self.expand is None:
            return False

        return key in self.expand

    def _collapse(self, key: str) -> bool:
        if self.collapse is None:
            return False
        return key in self.collapse

    def get_attrs(
        self, item_list: Sequence[Project], user: User | RpcUser | AnonymousUser, **kwargs: object
    ) -> dict[Project, dict[str, object]]:
        def measure_span(op_tag: str) -> StreamedSpan:
            span = traces.start_span(
                name=f"serialize.get_attrs.project.{op_tag}",
                attributes={
                    "sentry.op": f"serialize.get_attrs.project.{op_tag}",
                    "Object Count": len(item_list),
                },
            )
            return span

        with measure_span("preamble"):
            project_ids = [i.id for i in item_list]
            if has_user(user) and item_list:
                bookmarks = set(
                    ProjectBookmark.objects.filter(
                        user_id=user.id, project_id__in=project_ids
                    ).values_list("project_id", flat=True)
                )
            else:
                bookmarks = set()

        with measure_span("stats"):
            stats = None
            transaction_stats = None
            session_stats = None
            project_ids = [o.id for o in item_list]

            if self.stats_period:
                stats = self.get_stats(item_list, "!event.type:transaction")
                if self._expand("transaction_stats"):
                    transaction_stats = self.get_transaction_stats(item_list)
                if self._expand("session_stats"):
                    session_stats = self.get_session_stats(project_ids)

        with measure_span("options"):
            options = None
            if self._expand("options"):
                options = self.get_options(item_list)

        project_ids = [i.id for i in item_list]
        platforms = ProjectPlatform.objects.filter(project_id__in=project_ids).values_list(
            "project_id", "platform"
        )
        platforms_by_project = defaultdict(list)
        for project_id, platform in platforms:
            platforms_by_project[project_id].append(platform)

        with measure_span("access"):
            result = get_access_by_project(item_list, user)

        with measure_span("features"):
            features_by_project = get_features_for_projects(
                item_list, user, self._collapse(UNUSED_ON_FRONTEND_FEATURES)
            )
            for project, serialized in result.items():
                serialized["features"] = features_by_project[project]

        with measure_span("other"):
            for project, serialized in result.items():
                serialized.update(
                    {
                        "is_bookmarked": project.id in bookmarks,
                        "platforms": platforms_by_project[project.id],
                    }
                )
                if stats:
                    serialized["stats"] = stats[project.id]
                if transaction_stats:
                    serialized["transactionStats"] = transaction_stats[project.id]
                if session_stats:
                    serialized["sessionStats"] = session_stats[project.id]
                if options:
                    serialized["options"] = options[project.id]
        return result

    def get_stats(
        self, projects: Sequence[Project], query: str
    ) -> dict[int, list[tuple[int, int]]]:
        assert self.stats_period is not None
        # we need to compute stats at 1d (1h resolution), and 14d
        segments, interval = STATS_PERIOD_CHOICES[self.stats_period]
        now = timezone.now()

        snuba_params = SnubaParams(
            projects=projects,
            start=now - ((segments - 1) * interval),
            end=now,
        )
        if self.environment_id:
            query = f"{query} environment:{self.environment_id}"

        # Generate a query result to skip the top_events.find query
        top_events = {"data": [{"project_id": p.id} for p in projects]}
        stats = self.dataset.top_events_timeseries(
            timeseries_columns=["count()"],
            selected_columns=["project_id"],
            user_query=query,
            snuba_params=snuba_params,
            orderby="project_id",
            rollup=int(interval.total_seconds()),
            limit=10000,
            organization=None,
            referrer="api.serializer.projects.get_stats",
            top_events=top_events,
        )
        results = {}
        for project in projects:
            serialized = []
            str_id = str(project.id)
            if str_id in stats:
                for item in stats[str_id].data["data"]:
                    serialized.append((item["time"], item.get("count", 0)))
            results[project.id] = serialized
        return results

    def get_transaction_stats(
        self, projects: Sequence[Project]
    ) -> dict[int, list[tuple[int, int]]]:
        """Transaction counts can only come from the spans dataset now with is_transaction:true"""
        assert self.stats_period is not None
        segments, interval = STATS_PERIOD_CHOICES[self.stats_period]
        now = timezone.now()
        rollup = int(interval.total_seconds())
        start = now - ((segments - 1) * interval)

        snuba_params = SnubaParams(
            projects=projects,
            environments=(
                list(Environment.objects.filter(id=self.environment_id))
                if self.environment_id
                else []
            ),
            start=start,
            end=now,
            granularity_secs=rollup,
        )

        stats = Spans.run_top_events_timeseries_query(
            params=snuba_params,
            query_string=TRANSACTION_STATS_QUERY,
            y_axes=[TRANSACTION_STATS_COUNT],
            raw_groupby=["project.id"],
            orderby=[f"-{TRANSACTION_STATS_COUNT}"],
            limit=len(projects),
            include_other=False,
            referrer="api.serializer.projects.get_transaction_stats",
            config=SearchResolverConfig(),
            sampling_mode=None,
        )

        # The spans query drops projects without transactions entirely, but callers expect
        # every project to come back with a full series.
        empty_series = [
            (item["time"], 0) for item in discover.zerofill([], start, now, rollup, ["time"])
        ]

        results = {}
        for project in projects:
            str_id = str(project.id)
            if str_id in stats:
                results[project.id] = [
                    (item["time"], item.get(TRANSACTION_STATS_COUNT) or 0)
                    for item in stats[str_id].data["data"]
                ]
            else:
                results[project.id] = list(empty_series)
        return results

    def get_session_stats(
        self, project_ids: Sequence[int]
    ) -> dict[int, CrashFreeRatesWithHealthData]:
        assert self.stats_period is not None
        segments, interval = STATS_PERIOD_CHOICES[self.stats_period]

        now = timezone.now()
        current_interval_start = now - (segments * interval)
        previous_interval_start = now - (2 * segments * interval)

        project_health_data_dict = release_health.backend.get_current_and_previous_crash_free_rates(
            project_ids=project_ids,
            current_start=current_interval_start,
            current_end=now,
            previous_start=previous_interval_start,
            previous_end=current_interval_start,
            rollup=int(interval.total_seconds()),
        )

        # list that contains ids of projects that has both `currentCrashFreeRate` and
        # `previousCrashFreeRate` set to None and so we are not sure if they have health data or
        # not and so we add those ids to this list to check later
        check_has_health_data_ids = []

        ret: dict[int, CrashFreeRatesWithHealthData] = {}
        for project_id, data in project_health_data_dict.items():
            current = data["currentCrashFreeRate"]
            previous = data["previousCrashFreeRate"]

            if (current, previous) != (None, None):
                ret[project_id] = {**data, "hasHealthData": True}
            else:
                ret[project_id] = {**data, "hasHealthData": False}
                check_has_health_data_ids.append(project_id)

        # For project ids we are not sure if they have health data in the last 90 days we
        # call -> check_has_data with those ids and then update our `project_health_data_dict`
        # accordingly
        if check_has_health_data_ids:
            projects_with_health_data = release_health.backend.check_has_health_data(
                check_has_health_data_ids
            )
            for project_id in projects_with_health_data:
                ret[project_id]["hasHealthData"] = True

        return ret

    def get_options(self, projects: Sequence[Project]) -> dict[int, dict[str, object]]:
        # no options specified
        option_list: list[str] = []

        # must be a safe key
        if self.expand_context.get("options"):
            option_list = [
                option for option in self.expand_context["options"] if option in OPTION_KEYS
            ]

        queryset = ProjectOption.objects.filter(project__in=projects, key__in=option_list)

        options_by_project: dict[int, dict[str, object]] = defaultdict(dict)
        for option in queryset:
            options_by_project[option.project_id][option.key] = option.value

        return options_by_project

    def serialize(
        self,
        obj: Project,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> ProjectSerializerResponse:
        status_label = STATUS_LABELS.get(obj.status, "unknown")

        context: ProjectSerializerResponse = {
            "id": numeric_id(obj.id),
            "slug": slug(obj.slug),
            "name": obj.name,  # Deprecated
            "platform": obj.platform,
            "dateCreated": obj.date_added,
            "isBookmarked": attrs["is_bookmarked"],
            "isMember": attrs["is_member"],
            "features": attrs["features"],
            "firstEvent": obj.first_event,
            "firstTransactionEvent": bool(obj.flags.has_transactions),
            "access": sorted(attrs["access"]),
            "hasAccess": attrs["has_access"],
            "hasMinifiedStackTrace": bool(obj.flags.has_minified_stack_trace),
            "hasMonitors": bool(obj.flags.has_cron_monitors),
            "hasProfiles": bool(obj.flags.has_profiles),
            "hasReplays": bool(obj.flags.has_replays),
            "hasFeedbacks": bool(obj.flags.has_feedbacks),
            "hasFlags": bool(obj.flags.has_flags),
            "hasNewFeedbacks": bool(obj.flags.has_new_feedbacks),
            "hasSessions": bool(obj.flags.has_sessions),
            # whether first span has been sent for each insight module
            "hasInsightsHttp": bool(obj.flags.has_insights_http),
            "hasInsightsDb": bool(obj.flags.has_insights_db),
            "hasInsightsAssets": bool(obj.flags.has_insights_assets),
            "hasInsightsAppStart": bool(obj.flags.has_insights_app_start),
            "hasInsightsScreenLoad": bool(obj.flags.has_insights_screen_load),
            "hasInsightsVitals": bool(obj.flags.has_insights_vitals),
            "hasInsightsCaches": bool(obj.flags.has_insights_caches),
            "hasInsightsQueues": bool(obj.flags.has_insights_queues),
            "hasInsightsAgentMonitoring": bool(obj.flags.has_insights_agent_monitoring),
            "hasInsightsMCP": bool(obj.flags.has_insights_mcp),
            "hasLogs": get_has_logs(obj),
            "hasTraceMetrics": get_has_trace_metrics(obj),
            "isInternal": obj.is_internal_project(),
            "isPublic": obj.public,
            # Projects don't have avatar uploads, but we need to maintain the payload shape for
            # compatibility.
            "avatar": {"avatarType": "letter_avatar", "avatarUuid": None},
            "color": obj.color,
            "status": status_label,
        }
        if "stats" in attrs:
            context["stats"] = attrs["stats"]
        if "transactionStats" in attrs:
            context["transactionStats"] = attrs["transactionStats"]
        if "sessionStats" in attrs:
            context["sessionStats"] = attrs["sessionStats"]
        return context


class ProjectWithOrganizationResponse(ProjectSerializerResponse):
    organization: OrganizationSummarySerializerResponse


class ProjectWithOrganizationSerializer(ProjectSerializer):
    def get_attrs(
        self, item_list: Sequence[Project], user: User | RpcUser | AnonymousUser, **kwargs: object
    ) -> dict[Project, dict[str, object]]:
        attrs = super().get_attrs(item_list, user)

        orgs = {d["id"]: d for d in serialize(list({i.organization for i in item_list}), user)}
        for item in item_list:
            attrs[item]["organization"] = orgs[str(item.organization_id)]
        return attrs

    def serialize(
        self,
        obj: Project,
        attrs: Mapping[str, object],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> ProjectWithOrganizationResponse:
        base = super().serialize(obj, attrs, user)
        organization = cast("OrganizationSummarySerializerResponse", attrs["organization"])
        return {**base, "organization": organization}


class TeamResponseDict(TypedDict):
    id: Annotated[NumericId, ApiDescription("ID of the team")]
    name: Annotated[str, ApiDescription("Name of the team")]
    slug: Annotated[Slug, ApiDescription("Slug of the team")]


class _MaybeTeam(TypedDict, total=False):
    team: Annotated[
        TeamResponseDict, ApiDescription("First team with access to the project; use teams instead")
    ]


class ProjectWithTeamResponseDict(ProjectSerializerResponse, _MaybeTeam):
    teams: Annotated[list[TeamResponseDict], ApiDescription("Teams with access to the project")]


class ProjectWithTeamSerializer(ProjectSerializer):
    def get_attrs(
        self, item_list: Sequence[Project], user: User | RpcUser | AnonymousUser, **kwargs: object
    ) -> dict[Project, dict[str, object]]:
        attrs = super().get_attrs(item_list, user)

        project_teams = list(
            ProjectTeam.objects.filter(project__in=item_list).select_related("team")
        )

        teams = {
            pt.team_id: {
                "id": numeric_id(pt.team.id),
                "slug": slug(pt.team.slug),
                "name": pt.team.name,
            }
            for pt in project_teams
        }

        teams_by_project_id = defaultdict(list)
        for pt in project_teams:
            teams_by_project_id[pt.project_id].append(teams[pt.team_id])

        for item in item_list:
            attrs[item]["teams"] = teams_by_project_id[item.id]
        return attrs

    def serialize(
        self,
        obj: Project,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> ProjectWithTeamResponseDict:
        base = super().serialize(obj, attrs, user)
        # TODO(jess): remove this when this is deprecated
        try:
            extra: _MaybeTeam = {"team": attrs["teams"][0]}
        except IndexError:
            extra = {}
        return {**base, **extra, "teams": attrs["teams"]}


class LatestReleaseDict(TypedDict):
    version: Annotated[str, ApiDescription("Version of the release")]


class _OrganizationProjectOptionalResponse(TypedDict, total=False):
    latestDeploys: Annotated[
        dict[str, dict[str, str]] | None,
        ApiDescription(
            "Latest deploy for each environment, keyed by environment name, with its release version and finish time. Omitted when collapsed"
        ),
    ]
    options: Annotated[
        dict[str, object],
        ApiDescription(
            "Requested project options, keyed by option name. Only included when options are requested"
        ),
    ]


class OrganizationProjectResponse(
    _OrganizationProjectOptionalResponse, ProjectSerializerBaseResponse
):
    team: Annotated[
        TeamResponseDict | None,
        ApiDescription("First team with access to the project; use teams instead"),
    ]
    teams: Annotated[list[TeamResponseDict], ApiDescription("Teams with access to the project")]
    platforms: Annotated[list[str], ApiDescription("Platforms seen in the project's events")]
    hasUserReports: Annotated[bool, ApiDescription("Whether the project has received user reports")]
    environments: Annotated[list[str], ApiDescription("Environments seen in the project's events")]
    latestRelease: Annotated[
        LatestReleaseDict | None, ApiDescription("Latest release of the project")
    ]


class _DeployDict(TypedDict):
    version: str
    dateFinished: datetime


class ProjectSummarySerializer(ProjectWithTeamSerializer):
    def __init__(self, access: Access | None = None, **kwargs: Any) -> None:
        self.access = access
        super().__init__(**kwargs)

    def get_deploys_by_project(
        self, item_list: Sequence[Project]
    ) -> dict[int, dict[str, _DeployDict]]:
        cursor = connection.cursor()
        cursor.execute(
            """
            select srpe.project_id, se.name, sr.version, date_finished
            from (
                select *
                -- Finally, filter to the top row for each project/environment.
                from (
                    -- Next we join to deploys and rank based recency of latest deploy for each project/environment.
                    select srpe.project_id, srpe.release_id, srpe.environment_id, sd.date_finished,
                    row_number() OVER (partition by (srpe.project_id, srpe.environment_id) order by sd.date_finished desc) row_num
                    from
                    (
                        -- First we fetch all related ReleaseProjectEnvironments, then filter to the x most recent for
                        -- each project/environment that actually have a deploy. This cuts out a lot of data volume
                        select *
                        from (
                            select *, row_number() OVER (partition by (srpe.project_id, srpe.environment_id) order by srpe.id desc) row_num
                            from sentry_releaseprojectenvironment srpe
                            where srpe.last_deploy_id is not null
                            and project_id = ANY(%s)
                        ) srpe
                        where row_num <= %s
                    ) srpe
                    inner join sentry_deploy sd on sd.id = srpe.last_deploy_id
                    where sd.date_finished is not null
                ) srpe
                where row_num = 1
            ) srpe
            inner join sentry_release sr on sr.id = srpe.release_id
            inner join sentry_environment se on se.id = srpe.environment_id;
            """,
            ([p.id for p in item_list], 10),
        )
        deploys_by_project: dict[int, dict[str, _DeployDict]] = defaultdict(dict)

        for project_id, env_name, release_version, date_finished in cursor.fetchall():
            deploys_by_project[project_id][env_name] = {
                "version": release_version,
                "dateFinished": date_finished,
            }

        return deploys_by_project

    def get_attrs(
        self, item_list: Sequence[Project], user: User | RpcUser | AnonymousUser, **kwargs: object
    ) -> dict[Project, dict[str, object]]:
        attrs = super().get_attrs(item_list, user)

        projects_with_user_reports = set(
            UserReport.objects.filter(project_id__in=[item.id for item in item_list]).values_list(
                "project_id", flat=True
            )
        )

        environments_by_project = get_environments_by_projects(item_list)

        # Only fetch the latest release version key for each project to cut down on response size
        latest_release_versions = _get_project_to_release_version_mapping(item_list)

        if not self._collapse(LATEST_DEPLOYS_KEY):
            deploys_by_project = self.get_deploys_by_project(item_list)
        else:
            deploys_by_project = {}

        for item in item_list:
            attrs[item]["latest_release"] = latest_release_versions.get(item.id)
            attrs[item]["environments"] = environments_by_project.get(item.id, [])
            attrs[item]["has_user_reports"] = item.id in projects_with_user_reports
            if not self._collapse(LATEST_DEPLOYS_KEY):
                attrs[item]["deploys"] = deploys_by_project.get(item.id)

        return attrs

    def serialize(  # type: ignore[override]  # intentionally different data shape
        self,
        obj: Project,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> OrganizationProjectResponse:
        context = OrganizationProjectResponse(
            team=attrs["teams"][0] if attrs["teams"] else None,
            teams=attrs["teams"],
            id=numeric_id(obj.id),
            name=obj.name,
            slug=slug(obj.slug),
            isBookmarked=attrs["is_bookmarked"],
            isMember=attrs["is_member"],
            access=sorted(attrs["access"]),
            hasAccess=attrs["has_access"],
            dateCreated=obj.date_added,
            environments=attrs["environments"],
            features=attrs["features"],
            firstEvent=obj.first_event,
            firstTransactionEvent=bool(obj.flags.has_transactions),
            hasSessions=bool(obj.flags.has_sessions),
            hasProfiles=bool(obj.flags.has_profiles),
            hasReplays=bool(obj.flags.has_replays),
            hasFeedbacks=bool(obj.flags.has_feedbacks),
            hasNewFeedbacks=bool(obj.flags.has_new_feedbacks),
            hasMonitors=bool(obj.flags.has_cron_monitors),
            hasMinifiedStackTrace=bool(obj.flags.has_minified_stack_trace),
            # whether first span has been sent for each insight module
            hasInsightsHttp=bool(obj.flags.has_insights_http),
            hasInsightsDb=bool(obj.flags.has_insights_db),
            hasInsightsAssets=bool(obj.flags.has_insights_assets),
            hasInsightsAppStart=bool(obj.flags.has_insights_app_start),
            hasInsightsScreenLoad=bool(obj.flags.has_insights_screen_load),
            hasInsightsVitals=bool(obj.flags.has_insights_vitals),
            hasInsightsCaches=bool(obj.flags.has_insights_caches),
            hasInsightsQueues=bool(obj.flags.has_insights_queues),
            hasInsightsAgentMonitoring=bool(obj.flags.has_insights_agent_monitoring),
            hasInsightsMCP=bool(obj.flags.has_insights_mcp),
            hasLogs=get_has_logs(obj),
            hasTraceMetrics=get_has_trace_metrics(obj),
            platform=obj.platform,
            platforms=attrs["platforms"],
            latestRelease=attrs["latest_release"],
            hasUserReports=attrs["has_user_reports"],
            hasFlags=bool(obj.flags.has_flags),
        )
        if not self._collapse(LATEST_DEPLOYS_KEY):
            context[LATEST_DEPLOYS_KEY] = attrs["deploys"]

        if attrs["has_access"] or user.is_staff:
            if "stats" in attrs:
                context["stats"] = attrs["stats"]
            if "transactionStats" in attrs:
                context["transactionStats"] = attrs["transactionStats"]
            if "sessionStats" in attrs:
                context["sessionStats"] = attrs["sessionStats"]
            if "options" in attrs:
                context["options"] = attrs["options"]

        return context


def bulk_fetch_project_latest_releases(projects: Sequence[Project]) -> list[Release]:
    """
    Fetches the latest release for each of the passed projects
    :param projects:
    :return: List of Releases, each with an additional `actual_project_id`
    attribute representing the project that they're the latest release for. If
    no release found, no entry will be returned for the given project.
    """
    # XXX: This query could be very inefficient for projects with a large
    # number of releases. To work around this, we only check 20 releases
    # ordered by highest release id, which is generally correlated with
    # most recent releases for a project. This could potentially result in
    # not having the correct most recent release, but in practice will
    # likely work fine.
    release_project_join_sql = """
        JOIN (
            SELECT *
            FROM sentry_release_project lrp
            WHERE lrp.project_id = p.id
            ORDER BY lrp.release_id DESC
            LIMIT 20
        ) lrp ON lrp.release_id = lrr.id
    """

    return list(
        Release.objects.raw(
            f"""
        SELECT lr.project_id as actual_project_id, r.*
        FROM (
            SELECT (
                SELECT lrr.id
                FROM sentry_release lrr
                {release_project_join_sql}
                WHERE lrp.project_id = p.id
                ORDER BY COALESCE(lrr.date_released, lrr.date_added) DESC
                LIMIT 1
            ) as release_id,
            p.id as project_id
            FROM sentry_project p
            WHERE p.id IN %s
        ) as lr
        JOIN sentry_release r
        ON r.id = lr.release_id
            """,
            # formatting tuples works specifically in psycopg2
            (tuple(str(i.id) for i in projects),),
        )
    )


class _ReleaseWithActualProjectId(Protocol):
    """Release row from bulk_fetch_project_latest_releases carrying the raw project id."""

    version: str
    actual_project_id: int


def _get_project_to_release_version_mapping(
    item_list: Sequence[Project],
) -> dict[int, dict[str, str]]:
    """
    Return mapping of project_ID -> release version for the latest release in each project
    """
    return {
        # Raw SQL above selects project_id as actual_project_id.
        release.actual_project_id: {"version": release.version}
        for release in cast(
            list[_ReleaseWithActualProjectId], bulk_fetch_project_latest_releases(item_list)
        )
    }


class Plugin(TypedDict):
    id: str
    name: str
    slug: str
    shortName: str
    type: str
    canDisable: bool
    isTestable: bool
    hasConfiguration: bool
    metadata: dict[str, object]
    contexts: list[str]
    status: str
    assets: list[object]
    doc: str
    firstPartyAlternative: Any
    deprecationDate: Any
    altIsSentryApp: Any
    enabled: bool
    version: str
    author: dict[str, str]
    isDeprecated: bool
    isHidden: bool
    description: str
    features: list[str]
    featureDescriptions: list[dict[str, str]]
    resourceLinks: list[dict[str, str]]


class DetailedProjectResponse(ProjectWithTeamResponseDict):
    latestRelease: Annotated[
        LatestReleaseDict | None, ApiDescription("Latest release of the project")
    ]
    options: Annotated[
        dict[str, object],
        ApiDescription(
            "Additional project settings keyed by option name, such as inbound filters and preprod settings"
        ),
    ]
    digestsMinDelay: Annotated[
        int, ApiDescription("Minimum time in seconds to wait before sending an issue digest email")
    ]
    digestsMaxDelay: Annotated[
        int, ApiDescription("Maximum time in seconds to wait before sending an issue digest email")
    ]
    subjectPrefix: Annotated[str, ApiDescription("Custom prefix for emails from this project")]
    allowedDomains: Annotated[
        list[str],
        ApiDescription("Origins permitted to send events to this project. `*` allows any"),
    ]
    resolveAge: Annotated[
        int,
        ApiDescription(
            "Hours after which an issue that hasn't been seen is automatically resolved. 0 disables auto-resolve"
        ),
    ]
    dataScrubber: Annotated[
        bool,
        ApiDescription(
            "Whether known sensitive values are removed from events before they are stored"
        ),
    ]
    dataScrubberDefaults: Annotated[
        bool,
        ApiDescription("Whether Sentry's built-in list of sensitive field names is also scrubbed"),
    ]
    safeFields: Annotated[list[str], ApiDescription("Field names exempt from scrubbing")]
    storeCrashReports: Annotated[
        int | None,
        ApiDescription(
            "Number of native crash report files stored per issue. -1 means unlimited, 0 stores none, and null inherits the organization setting"
        ),
    ]
    sensitiveFields: Annotated[
        list[str],
        ApiDescription("Additional field names scrubbed from events, beyond the defaults"),
    ]
    subjectTemplate: Annotated[
        str, ApiDescription("Email subject used for individual alerts, excluding the prefix")
    ]
    securityToken: Annotated[
        str,
        ApiDescription(
            "Token sent with security reports (CSP, Expect-CT, HPKP) so Sentry can verify their origin"
        ),
    ]
    securityTokenHeader: Annotated[
        str | None,
        ApiDescription(
            "Name of the header carrying the security token on inbound security reports"
        ),
    ]
    verifySSL: Annotated[
        bool,
        ApiDescription(
            "Whether SSL certificates are verified when delivering outbound webhooks and service hooks"
        ),
    ]
    scrubIPAddresses: Annotated[
        bool,
        ApiDescription("Whether client IP addresses are discarded rather than stored on events"),
    ]
    scrapeJavaScript: Annotated[
        bool,
        ApiDescription("Whether Sentry may fetch source files and source maps from your servers"),
    ]
    enableAutoReleaseCreation: Annotated[
        bool, ApiDescription("Whether releases are created automatically from ingested events")
    ]
    highlightTags: Annotated[
        list[str], ApiDescription("Tag keys highlighted on the project's issues")
    ]
    highlightContext: Annotated[
        dict[str, list[str]],
        ApiDescription(
            "Context keys highlighted on the project's issues, as a mapping of context types to lists of keys"
        ),
    ]
    highlightPreset: Annotated[
        HighlightPreset,
        ApiDescription("Default highlighted tags and context for the project's platform"),
    ]
    groupingConfig: Annotated[
        str, ApiDescription("Identifier of the grouping algorithm used to assign events to issues")
    ]
    derivedGroupingEnhancements: Annotated[
        str,
        ApiDescription(
            "Stack trace rules that Sentry derives from the project's code mappings, as a newline-delimited config string"
        ),
    ]
    groupingEnhancements: Annotated[
        str,
        ApiDescription(
            "Grouping enhancement rules, as a newline-delimited config string, adjusting which stack frames contribute to an issue"
        ),
    ]
    secondaryGroupingExpiry: Annotated[
        int,
        ApiDescription("Unix timestamp after which the secondary grouping algorithm stops running"),
    ]
    secondaryGroupingConfig: Annotated[
        str | None,
        ApiDescription(
            "Grouping algorithm run alongside the primary one during a grouping migration"
        ),
    ]
    fingerprintingRules: Annotated[
        str,
        ApiDescription(
            "Fingerprinting rules, as a newline-delimited config string, controlling how events are grouped into issues"
        ),
    ]
    organization: Annotated[
        OrganizationSummarySerializerResponse, ApiDescription("Organization that owns the project")
    ]
    platforms: Annotated[list[str], ApiDescription("Platforms seen in the project's events")]
    processingIssues: Annotated[int, ApiDescription("Always 0")]
    defaultEnvironment: Annotated[
        str | None, ApiDescription("Environment selected by default when viewing this project")
    ]
    relayPiiConfig: Annotated[
        str | None,
        ApiDescription(
            "Advanced data scrubbing rules, as a JSON string, applied before events are stored"
        ),
    ]
    builtinSymbolSources: Annotated[
        list[str],
        ApiDescription(
            "Identifiers of Sentry-hosted symbol sources used when symbolicating events"
        ),
    ]
    enableNativeSourceServerMapping: Annotated[
        bool,
        ApiDescription(
            "Whether source server (srcsrv) information from native debug files is applied to symbolicated frames"
        ),
    ]
    dynamicSamplingBiases: Annotated[
        list[dict[str, str | bool]] | None,
        ApiDescription(
            "Per-bias toggles adjusting which transactions dynamic sampling favors retaining"
        ),
    ]
    symbolSources: Annotated[
        str, ApiDescription("Custom symbol sources as a JSON string, with secrets redacted")
    ]
    isDynamicallySampled: Annotated[
        bool,
        ApiDescription(
            "Whether dynamic sampling retains less than 100% of the project's transactions"
        ),
    ]
    tempestFetchScreenshots: NotRequired[
        Annotated[
            bool,
            ApiDescription(
                "Whether screenshots attached to console crash reports are fetched. Only included when the organization has Tempest access"
            ),
        ]
    ]
    autofixAutomationTuning: NotRequired[
        Annotated[str, ApiDescription("How aggressively Seer runs Autofix on new issues")]
    ]
    seerScannerAutomation: NotRequired[
        Annotated[bool, ApiDescription("Whether Seer scans new issues automatically")]
    ]
    seerNightshiftTweaks: NotRequired[
        Annotated[Any, ApiDescription("Experimental Seer settings with no stable shape")]
    ]
    scmSourceContextEnabled: NotRequired[
        Annotated[
            bool,
            ApiDescription(
                "Whether source context is fetched on demand from SCM integrations for stack traces"
            ),
        ]
    ]
    debugFilesRole: NotRequired[
        Annotated[
            str | None,
            ApiDescription(
                "Role required to download debug information files, ProGuard mappings and source maps. Null inherits the organization setting"
            ),
        ]
    ]


class DetailedProjectSerializer(ProjectWithTeamSerializer):
    def get_attrs(
        self, item_list: Sequence[Project], user: User | RpcUser | AnonymousUser, **kwargs: object
    ) -> dict[Project, dict[str, object]]:
        attrs = super().get_attrs(item_list, user)

        queryset = ProjectOption.objects.filter(project__in=item_list, key__in=OPTION_KEYS)
        options_by_project: dict[int, dict[str, object]] = defaultdict(dict)
        for option in queryset.iterator():
            options_by_project[option.project_id][option.key] = option.value

        # A legacy filter list at the v2 stage lives in a custom inbound filter row, which
        # replaces whatever its option still holds.
        for project_id, lists in legacy_filter_lists.read_rows(item_list).items():
            for filter_type, lines in lists.items():
                options_by_project[project_id][f"sentry:{filter_type}"] = lines

        if self._collapse(ORGANIZATION_KEY):
            orgs = {
                str(i.organization_id): {
                    "id": str(i.organization_id),
                    "slug": i.organization.slug,
                }
                for i in item_list
            }
        else:
            orgs = {d["id"]: d for d in serialize(list({i.organization for i in item_list}), user)}

        # Only fetch the latest release version key for each project to cut down on response size
        latest_release_versions = _get_project_to_release_version_mapping(item_list)

        for item in item_list:
            attrs[item].update(
                {
                    "latest_release": latest_release_versions.get(item.id),
                    "org": orgs[str(item.organization_id)],
                    "options": options_by_project[item.id],
                    "processing_issues": 0,
                    "highlight_preset": get_highlight_preset_for_project(item),
                }
            )
        return attrs

    def serialize(
        self,
        obj: Project,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> DetailedProjectResponse:
        base = super().serialize(obj, attrs, user)

        custom_symbol_sources_json = attrs["options"].get("sentry:symbol_sources")
        try:
            sources = parse_sources(custom_symbol_sources_json, filter_appconnect=False)
        except Exception:
            # In theory sources stored on the project should be valid. If they are invalid, we don't
            # want to abort serialization just for sources, so just return an empty list instead of
            # returning sources with their secrets included.
            serialized_sources = "[]"
        else:
            redacted_sources = redact_source_secrets(sources)
            serialized_sources = orjson.dumps(redacted_sources, option=orjson.OPT_UTC_Z).decode()

        sample_rate = None

        if has_dynamic_sampling(obj.organization):
            sample_rate = quotas.backend.get_blended_sample_rate(
                organization_id=obj.organization.id
            )
        data = cast(
            "DetailedProjectResponse",
            {
                **base,
                "latestRelease": attrs["latest_release"],
                "options": self.format_options(attrs),
                "digestsMinDelay": attrs["options"].get(
                    "digests:mail:minimum_delay", digests.minimum_delay
                ),
                "digestsMaxDelay": attrs["options"].get(
                    "digests:mail:maximum_delay", digests.maximum_delay
                ),
                "subjectPrefix": attrs["options"].get(
                    "mail:subject_prefix", options.get("mail.subject-prefix")
                ),
                "allowedDomains": attrs["options"].get("sentry:origins", ["*"]),
                "resolveAge": int(attrs["options"].get("sentry:resolve_age", 0)),
                "dataScrubber": bool(attrs["options"].get("sentry:scrub_data", True)),
                "dataScrubberDefaults": bool(attrs["options"].get("sentry:scrub_defaults", True)),
                "safeFields": attrs["options"].get("sentry:safe_fields", []),
                "storeCrashReports": convert_crashreport_count(
                    attrs["options"].get("sentry:store_crash_reports"), allow_none=True
                ),
                "sensitiveFields": attrs["options"].get("sentry:sensitive_fields", []),
                "subjectTemplate": attrs["options"].get("mail:subject_template")
                or DEFAULT_SUBJECT_TEMPLATE.template,
                "securityToken": attrs["options"].get("sentry:token") or obj.get_security_token(),
                "securityTokenHeader": attrs["options"].get("sentry:token_header"),
                "verifySSL": bool(attrs["options"].get("sentry:verify_ssl", False)),
                "scrubIPAddresses": bool(attrs["options"].get("sentry:scrub_ip_address", False)),
                "scrapeJavaScript": bool(attrs["options"].get("sentry:scrape_javascript", True)),
                "enableAutoReleaseCreation": bool(
                    attrs["options"].get("sentry:enable_auto_release_creation", True)
                ),
                "highlightTags": attrs["options"].get(
                    "sentry:highlight_tags",
                    attrs["highlight_preset"].get("tags", []),
                ),
                "highlightContext": attrs["options"].get(
                    "sentry:highlight_context",
                    attrs["highlight_preset"].get("context", {}),
                ),
                "highlightPreset": attrs["highlight_preset"],
                "groupingConfig": self.get_value_with_default(attrs, "sentry:grouping_config"),
                "groupingEnhancements": self.get_value_with_default(
                    attrs, "sentry:grouping_enhancements"
                ),
                "derivedGroupingEnhancements": self.get_value_with_default(
                    attrs, "sentry:derived_grouping_enhancements"
                ),
                "secondaryGroupingExpiry": self.get_value_with_default(
                    attrs, "sentry:secondary_grouping_expiry"
                ),
                "secondaryGroupingConfig": self.get_value_with_default(
                    attrs, "sentry:secondary_grouping_config"
                ),
                "fingerprintingRules": self.get_value_with_default(
                    attrs, "sentry:fingerprinting_rules"
                ),
                "organization": attrs["org"],
                "platforms": attrs["platforms"],
                "processingIssues": attrs["processing_issues"],
                "defaultEnvironment": attrs["options"].get("sentry:default_environment"),
                "relayPiiConfig": attrs["options"].get("sentry:relay_pii_config"),
                "builtinSymbolSources": self.get_value_with_default(
                    attrs, "sentry:builtin_symbol_sources"
                ),
                "enableNativeSourceServerMapping": bool(
                    self.get_value_with_default(attrs, "sentry:enable_native_source_server_mapping")
                ),
                "dynamicSamplingBiases": self.get_value_with_default(
                    attrs, "sentry:dynamic_sampling_biases"
                ),
                "symbolSources": serialized_sources,
                "isDynamicallySampled": sample_rate is not None and sample_rate < 1.0,
                "autofixAutomationTuning": self.get_value_with_default(
                    attrs, "sentry:autofix_automation_tuning"
                ),
                "seerScannerAutomation": self.get_value_with_default(
                    attrs, "sentry:seer_scanner_automation"
                ),
                "seerNightshiftTweaks": self.get_value_with_default(
                    attrs, "sentry:seer_nightshift_tweaks"
                ),
                "debugFilesRole": attrs["options"].get("sentry:debug_files_role"),
                "scmSourceContextEnabled": self.get_value_with_default(
                    attrs, "sentry:scm_source_context_enabled"
                ),
            },
        )

        if has_tempest_access(obj.organization):
            data["tempestFetchScreenshots"] = attrs["options"].get(
                "sentry:tempest_fetch_screenshots", False
            )

        return data

    def format_options(self, attrs: Mapping[str, Any]) -> dict[str, object]:
        options = attrs["options"]

        return {
            "sentry:csp_ignored_sources_defaults": bool(
                options.get("sentry:csp_ignored_sources_defaults", True)
            ),
            "sentry:csp_ignored_sources": "\n".join(
                options.get("sentry:csp_ignored_sources", []) or []
            ),
            "filters:blacklisted_ips": "\n".join(options.get("sentry:blacklisted_ips", [])),
            # This option was defaulted to string but was changed at runtime to a boolean due to an error in the
            # implementation. In order to bring it back to a string, we need to repair on read stored options. This is
            # why the value true is determined by either "1" or True.
            "filters:react-hydration-errors": options.get("filters:react-hydration-errors", "1")
            in ("1", True),
            "filters:chunk-load-error": options.get("filters:chunk-load-error", "1") == "1",
            f"filters:{FilterTypes.RELEASES}": "\n".join(
                options.get(f"sentry:{FilterTypes.RELEASES}", [])
            ),
            f"filters:{FilterTypes.ERROR_MESSAGES}": "\n".join(
                options.get(f"sentry:{FilterTypes.ERROR_MESSAGES}", [])
            ),
            f"filters:{FilterTypes.LOG_MESSAGES}": "\n".join(
                options.get(f"sentry:{FilterTypes.LOG_MESSAGES}", [])
            ),
            f"filters:{FilterTypes.TRACE_METRIC_NAMES}": "\n".join(
                options.get(f"sentry:{FilterTypes.TRACE_METRIC_NAMES}", [])
            ),
            "feedback:branding": options.get("feedback:branding", "1") == "1",
            "sentry:feedback_user_report_notifications": bool(
                self.get_value_with_default(attrs, "sentry:feedback_user_report_notifications")
            ),
            "sentry:feedback_ai_spam_detection": bool(
                self.get_value_with_default(attrs, "sentry:feedback_ai_spam_detection")
            ),
            "sentry:replay_rage_click_issues": self.get_value_with_default(
                attrs, "sentry:replay_rage_click_issues"
            ),
            "sentry:replay_hydration_error_issues": self.get_value_with_default(
                attrs, "sentry:replay_hydration_error_issues"
            ),
            "sentry:toolbar_allowed_origins": "\n".join(
                self.get_value_with_default(attrs, "sentry:toolbar_allowed_origins") or []
            ),
            "sentry:relay_automatic_json_expansion": bool(
                self.get_value_with_default(attrs, "sentry:relay_automatic_json_expansion")
            ),
            "sentry:preprod_size_status_checks_enabled": options.get(
                "sentry:preprod_size_status_checks_enabled", True
            ),
            "sentry:preprod_size_status_checks_rules": options.get(
                "sentry:preprod_size_status_checks_rules"
            ),
            "sentry:preprod_size_pr_comments_enabled": options.get(
                "sentry:preprod_size_pr_comments_enabled", False
            ),
            "sentry:preprod_size_pr_comments_rules": options.get(
                "sentry:preprod_size_pr_comments_rules"
            ),
            "sentry:preprod_snapshot_status_checks_enabled": options.get(
                "sentry:preprod_snapshot_status_checks_enabled", True
            ),
            "sentry:preprod_snapshot_status_checks_fail_on_added": options.get(
                "sentry:preprod_snapshot_status_checks_fail_on_added", False
            ),
            "sentry:preprod_snapshot_status_checks_fail_on_removed": options.get(
                "sentry:preprod_snapshot_status_checks_fail_on_removed", True
            ),
            "sentry:preprod_snapshot_status_checks_fail_on_changed": options.get(
                "sentry:preprod_snapshot_status_checks_fail_on_changed", True
            ),
            "sentry:preprod_snapshot_status_checks_fail_on_renamed": options.get(
                "sentry:preprod_snapshot_status_checks_fail_on_renamed", False
            ),
            "quotas:spike-protection-disabled": options.get("quotas:spike-protection-disabled"),
            "sentry:preprod_size_enabled_query": options.get("sentry:preprod_size_enabled_query"),
            "sentry:preprod_distribution_enabled_query": options.get(
                "sentry:preprod_distribution_enabled_query"
            ),
            "sentry:preprod_size_enabled_by_customer": self.get_value_with_default(
                attrs, "sentry:preprod_size_enabled_by_customer"
            ),
            "sentry:preprod_distribution_enabled_by_customer": self.get_value_with_default(
                attrs, "sentry:preprod_distribution_enabled_by_customer"
            ),
            "sentry:preprod_distribution_pr_comments_enabled_by_customer": self.get_value_with_default(
                attrs, "sentry:preprod_distribution_pr_comments_enabled_by_customer"
            ),
            "sentry:preprod_snapshot_pr_comments_enabled": self.get_value_with_default(
                attrs, "sentry:preprod_snapshot_pr_comments_enabled"
            ),
            "sentry:preprod_snapshot_pr_comments_post_on_added": self.get_value_with_default(
                attrs, "sentry:preprod_snapshot_pr_comments_post_on_added"
            ),
            "sentry:preprod_snapshot_pr_comments_post_on_removed": self.get_value_with_default(
                attrs, "sentry:preprod_snapshot_pr_comments_post_on_removed"
            ),
            "sentry:preprod_snapshot_pr_comments_post_on_changed": self.get_value_with_default(
                attrs, "sentry:preprod_snapshot_pr_comments_post_on_changed"
            ),
            "sentry:preprod_snapshot_pr_comments_post_on_renamed": self.get_value_with_default(
                attrs, "sentry:preprod_snapshot_pr_comments_post_on_renamed"
            ),
        }

    def get_value_with_default(self, attrs: Mapping[str, Any], key: str) -> Any:
        value = attrs["options"].get(key)
        if value is not None:
            return value
        return projectoptions.get_well_known_default(
            key, epoch=attrs["options"].get("sentry:option-epoch")
        )


class SharedProjectOrganizationResponse(TypedDict):
    slug: Annotated[str, ApiDescription("Slug of the organization")]
    name: Annotated[str, ApiDescription("Name of the organization")]


class SharedProjectSerializerResponse(TypedDict):
    slug: Annotated[str, ApiDescription("Slug of the project")]
    name: Annotated[str, ApiDescription("Name of the project")]
    color: Annotated[str, ApiDescription("Color of the project, as a hex code such as `#bf6e3f`")]
    features: Annotated[list[str], ApiDescription("Always empty for a shared issue's project")]
    organization: Annotated[
        SharedProjectOrganizationResponse,
        ApiDescription("Organization the project belongs to"),
    ]


class SharedProjectSerializer(Serializer):
    def serialize(
        self,
        obj: Project,
        attrs: Mapping[str, object],
        user: User | RpcUser | AnonymousUser | None,
        **kwargs: object,
    ) -> SharedProjectSerializerResponse:
        return {
            "slug": obj.slug,
            "name": obj.name,
            "color": obj.color,
            "features": [],
            "organization": {"slug": obj.organization.slug, "name": obj.organization.name},
        }
