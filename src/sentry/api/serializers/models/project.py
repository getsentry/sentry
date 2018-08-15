from __future__ import absolute_import

import six

from collections import defaultdict
from datetime import timedelta
from django.db.models import Q
from django.db.models.aggregates import Count
from django.utils import timezone

from sentry import options, roles, tsdb
from sentry.api.serializers import register, serialize, Serializer
from sentry.api.serializers.models.plugin import PluginSerializer
from sentry.api.serializers.models.team import get_org_roles, get_team_memberships
from sentry.app import env
from sentry.auth.superuser import is_active_superuser
from sentry.constants import StatsPeriod
from sentry.digests import backend as digests
from sentry.models import (
    Project, ProjectAvatar, ProjectBookmark, ProjectOption, ProjectPlatform,
    ProjectStatus, ProjectTeam, Release, ReleaseProjectEnvironment, Deploy, UserOption, DEFAULT_SUBJECT_TEMPLATE
)
from sentry.utils.data_filters import FilterTypes

STATUS_LABELS = {
    ProjectStatus.VISIBLE: 'active',
    ProjectStatus.HIDDEN: 'deleted',
    ProjectStatus.PENDING_DELETION: 'deleted',
    ProjectStatus.DELETION_IN_PROGRESS: 'deleted',
}

STATS_PERIOD_CHOICES = {
    '30d': StatsPeriod(30, timedelta(hours=24)),
    '14d': StatsPeriod(14, timedelta(hours=24)),
    '24h': StatsPeriod(24, timedelta(hours=1)),
}


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
            ProjectTeam.objects.filter(
                project__in=item_list,
            ).select_related('team')
        )

        project_team_map = defaultdict(list)

        for pt in project_teams:
            project_team_map[pt.project_id].append(pt.team)

        team_memberships = get_team_memberships([pt.team for pt in project_teams], user)
        org_roles = get_org_roles([i.organization_id for i in item_list], user)

        is_superuser = (request and is_active_superuser(request) and request.user == user)
        result = {}
        for project in item_list:
            is_member = any(
                t.id in team_memberships for t in project_team_map.get(project.id, [])
            )
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
            result[project] = {
                'is_member': is_member,
                'has_access': has_access,
            }
        return result

    def get_attrs(self, item_list, user):
        project_ids = [i.id for i in item_list]
        if user.is_authenticated() and item_list:
            bookmarks = set(
                ProjectBookmark.objects.filter(
                    user=user,
                    project_id__in=project_ids,
                ).values_list('project_id', flat=True)
            )
            user_options = {
                (u.project_id, u.key): u.value
                for u in UserOption.objects.filter(
                    Q(user=user, project__in=item_list, key='mail:alert') |
                    Q(user=user, key='subscribe_by_default', project__isnull=True)
                )
            }
            default_subscribe = (user_options.get(
                'subscribe_by_default', '1') == '1')
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
                environment_id=self.environment_id,
            )
        else:
            stats = None

        avatars = {a.project_id: a for a in ProjectAvatar.objects.filter(project__in=item_list)}
        project_ids = [i.id for i in item_list]
        platforms = ProjectPlatform.objects.filter(
            project_id__in=project_ids,
        ).values_list('project_id', 'platform')
        platforms_by_project = defaultdict(list)
        for project_id, platform in platforms:
            platforms_by_project[project_id].append(platform)

        result = self.get_access_by_project(item_list, user)
        for item in item_list:
            result[item].update({
                'is_bookmarked': item.id in bookmarks,
                'is_subscribed':
                bool(user_options.get(
                    (item.id, 'mail:alert'),
                    default_subscribe,
                )),
                'avatar': avatars.get(item.id),
                'platforms': platforms_by_project[item.id]
            })
            if stats:
                result[item]['stats'] = stats[item.id]
        return result

    def serialize(self, obj, attrs, user):
        from sentry import features

        feature_list = []
        for feature in (
            'global-events', 'data-forwarding', 'rate-limits', 'discard-groups', 'similarity-view',
            'custom-inbound-filters',
        ):
            if features.has('projects:' + feature, obj, actor=user):
                feature_list.append(feature)

        if obj.flags.has_releases:
            feature_list.append('releases')

        status_label = STATUS_LABELS.get(obj.status, 'unknown')

        if attrs.get('avatar'):
            avatar = {
                'avatarType': attrs['avatar'].get_avatar_type_display(),
                'avatarUuid': attrs['avatar'].ident if attrs['avatar'].file_id else None
            }
        else:
            avatar = {'avatarType': 'letter_avatar', 'avatarUuid': None}

        context = {
            'id': six.text_type(obj.id),
            'slug': obj.slug,
            'name': obj.name,
            'isPublic': obj.public,
            'isBookmarked': attrs['is_bookmarked'],
            'color': obj.color,
            'dateCreated': obj.date_added,
            'firstEvent': obj.first_event,
            'features': feature_list,
            'status': status_label,
            'platform': obj.platform,
            'isInternal': obj.is_internal_project(),
            'isMember': attrs['is_member'],
            'hasAccess': attrs['has_access'],
            'avatar': avatar,
        }
        if 'stats' in attrs:
            context['stats'] = attrs['stats']
        return context


