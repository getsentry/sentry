from __future__ import absolute_import

import six

from collections import defaultdict
from datetime import timedelta
from django.db import connection
from django.db.models import Q
from django.db.models.aggregates import Count
from django.utils import timezone

import sentry_sdk

from sentry import options, roles, tsdb, projectoptions, features
from sentry.api.serializers import register, serialize, Serializer
from sentry.api.serializers.models.plugin import PluginSerializer
from sentry.api.serializers.models.team import get_org_roles, get_team_memberships
from sentry.app import env
from sentry.auth.superuser import is_active_superuser
from sentry.constants import StatsPeriod
from sentry.digests import backend as digests
from sentry.eventstore.models import DEFAULT_SUBJECT_TEMPLATE
from sentry.features.base import ProjectFeature
from sentry.lang.native.utils import convert_crashreport_count
from sentry.models import (
    EnvironmentProject,
    Project,
    ProjectAvatar,
    ProjectBookmark,
    ProjectOption,
    ProjectPlatform,
    ProjectStatus,
    ProjectTeam,
    Release,
    UserOption,
    UserReport,
)
from sentry.ingest.inbound_filters import FilterTypes
from sentry.utils.compat import zip

STATUS_LABELS = {
    ProjectStatus.VISIBLE: "active",
    ProjectStatus.HIDDEN: "deleted",
    ProjectStatus.PENDING_DELETION: "deleted",
    ProjectStatus.DELETION_IN_PROGRESS: "deleted",
}

STATS_PERIOD_CHOICES = {
    "30d": StatsPeriod(30, timedelta(hours=24)),
    "14d": StatsPeriod(14, timedelta(hours=24)),
    "24h": StatsPeriod(24, timedelta(hours=1)),
}

_PROJECT_SCOPE_PREFIX = "projects:"


@register(Project)
class ProjectSerializer(Serializer):
    """
    This is primarily used to summarize projects. We utilize it when doing bulk loads for things
    such as "show all projects for this organization", and its attributes be kept to a minimum.
    """

    def __init__(self, environment_id=None, stats_period=None):
        if stats_period is not None:
            assert stats_period in STATS_PERIOD_CHOICES

        self.environment_id = environment_id
        self.stats_period = stats_period

    def get_access_by_project(self, item_list, user):
        request = env.request

        project_teams = list(
            ProjectTeam.objects.filter(project__in=item_list).select_related("team")
        )

        project_team_map = defaultdict(list)

        for pt in project_teams:
            project_team_map[pt.project_id].append(pt.team)

        team_memberships = get_team_memberships([pt.team for pt in project_teams], user)
        org_roles = get_org_roles([i.organization_id for i in item_list], user)

        is_superuser = request and is_active_superuser(request) and request.user == user
        result = {}
        for project in item_list:
            is_member = any(t.id in team_memberships for t in project_team_map.get(project.id, []))
            org_role = org_roles.get(project.organization_id)
            if is_member:
                has_access = True
            elif is_superuser:
                has_access = True
            elif project.organization.flags.allow_joinleave:
                has_access = True
            elif org_role and roles.get(org_role).is_global:
                has_access = True
            else:
                has_access = False
            result[project] = {"is_member": is_member, "has_access": has_access}
        return result

    def get_attrs(self, item_list, user):
        def measure_span(op_tag):
            span = sentry_sdk.start_span(op="serialize.get_attrs.project.{}".format(op_tag))
            span.set_data("Object Count", len(item_list))
            return span

        with measure_span("preamble"):
            project_ids = [i.id for i in item_list]
            if user.is_authenticated() and item_list:
                bookmarks = set(
                    ProjectBookmark.objects.filter(
                        user=user, project_id__in=project_ids
                    ).values_list("project_id", flat=True)
                )
                user_options = {
                    (u.project_id, u.key): u.value
                    for u in UserOption.objects.filter(
                        Q(user=user, project__in=item_list, key="mail:alert")
                        | Q(user=user, key="subscribe_by_default", project__isnull=True)
                    )
                }
                default_subscribe = user_options.get("subscribe_by_default", "1") == "1"
            else:
                bookmarks = set()
                user_options = {}
                default_subscribe = False

            if self.stats_period:
                # we need to compute stats at 1d (1h resolution), and 14d
                project_ids = [o.id for o in item_list]

                segments, interval = STATS_PERIOD_CHOICES[self.stats_period]
                now = timezone.now()
                stats = tsdb.get_range(
                    model=tsdb.models.project,
                    keys=project_ids,
                    end=now,
                    start=now - ((segments - 1) * interval),
                    rollup=int(interval.total_seconds()),
                    environment_ids=self.environment_id and [self.environment_id],
                )
            else:
                stats = None

            avatars = {a.project_id: a for a in ProjectAvatar.objects.filter(project__in=item_list)}
            project_ids = [i.id for i in item_list]
            platforms = ProjectPlatform.objects.filter(project_id__in=project_ids).values_list(
                "project_id", "platform"
            )
            platforms_by_project = defaultdict(list)
            for project_id, platform in platforms:
                platforms_by_project[project_id].append(platform)

        with measure_span("access"):
            result = self.get_access_by_project(item_list, user)

        with measure_span("features"):
            features_by_project = self._get_features_for_projects(item_list, user)
            for project, serialized in result.items():
                serialized["features"] = features_by_project[project]

        with measure_span("other"):
            for project, serialized in result.items():
                serialized.update(
                    {
                        "is_bookmarked": project.id in bookmarks,
                        "is_subscribed": bool(
                            user_options.get((project.id, "mail:alert"), default_subscribe)
                        ),
                        "avatar": avatars.get(project.id),
                        "platforms": platforms_by_project[project.id],
                    }
                )
                if stats:
                    serialized["stats"] = stats[project.id]
        return result

    @staticmethod
    def _get_features_for_projects(all_projects, user):
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
                    for feature_name, active in batch_features.get(
                        "project:{}".format(project.id), {}
                    ):
                        if active:
                            features_by_project[project].append(
                                feature_name[len(_PROJECT_SCOPE_PREFIX) :]
                            )

                        batch_checked.add(feature_name)

        for feature_name in features.all(feature_type=ProjectFeature).keys():
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

    def serialize(self, obj, attrs, user):
        status_label = STATUS_LABELS.get(obj.status, "unknown")

        if attrs.get("avatar"):
            avatar = {
                "avatarType": attrs["avatar"].get_avatar_type_display(),
                "avatarUuid": attrs["avatar"].ident if attrs["avatar"].file_id else None,
            }
        else:
            avatar = {"avatarType": "letter_avatar", "avatarUuid": None}

        context = {
            "id": six.text_type(obj.id),
            "slug": obj.slug,
            "name": obj.name,
            "isPublic": obj.public,
            "isBookmarked": attrs["is_bookmarked"],
            "color": obj.color,
            "dateCreated": obj.date_added,
            "firstEvent": obj.first_event,
            "firstTransactionEvent": True if obj.flags.has_transactions else False,
            "features": attrs["features"],
            "status": status_label,
            "platform": obj.platform,
            "isInternal": obj.is_internal_project(),
            "isMember": attrs["is_member"],
            "hasAccess": attrs["has_access"],
            "avatar": avatar,
        }
        if "stats" in attrs:
            context["stats"] = attrs["stats"]
        return context


