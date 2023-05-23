from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, Iterable, List, Mapping, MutableMapping, Optional, Sequence, cast

import sentry_sdk
from django.contrib.auth.models import AnonymousUser
from django.db import connection
from django.db.models import prefetch_related_objects
from django.db.models.aggregates import Count
from django.utils import timezone
from typing_extensions import TypedDict

from sentry import features, options, projectoptions, release_health, roles
from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.plugin import PluginSerializer
from sentry.api.serializers.models.team import get_org_roles
from sentry.app import env
from sentry.auth.access import Access
from sentry.auth.superuser import is_active_superuser
from sentry.constants import ObjectStatus, StatsPeriod
from sentry.digests import backend as digests
from sentry.eventstore.models import DEFAULT_SUBJECT_TEMPLATE
from sentry.features.base import ProjectFeature
from sentry.ingest.inbound_filters import FilterTypes
from sentry.lang.native.sources import parse_sources, redact_source_secrets
from sentry.lang.native.utils import convert_crashreport_count
from sentry.models import (
    EnvironmentProject,
    OrganizationMemberTeam,
    Project,
    ProjectAvatar,
    ProjectBookmark,
    ProjectOption,
    ProjectPlatform,
    ProjectTeam,
    Release,
    Team,
    User,
    UserReport,
)
from sentry.models.options.project_option import OPTION_KEYS
from sentry.notifications.helpers import (
    get_most_specific_notification_setting_value,
    transform_to_notification_settings_by_scope,
)
from sentry.notifications.types import NotificationSettingOptionValues, NotificationSettingTypes
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.services.hybrid_cloud.notifications import notifications_service
from sentry.snuba import discover
from sentry.tasks.symbolication import should_demote_symbolication
from sentry.utils import json

STATUS_LABELS = {
    ObjectStatus.ACTIVE: "active",
    ObjectStatus.DISABLED: "deleted",
    ObjectStatus.PENDING_DELETION: "deleted",
    ObjectStatus.DELETION_IN_PROGRESS: "deleted",
}

STATS_PERIOD_CHOICES = {
    "30d": StatsPeriod(30, timedelta(hours=24)),
    "14d": StatsPeriod(14, timedelta(hours=24)),
    "7d": StatsPeriod(7, timedelta(hours=24)),
    "24h": StatsPeriod(24, timedelta(hours=1)),
    "1h": StatsPeriod(60, timedelta(minutes=1)),
}

_PROJECT_SCOPE_PREFIX = "projects:"

LATEST_DEPLOYS_KEY = "latestDeploys"


def _get_team_memberships(team_list: Sequence[Team], user: User) -> Iterable[int]:
    """Get memberships the user has in the provided team list"""
    if not user.is_authenticated:
        return []

    return list(
        OrganizationMemberTeam.objects.filter(
            organizationmember__user_id=user.id, team__in=team_list
        )
    )


def get_access_by_project(
    projects: Sequence[Project], user: User
) -> MutableMapping[Project, MutableMapping[str, Any]]:
    request = env.request

    project_teams = list(ProjectTeam.objects.filter(project__in=projects).select_related("team"))
    project_team_map = defaultdict(list)

    for pt in project_teams:
        project_team_map[pt.project_id].append(pt.team)

    team_memberships = _get_team_memberships([pt.team for pt in project_teams], user)

    org_ids = {i.organization_id for i in projects}
    all_org_roles = get_org_roles(org_ids, user)
    is_superuser = request and is_active_superuser(request) and request.user == user
    prefetch_related_objects(projects, "organization")

    result = {}
    for project in projects:
        parent_teams = [t.id for t in project_team_map.get(project.id, [])]
        member_teams = [m for m in team_memberships if m.team_id in parent_teams]
        is_member = any(member_teams)
        org_roles = all_org_roles.get(project.organization_id) or []

        has_access = bool(
            is_member
            or is_superuser
            or project.organization.flags.allow_joinleave
            or any(roles.get(org_role).is_global for org_role in org_roles)
        )

        team_scopes = set()
        if has_access:
            # Project can be the child of several Teams, and the User can join
            # several Teams and receive roles at each of them,
            team_scopes = team_scopes.union(*[m.get_scopes() for m in member_teams])

            # User may have elevated team-roles from their org-role
            top_org_role = org_roles[0] if org_roles else None
            if top_org_role:
                minimum_team_role = roles.get_minimum_team_role(top_org_role)
                team_scopes = team_scopes.union(minimum_team_role.scopes)

        result[project] = {
            "is_member": is_member,
            "has_access": has_access,
            "access": team_scopes,
        }
    return result