class ProjectWithOrganizationSerializer(ProjectSerializer):
    def get_attrs(self, item_list, user):
        attrs = super(ProjectWithOrganizationSerializer,
                      self).get_attrs(item_list, user)

        orgs = {d['id']: d for d in serialize(
            list(set(i.organization for i in item_list)), user)}
        for item in item_list:
            attrs[item]['organization'] = orgs[six.text_type(
                item.organization_id)]
        return attrs

    def serialize(self, obj, attrs, user):
        data = super(ProjectWithOrganizationSerializer,
                     self).serialize(obj, attrs, user)
        data['organization'] = attrs['organization']
        return data


class ProjectWithTeamSerializer(ProjectSerializer):
    def get_attrs(self, item_list, user):
        attrs = super(ProjectWithTeamSerializer,
                      self).get_attrs(item_list, user)

        project_teams = list(ProjectTeam.objects.filter(
            project__in=item_list,
        ).select_related('team'))

        teams = {pt.team_id: {
            'id': six.text_type(pt.team.id),
            'slug': pt.team.slug,
            'name': pt.team.name,
        } for pt in project_teams}

        teams_by_project_id = defaultdict(list)
        for pt in project_teams:
            teams_by_project_id[pt.project_id].append(teams[pt.team_id])

        for item in item_list:
            attrs[item]['teams'] = teams_by_project_id[item.id]
        return attrs

    def serialize(self, obj, attrs, user):
        data = super(ProjectWithTeamSerializer,
                     self).serialize(obj, attrs, user)
        # TODO(jess): remove this when this is deprecated
        try:
            data['team'] = attrs['teams'][0]
        except IndexError:
            pass
        data['teams'] = attrs['teams']
        return data