class ProjectWithOrganizationSerializer(ProjectSerializer):
    def get_attrs(self, item_list, user):
        attrs = super(ProjectWithOrganizationSerializer, self).get_attrs(item_list, user)

        orgs = {d["id"]: d for d in serialize(list(set(i.organization for i in item_list)), user)}
        for item in item_list:
            attrs[item]["organization"] = orgs[six.text_type(item.organization_id)]
        return attrs

    def serialize(self, obj, attrs, user):
        data = super(ProjectWithOrganizationSerializer, self).serialize(obj, attrs, user)
        data["organization"] = attrs["organization"]
        return data


class ProjectWithTeamSerializer(ProjectSerializer):
    def get_attrs(self, item_list, user):
        attrs = super(ProjectWithTeamSerializer, self).get_attrs(item_list, user)

        project_teams = list(
            ProjectTeam.objects.filter(project__in=item_list).select_related("team")
        )

        teams = {
            pt.team_id: {
                "id": six.text_type(pt.team.id),
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

    def serialize(self, obj, attrs, user):
        data = super(ProjectWithTeamSerializer, self).serialize(obj, attrs, user)
        # TODO(jess): remove this when this is deprecated
        try:
            data["team"] = attrs["teams"][0]
        except IndexError:
            pass
        data["teams"] = attrs["teams"]
        return data


class ProjectSummarySerializer(ProjectWithTeamSerializer):
    def get_attrs(self, item_list, user):
        attrs = super(ProjectSummarySerializer, self).get_attrs(item_list, user)

        projects_with_user_reports = set(
            UserReport.objects.filter(project_id__in=item_list).values_list("project", flat=True)
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

        # We just return the version key here so that we cut down on response size
        latest_release_versions = {
            release.actual_project_id: {"version": release.version}
            for release in bulk_fetch_project_latest_releases(item_list)
        }

        for item in item_list:
            attrs[item]["latest_release"] = latest_release_versions.get(item.id)
            attrs[item]["deploys"] = deploys_by_project.get(item.id)
            attrs[item]["environments"] = environments_by_project.get(item.id, [])
            attrs[item]["has_user_reports"] = item.id in projects_with_user_reports

        return attrs

    def serialize(self, obj, attrs, user):
        context = {
            "team": attrs["teams"][0] if attrs["teams"] else None,
            "teams": attrs["teams"],
            "id": six.text_type(obj.id),
            "name": obj.name,
            "slug": obj.slug,
            "isBookmarked": attrs["is_bookmarked"],
            "isMember": attrs["is_member"],
            "hasAccess": attrs["has_access"],
            "dateCreated": obj.date_added,
            "environments": attrs["environments"],
            "features": attrs["features"],
            "firstEvent": obj.first_event,
            "firstTransactionEvent": True if obj.flags.has_transactions else False,
            "platform": obj.platform,
            "platforms": attrs["platforms"],
            "latestDeploys": attrs["deploys"],
            "latestRelease": attrs["latest_release"],
            "hasUserReports": attrs["has_user_reports"],
        }
        if "stats" in attrs:
            context["stats"] = attrs["stats"]
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
            u"""
        SELECT lr.project_id as actual_project_id, r.*
        FROM (
            SELECT (
                SELECT lrr.id
                FROM sentry_release lrr
                {}
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
            """.format(
                release_project_join_sql
            ),
            # formatting tuples works specifically in psycopg2
            (tuple(six.text_type(i.id) for i in projects),),
        )
    )


class DetailedProjectSerializer(ProjectWithTeamSerializer):
    OPTION_KEYS = frozenset(
        [
            # we need the epoch to fill in the defaults correctly
            "sentry:option-epoch",
            "sentry:origins",
            "sentry:resolve_age",
            "sentry:scrub_data",
            "sentry:scrub_defaults",
            "sentry:safe_fields",
            "sentry:store_crash_reports",
            "sentry:builtin_symbol_sources",
            "sentry:symbol_sources",
            "sentry:sensitive_fields",
            "sentry:csp_ignored_sources_defaults",
            "sentry:csp_ignored_sources",
            "sentry:default_environment",
            "sentry:reprocessing_active",
            "sentry:blacklisted_ips",
            "sentry:releases",
            "sentry:error_messages",
            "sentry:scrape_javascript",
            "sentry:token",
            "sentry:token_header",
            "sentry:verify_ssl",
            "sentry:scrub_ip_address",
            "sentry:grouping_config",
            "sentry:grouping_enhancements",
            "sentry:grouping_enhancements_base",
            "sentry:fingerprinting_rules",
            "sentry:relay_pii_config",
            "feedback:branding",
            "digests:mail:minimum_delay",
            "digests:mail:maximum_delay",
            "mail:subject_prefix",
            "mail:subject_template",
        ]
    )

    def get_attrs(self, item_list, user):
        attrs = super(DetailedProjectSerializer, self).get_attrs(item_list, user)

        project_ids = [i.id for i in item_list]

        num_issues_projects = (
            Project.objects.filter(id__in=project_ids)
            .annotate(num_issues=Count("processingissue"))
            .values_list("id", "num_issues")
        )

        processing_issues_by_project = {}
        for project_id, num_issues in num_issues_projects:
            processing_issues_by_project[project_id] = num_issues

        queryset = ProjectOption.objects.filter(project__in=item_list, key__in=self.OPTION_KEYS)
        options_by_project = defaultdict(dict)
        for option in queryset.iterator():
            options_by_project[option.project_id][option.key] = option.value

        orgs = {d["id"]: d for d in serialize(list(set(i.organization for i in item_list)), user)}

        latest_release_list = bulk_fetch_project_latest_releases(item_list)
        latest_releases = {
            r.actual_project_id: d
            for r, d in zip(latest_release_list, serialize(latest_release_list, user))
        }

        for item in item_list:
            attrs[item].update(
                {
                    "latest_release": latest_releases.get(item.id),
                    "org": orgs[six.text_type(item.organization_id)],
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

        data = super(DetailedProjectSerializer, self).serialize(obj, attrs, user)
        data.update(
            {
                "latestRelease": attrs["latest_release"],
                "options": {
                    "sentry:csp_ignored_sources_defaults": bool(
                        attrs["options"].get("sentry:csp_ignored_sources_defaults", True)
                    ),
                    "sentry:csp_ignored_sources": "\n".join(
                        attrs["options"].get("sentry:csp_ignored_sources", []) or []
                    ),
                    "sentry:reprocessing_active": bool(
                        attrs["options"].get("sentry:reprocessing_active", False)
                    ),
                    "filters:blacklisted_ips": "\n".join(
                        attrs["options"].get("sentry:blacklisted_ips", [])
                    ),
                    u"filters:{}".format(FilterTypes.RELEASES): "\n".join(
                        attrs["options"].get(u"sentry:{}".format(FilterTypes.RELEASES), [])
                    ),
                    u"filters:{}".format(FilterTypes.ERROR_MESSAGES): "\n".join(
                        attrs["options"].get(u"sentry:{}".format(FilterTypes.ERROR_MESSAGES), [])
                    ),
                    "feedback:branding": attrs["options"].get("feedback:branding", "1") == "1",
                },
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
                "symbolSources": attrs["options"].get("sentry:symbol_sources"),
            }
        )
        return data


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