def get_features_for_projects(
    all_projects: Sequence[Project], user: User
) -> MutableMapping[Project, List[str]]:
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

    batch_checked = set()
    for (organization, projects) in projects_by_org.items():
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
        for (organization, projects) in projects_by_org.items():
            result = features.has_for_batch(feature_name, organization, projects, user)
            for (project, flag) in result.items():
                if flag:
                    features_by_project[project].append(abbreviated_feature)

    for project in all_projects:
        if project.flags.has_releases:
            features_by_project[project].append("releases")

    return features_by_project


def format_options(attrs: defaultdict(dict)):
    options = attrs["options"]
    return {
        "sentry:csp_ignored_sources_defaults": bool(
            options.get("sentry:csp_ignored_sources_defaults", True)
        ),
        "sentry:csp_ignored_sources": "\n".join(
            options.get("sentry:csp_ignored_sources", []) or []
        ),
        "sentry:reprocessing_active": bool(options.get("sentry:reprocessing_active", False)),
        "filters:blacklisted_ips": "\n".join(options.get("sentry:blacklisted_ips", [])),
        "filters:react-hydration-errors": bool(options.get("filters:react-hydration-errors", True)),
        f"filters:{FilterTypes.RELEASES}": "\n".join(
            options.get(f"sentry:{FilterTypes.RELEASES}", [])
        ),
        f"filters:{FilterTypes.ERROR_MESSAGES}": "\n".join(
            options.get(f"sentry:{FilterTypes.ERROR_MESSAGES}", [])
        ),
        "feedback:branding": options.get("feedback:branding", "1") == "1",
    }


class _ProjectSerializerOptionalBaseResponse(TypedDict, total=False):
    stats: Any
    transactionStats: Any
    sessionStats: Any


class ProjectSerializerBaseResponse(_ProjectSerializerOptionalBaseResponse):
    id: str
    slug: str
    name: str  # TODO: add deprecation about this field (not used in app)
    platform: Optional[str]
    dateCreated: datetime
    isBookmarked: bool
    isMember: bool
    features: List[str]
    firstEvent: Optional[datetime]
    firstTransactionEvent: bool
    access: List[str]
    hasAccess: bool
    hasMonitors: bool
    hasProfiles: bool
    hasReplays: bool
    hasSessions: bool


class ProjectSerializerResponse(ProjectSerializerBaseResponse):
    isInternal: bool
    isPublic: bool
    avatar: Any  # TODO: use Avatar type from other serializers
    color: str
    status: str  # TODO enum/literal