class ProjectSummarySerializer(ProjectWithTeamSerializer):
    def get_attrs(self, item_list, user):
        attrs = super(ProjectSummarySerializer,
                      self).get_attrs(item_list, user)

        release_project_envs = list(ReleaseProjectEnvironment.objects.filter(
            project__in=item_list,
            last_deploy_id__isnull=False
        ).values('release__version', 'environment__name', 'last_deploy_id', 'project__id'))

        deploys = dict(
            Deploy.objects.filter(
                id__in=[
                    rpe['last_deploy_id'] for rpe in release_project_envs]).values_list(
                'id',
                'date_finished'))

        deploys_by_project = defaultdict(dict)

        for rpe in release_project_envs:
            env_name = rpe['environment__name']
            project_id = rpe['project__id']
            date_finished = deploys[rpe['last_deploy_id']]

            if (
                env_name not in deploys_by_project[project_id] or
                deploys_by_project[project_id][env_name]['dateFinished'] < date_finished
            ):
                deploys_by_project[project_id][env_name] = {
                    'version': rpe['release__version'],
                    'dateFinished': date_finished
                }

        for item in item_list:
            attrs[item]['deploys'] = deploys_by_project.get(item.id)

        return attrs

    def serialize(self, obj, attrs, user):
        context = {
            'team': attrs['teams'][0] if attrs['teams'] else None,
            'teams': attrs['teams'],
            'id': six.text_type(obj.id),
            'name': obj.name,
            'slug': obj.slug,
            'isBookmarked': attrs['is_bookmarked'],
            'isMember': attrs['is_member'],
            'hasAccess': attrs['has_access'],
            'dateCreated': obj.date_added,
            'firstEvent': obj.first_event,
            'platform': obj.platform,
            'platforms': attrs['platforms'],
            'latestDeploys': attrs['deploys']
        }
        if 'stats' in attrs:
            context['stats'] = attrs['stats']
        return context


class DetailedProjectSerializer(ProjectWithTeamSerializer):
    OPTION_KEYS = frozenset(
        [
            'sentry:origins',
            'sentry:resolve_age',
            'sentry:scrub_data',
            'sentry:scrub_defaults',
            'sentry:safe_fields',
            'sentry:sensitive_fields',
            'sentry:csp_ignored_sources_defaults',
            'sentry:csp_ignored_sources',
            'sentry:default_environment',
            'sentry:reprocessing_active',
            'sentry:blacklisted_ips',
            'sentry:releases',
            'sentry:error_messages',
            'sentry:scrape_javascript',
            'sentry:token',
            'sentry:token_header',
            'sentry:verify_ssl',
            'sentry:scrub_ip_address',
            'feedback:branding',
            'digests:mail:minimum_delay',
            'digests:mail:maximum_delay',
            'mail:subject_prefix',
            'mail:subject_template',
        ]
    )

    def get_attrs(self, item_list, user):
        attrs = super(DetailedProjectSerializer,
                      self).get_attrs(item_list, user)

        project_ids = [i.id for i in item_list]

        num_issues_projects = Project.objects.filter(
            id__in=project_ids
        ).annotate(num_issues=Count('processingissue')) \
            .values_list('id', 'num_issues')

        processing_issues_by_project = {}
        for project_id, num_issues in num_issues_projects:
            processing_issues_by_project[project_id] = num_issues

        latest_release_list = list(
            Release.objects.raw(
                """
            SELECT lr.project_id as actual_project_id, r.*
            FROM (
                SELECT (
                    SELECT lrr.id FROM sentry_release lrr
                    JOIN sentry_release_project lrp
                    ON lrp.release_id = lrr.id
                    WHERE lrp.project_id = p.id
                    ORDER BY COALESCE(lrr.date_released, lrr.date_added) DESC
                    LIMIT 1
                ) as release_id,
                p.id as project_id
                FROM sentry_project p
                WHERE p.id IN ({})
            ) as lr
            JOIN sentry_release r
            ON r.id = lr.release_id
        """.format(
                    ', '.join(six.text_type(i.id) for i in item_list),
                )
            )
        )

        queryset = ProjectOption.objects.filter(
            project__in=item_list,
            key__in=self.OPTION_KEYS,
        )
        options_by_project = defaultdict(dict)
        for option in queryset.iterator():
            options_by_project[option.project_id][option.key] = option.value

        orgs = {d['id']: d for d in serialize(
            list(set(i.organization for i in item_list)), user)}

        latest_releases = {
            r.actual_project_id: d
            for r, d in zip(latest_release_list, serialize(latest_release_list, user))
        }

        for item in item_list:
            attrs[item].update(
                {
                    'latest_release': latest_releases.get(item.id),
                    'org': orgs[six.text_type(item.organization_id)],
                    'options': options_by_project[item.id],
                    'processing_issues': processing_issues_by_project.get(item.id, 0),
                }
            )
        return attrs

    def serialize(self, obj, attrs, user):
        from sentry.plugins import plugins

        data = super(DetailedProjectSerializer,
                     self).serialize(obj, attrs, user)
        data.update(
            {
                'latestRelease':
                attrs['latest_release'],
                'options': {
                    'sentry:csp_ignored_sources_defaults':
                    bool(attrs['options'].get(
                        'sentry:csp_ignored_sources_defaults', True)),
                    'sentry:csp_ignored_sources':
                    '\n'.join(attrs['options'].get(
                        'sentry:csp_ignored_sources', []) or []),
                    'sentry:reprocessing_active':
                    bool(attrs['options'].get(
                        'sentry:reprocessing_active', False)),
                    'filters:blacklisted_ips':
                    '\n'.join(attrs['options'].get(
                        'sentry:blacklisted_ips', [])),
                    'filters:{}'.format(FilterTypes.RELEASES):
                    '\n'.join(attrs['options'].get(
                        'sentry:{}'.format(FilterTypes.RELEASES), [])),
                    'filters:{}'.format(FilterTypes.ERROR_MESSAGES):
                    '\n'.
                    join(attrs['options'].get('sentry:{}'.format(
                        FilterTypes.ERROR_MESSAGES), [])),
                    'feedback:branding':
                    attrs['options'].get('feedback:branding', '1') == '1',
                },
                'digestsMinDelay':
                attrs['options'].get(
                    'digests:mail:minimum_delay',
                    digests.minimum_delay,
                ),
                'digestsMaxDelay':
                attrs['options'].get(
                    'digests:mail:maximum_delay',
                    digests.maximum_delay,
                ),
                'subjectPrefix':
                attrs['options'].get('mail:subject_prefix', options.get('mail.subject-prefix')),
                'allowedDomains':
                attrs['options'].get(
                    'sentry:origins', ['*']),
                'resolveAge':
                int(attrs['options'].get('sentry:resolve_age', 0)),
                'dataScrubber':
                bool(attrs['options'].get('sentry:scrub_data', True)),
                'dataScrubberDefaults':
                bool(attrs['options'].get('sentry:scrub_defaults', True)),
                'safeFields':
                attrs['options'].get('sentry:safe_fields', []),
                'sensitiveFields':
                attrs['options'].get('sentry:sensitive_fields', []),
                'subjectTemplate':
                attrs['options'].get(
                    'mail:subject_template') or DEFAULT_SUBJECT_TEMPLATE.template,
                'securityToken': attrs['options'].get('sentry:token') or obj.get_security_token(),
                'securityTokenHeader': attrs['options'].get('sentry:token_header'),
                'verifySSL': bool(attrs['options'].get('sentry:verify_ssl', False)),
                'scrubIPAddresses': bool(attrs['options'].get('sentry:scrub_ip_address', False)),
                'scrapeJavaScript': bool(attrs['options'].get('sentry:scrape_javascript', True)),
                'organization':
                attrs['org'],
                'plugins':
                serialize(
                    [
                        plugin for plugin in plugins.configurable_for_project(obj, version=None)
                        if plugin.has_project_conf()
                    ], user, PluginSerializer(obj)
                ),
                'platforms':
                attrs['platforms'],
                'processingIssues':
                attrs['processing_issues'],
                'defaultEnvironment':
                attrs['options'].get('sentry:default_environment'),
            }
        )
        return data


class SharedProjectSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        from sentry import features

        feature_list = []
        for feature in ('global-events', ):
            if features.has('projects:' + feature, obj, actor=user):
                feature_list.append(feature)

        return {
            'slug': obj.slug,
            'name': obj.name,
            'color': obj.color,
            'features': feature_list,
            'organization': {
                'slug': obj.organization.slug,
                'name': obj.organization.name,
            },
        }