@register(Project)
class ProjectSerializer(Serializer):  # type: ignore
    """
    This is primarily used to summarize projects. We utilize it when doing bulk loads for things
    such as "show all projects for this organization", and its attributes be kept to a minimum.
    """

    def __init__(
        self,
        environment_id: str | None = None,
        stats_period: str | None = None,
        expand: Iterable[str] | None = None,
        expand_context: Mapping[str, Any] | None = None,
        collapse: Iterable[str] | None = None,
    ) -> None:
        if stats_period is not None:
            assert stats_period in STATS_PERIOD_CHOICES

        self.environment_id = environment_id
        self.stats_period = stats_period
        self.expand = expand
        self.expand_context = expand_context
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
        self, item_list: Sequence[Project], user: User, **kwargs: Any
    ) -> MutableMapping[Project, MutableMapping[str, Any]]:
        def measure_span(op_tag):
            span = sentry_sdk.start_span(op=f"serialize.get_attrs.project.{op_tag}")
            span.set_data("Object Count", len(item_list))
            return span

        with measure_span("preamble"):
            project_ids = [i.id for i in item_list]
            if user.is_authenticated and item_list:
                bookmarks = set(
                    ProjectBookmark.objects.filter(
                        user_id=user.id, project_id__in=project_ids
                    ).values_list("project_id", flat=True)
                )

                notification_settings_by_scope = transform_to_notification_settings_by_scope(
                    notifications_service.get_settings_for_user_by_projects(
                        type=NotificationSettingTypes.ISSUE_ALERTS,
                        user_id=user.id,
                        parent_ids=project_ids,
                    )
                )
            else:
                bookmarks = set()
                notification_settings_by_scope = {}

        with measure_span("stats"):
            stats = None
            transaction_stats = None
            session_stats = None
            project_ids = [o.id for o in item_list]

            if self.stats_period:
                stats = self.get_stats(project_ids, "!event.type:transaction")
                if self._expand("transaction_stats"):
                    transaction_stats = self.get_stats(project_ids, "event.type:transaction")
                if self._expand("session_stats"):
                    session_stats = self.get_session_stats(project_ids)

        with measure_span("options"):
            options = None
            if self._expand("options"):
                options = self.get_options(item_list)

        avatars = {a.project_id: a for a in ProjectAvatar.objects.filter(project__in=item_list)}
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
            features_by_project = get_features_for_projects(item_list, user)
            for project, serialized in result.items():
                serialized["features"] = features_by_project[project]

        with measure_span("other"):
            # Avoid duplicate queries for actors.
            if isinstance(user, AnonymousUser):
                recipient_actor = user
            else:
                recipient_actor = RpcActor.from_object(user)
            for project, serialized in result.items():
                value = get_most_specific_notification_setting_value(
                    notification_settings_by_scope,
                    recipient=recipient_actor,
                    parent_id=project.id,
                    type=NotificationSettingTypes.ISSUE_ALERTS,
                )
                is_subscribed = value == NotificationSettingOptionValues.ALWAYS
                serialized.update(
                    {
                        "is_bookmarked": project.id in bookmarks,
                        "is_subscribed": is_subscribed,
                        "avatar": avatars.get(project.id),
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

    def get_stats(self, project_ids, query):
        # we need to compute stats at 1d (1h resolution), and 14d
        segments, interval = STATS_PERIOD_CHOICES[self.stats_period]
        now = timezone.now()

        params = {
            "project_id": project_ids,
            "start": now - ((segments - 1) * interval),
            "end": now,
        }
        if self.environment_id:
            query = f"{query} environment:{self.environment_id}"

        # Generate a query result to skip the top_events.find query
        top_events = {"data": [{"project_id": p} for p in project_ids]}
        stats = discover.top_events_timeseries(
            timeseries_columns=["count()"],
            selected_columns=["project_id"],
            user_query=query,
            params=params,
            orderby="project_id",
            rollup=int(interval.total_seconds()),
            limit=10000,
            organization=None,
            referrer="api.serializer.projects.get_stats",
            top_events=top_events,
        )
        results = {}
        for project_id in project_ids:
            serialized = []
            str_id = str(project_id)
            if str_id in stats:
                for item in stats[str_id].data["data"]:
                    serialized.append((item["time"], item.get("count", 0)))
            results[project_id] = serialized
        return results

    def get_session_stats(self, project_ids):
        segments, interval = STATS_PERIOD_CHOICES[self.stats_period]

        now = timezone.now()
        current_interval_start = now - (segments * interval)
        previous_interval_start = now - (2 * segments * interval)

        project_health_data_dict = release_health.get_current_and_previous_crash_free_rates(
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

        for project_id in project_ids:
            current_crash_free_rate = project_health_data_dict[project_id]["currentCrashFreeRate"]
            previous_crash_free_rate = project_health_data_dict[project_id]["previousCrashFreeRate"]

            if [current_crash_free_rate, previous_crash_free_rate] != [None, None]:
                project_health_data_dict[project_id]["hasHealthData"] = True
            else:
                project_health_data_dict[project_id]["hasHealthData"] = False
                check_has_health_data_ids.append(project_id)

        # For project ids we are not sure if they have health data in the last 90 days we
        # call -> check_has_data with those ids and then update our `project_health_data_dict`
        # accordingly
        if check_has_health_data_ids:
            projects_with_health_data = release_health.check_has_health_data(
                check_has_health_data_ids
            )
            for project_id in projects_with_health_data:
                project_health_data_dict[project_id]["hasHealthData"] = True

        return project_health_data_dict

    def get_options(self, projects):
        # no options specified
        option_list = []

        # must be a safe key
        if self.expand_context.get("options"):
            option_list = self.expand_context.get("options")
            option_list = [option for option in option_list if option in OPTION_KEYS]

        queryset = ProjectOption.objects.filter(project__in=projects, key__in=option_list)

        options_by_project = defaultdict(dict)
        for option in queryset:
            options_by_project[option.project_id][option.key] = option.value

        return options_by_project

    def serialize(
        self, obj: Project, attrs: Mapping[str, Any], user: User
    ) -> ProjectSerializerResponse:
        status_label = STATUS_LABELS.get(obj.status, "unknown")

        if attrs.get("avatar"):
            avatar = {
                "avatarType": attrs["avatar"].get_avatar_type_display(),
                "avatarUuid": attrs["avatar"].ident if attrs["avatar"].file_id else None,
            }
        else:
            avatar = {"avatarType": "letter_avatar", "avatarUuid": None}

        context: ProjectSerializerResponse = {
            "id": str(obj.id),
            "slug": obj.slug,
            "name": obj.name,  # Deprecated
            "platform": obj.platform,
            "dateCreated": obj.date_added,
            "isBookmarked": attrs["is_bookmarked"],
            "isMember": attrs["is_member"],
            "features": attrs["features"],
            "firstEvent": obj.first_event,
            "firstTransactionEvent": bool(obj.flags.has_transactions),
            "access": attrs["access"],
            "hasAccess": attrs["has_access"],
            "hasMinifiedStackTrace": bool(obj.flags.has_minified_stack_trace),
            "hasMonitors": bool(obj.flags.has_cron_monitors),
            "hasProfiles": bool(obj.flags.has_profiles),
            "hasReplays": bool(obj.flags.has_replays),
            "hasSessions": bool(obj.flags.has_sessions),
            "isInternal": obj.is_internal_project(),
            "isPublic": obj.public,
            "avatar": avatar,
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


class ProjectWithOrganizationSerializer(ProjectSerializer):
    def get_attrs(
        self, item_list: Sequence[Project], user: User, **kwargs: Any
    ) -> MutableMapping[Project, MutableMapping[str, Any]]:
        attrs = super().get_attrs(item_list, user)

        orgs = {d["id"]: d for d in serialize(list({i.organization for i in item_list}), user)}
        for item in item_list:
            attrs[item]["organization"] = orgs[str(item.organization_id)]
        return attrs

    def serialize(self, obj, attrs, user):
        data = super().serialize(obj, attrs, user)
        data["organization"] = attrs["organization"]
        return data


class TeamResponseDict(TypedDict):
    id: str
    name: str
    slug: str


class ProjectWithTeamResponseDict(ProjectSerializerResponse):
    team: TeamResponseDict
    teams: List[TeamResponseDict]


class ProjectWithTeamSerializer(ProjectSerializer):
    def get_attrs(
        self, item_list: Sequence[Project], user: User, **kwargs: Any
    ) -> MutableMapping[Project, MutableMapping[str, Any]]:
        attrs = super().get_attrs(item_list, user)

        project_teams = list(
            ProjectTeam.objects.filter(project__in=item_list).select_related("team")
        )

        teams = {
            pt.team_id: {
                "id": str(pt.team.id),
                "slug": pt.team.slug,
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

    def serialize(self, obj, attrs, user) -> ProjectWithTeamResponseDict:
        data = cast(ProjectWithTeamResponseDict, super().serialize(obj, attrs, user))
        # TODO(jess): remove this when this is deprecated
        try:
            data["team"] = attrs["teams"][0]
        except IndexError:
            pass
        data["teams"] = attrs["teams"]
        return data


class EventProcessingDict(TypedDict):
    symbolicationDegraded: bool


class LatestReleaseDict(TypedDict):
    version: str


class _OrganizationProjectOptionalResponse(TypedDict, total=False):
    latestDeploys: Optional[Dict[str, Dict[str, str]]]


class OrganizationProjectResponse(
    _OrganizationProjectOptionalResponse, ProjectSerializerBaseResponse
):
    team: Optional[TeamResponseDict]
    teams: List[TeamResponseDict]
    eventProcessing: EventProcessingDict
    platforms: List[str]
    hasUserReports: bool
    environments: List[str]
    latestRelease: Optional[LatestReleaseDict]


class ProjectSummarySerializer(ProjectWithTeamSerializer):
    access: Access | None

    def __init__(self, access: Access | None = None, **kwargs):
        self.access = access
        super().__init__(**kwargs)

    def get_deploys_by_project(self, item_list):
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
        deploys_by_project = defaultdict(dict)

        for project_id, env_name, release_version, date_finished in cursor.fetchall():
            deploys_by_project[project_id][env_name] = {
                "version": release_version,
                "dateFinished": date_finished,
            }

        return deploys_by_project

    def get_attrs(
        self, item_list: Sequence[Project], user: User, **kwargs: Any
    ) -> MutableMapping[Project, MutableMapping[str, Any]]:
        attrs = super().get_attrs(item_list, user)

        projects_with_user_reports = set(
            UserReport.objects.filter(project_id__in=[item.id for item in item_list]).values_list(
                "project_id", flat=True
            )
        )

        project_envs = (
            EnvironmentProject.objects.filter(
                project_id__in=[i.id for i in item_list],
                # Including the organization_id is necessary for postgres to use indexes
                # efficiently.
                environment__organization_id=item_list[0].organization_id,
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
            environments_by_project[project_env["project_id"]].append(
                project_env["environment__name"]
            )

        # We just return the version key here so that we cut down on response size
        latest_release_versions = {
            release.actual_project_id: {"version": release.version}
            for release in bulk_fetch_project_latest_releases(item_list)
        }

        deploys_by_project = None
        if not self._collapse(LATEST_DEPLOYS_KEY):
            deploys_by_project = self.get_deploys_by_project(item_list)

        for item in item_list:
            attrs[item]["latest_release"] = latest_release_versions.get(item.id)
            attrs[item]["environments"] = environments_by_project.get(item.id, [])
            attrs[item]["has_user_reports"] = item.id in projects_with_user_reports
            if not self._collapse(LATEST_DEPLOYS_KEY):
                attrs[item]["deploys"] = deploys_by_project.get(item.id)

        return attrs

    def serialize(self, obj, attrs, user) -> OrganizationProjectResponse:  # type: ignore
        context = OrganizationProjectResponse(
            team=attrs["teams"][0] if attrs["teams"] else None,
            teams=attrs["teams"],
            id=str(obj.id),
            name=obj.name,
            slug=obj.slug,
            isBookmarked=attrs["is_bookmarked"],
            isMember=attrs["is_member"],
            access=attrs["access"],
            hasAccess=attrs["has_access"],
            dateCreated=obj.date_added,
            environments=attrs["environments"],
            eventProcessing={
                "symbolicationDegraded": should_demote_symbolication(obj.id),
            },
            features=attrs["features"],
            firstEvent=obj.first_event,
            firstTransactionEvent=bool(obj.flags.has_transactions),
            hasSessions=bool(obj.flags.has_sessions),
            hasProfiles=bool(obj.flags.has_profiles),
            hasReplays=bool(obj.flags.has_replays),
            hasMonitors=bool(obj.flags.has_cron_monitors),
            hasMinifiedStackTrace=bool(obj.flags.has_minified_stack_trace),
            platform=obj.platform,
            platforms=attrs["platforms"],
            latestRelease=attrs["latest_release"],
            hasUserReports=attrs["has_user_reports"],
        )
        if not self._collapse(LATEST_DEPLOYS_KEY):
            context[LATEST_DEPLOYS_KEY] = attrs["deploys"]
        if "stats" in attrs:
            context.update(stats=attrs["stats"])
        if "transactionStats" in attrs:
            context.update(transactionStats=attrs["transactionStats"])
        if "sessionStats" in attrs:
            context.update(sessionStats=attrs["sessionStats"])
        if "options" in attrs:
            context.update(options=attrs["options"])

        return context


def bulk_fetch_project_latest_releases(projects):
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


class DetailedProjectSerializer(ProjectWithTeamSerializer):
    def get_attrs(
        self, item_list: Sequence[Project], user: User, **kwargs: Any
    ) -> MutableMapping[Project, MutableMapping[str, Any]]:
        attrs = super().get_attrs(item_list, user)

        project_ids = [i.id for i in item_list]

        num_issues_projects = (
            Project.objects.filter(id__in=project_ids)
            .annotate(num_issues=Count("processingissue"))
            .values_list("id", "num_issues")
        )

        processing_issues_by_project = {}
        for project_id, num_issues in num_issues_projects:
            processing_issues_by_project[project_id] = num_issues

        queryset = ProjectOption.objects.filter(project__in=item_list, key__in=OPTION_KEYS)
        options_by_project = defaultdict(dict)
        for option in queryset.iterator():
            options_by_project[option.project_id][option.key] = option.value

        orgs = {d["id"]: d for d in serialize(list({i.organization for i in item_list}), user)}

        latest_release_list = bulk_fetch_project_latest_releases(item_list)
        latest_releases = {
            r.actual_project_id: d
            for r, d in zip(latest_release_list, serialize(latest_release_list, user))
        }

        for item in item_list:
            attrs[item].update(
                {
                    "latest_release": latest_releases.get(item.id),
                    "org": orgs[str(item.organization_id)],
                    "options": options_by_project[item.id],
                    "processing_issues": processing_issues_by_project.get(item.id, 0),
                }
            )
        return attrs

    def serialize(self, obj, attrs, user):
        from sentry.plugins.base import plugins

        def get_value_with_default(key):
            value = attrs["options"].get(key)
            if value is not None:
                return value
            return projectoptions.get_well_known_default(
                key, epoch=attrs["options"].get("sentry:option-epoch")
            )

        data = super().serialize(obj, attrs, user)
        attrs["options"].update(format_options(attrs))
        data.update(
            {
                "latestRelease": attrs["latest_release"],
                "options": attrs["options"],
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
                "groupingConfig": get_value_with_default("sentry:grouping_config"),
                "groupingEnhancements": get_value_with_default("sentry:grouping_enhancements"),
                "groupingEnhancementsBase": get_value_with_default(
                    "sentry:grouping_enhancements_base"
                ),
                "secondaryGroupingExpiry": get_value_with_default(
                    "sentry:secondary_grouping_expiry"
                ),
                "secondaryGroupingConfig": get_value_with_default(
                    "sentry:secondary_grouping_config"
                ),
                "groupingAutoUpdate": get_value_with_default("sentry:grouping_auto_update"),
                "fingerprintingRules": get_value_with_default("sentry:fingerprinting_rules"),
                "organization": attrs["org"],
                "plugins": serialize(
                    [
                        plugin
                        for plugin in plugins.configurable_for_project(obj, version=None)
                        if plugin.has_project_conf()
                    ],
                    user,
                    PluginSerializer(obj),
                ),
                "platforms": attrs["platforms"],
                "processingIssues": attrs["processing_issues"],
                "defaultEnvironment": attrs["options"].get("sentry:default_environment"),
                "relayPiiConfig": attrs["options"].get("sentry:relay_pii_config"),
                "builtinSymbolSources": get_value_with_default("sentry:builtin_symbol_sources"),
                "dynamicSamplingBiases": get_value_with_default("sentry:dynamic_sampling_biases"),
                "eventProcessing": {
                    "symbolicationDegraded": False,
                },
            }
        )
        custom_symbol_sources_json = attrs["options"].get("sentry:symbol_sources")
        try:
            sources = parse_sources(custom_symbol_sources_json, False)
        except Exception:
            # In theory sources stored on the project should be valid. If they are invalid, we don't
            # want to abort serialization just for sources, so just return an empty list instead of
            # returning sources with their secrets included.
            serialized_sources = "[]"
        else:
            redacted_sources = redact_source_secrets(sources)
            serialized_sources = json.dumps(redacted_sources)

        data.update(
            {
                "symbolSources": serialized_sources,
            }
        )

        return data

    def get_audit_log_data(self):
        return {
            "id": self.id,
            "slug": self.slug,
            "name": self.name,
            "status": self.status,
            "public": self.public,
        }


class SharedProjectSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        from sentry import features

        feature_list = []
        for feature in ():
            if features.has("projects:" + feature, obj, actor=user):
                feature_list.append(feature)

        return {
            "slug": obj.slug,
            "name": obj.name,
            "color": obj.color,
            "features": feature_list,
            "organization": {"slug": obj.organization.slug, "name": obj.organization.name},
        }
