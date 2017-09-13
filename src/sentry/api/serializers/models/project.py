from __future__ import absolute_import

import six

from collections import defaultdict
from datetime import timedelta
from django.db.models import Q
from django.db.models.aggregates import Count
from django.utils import timezone

from sentry import tsdb
from sentry.api.serializers import register, serialize, Serializer
from sentry.api.serializers.models.plugin import PluginSerializer
from sentry.constants import StatsPeriod
from sentry.digests import backend as digests
from sentry.models import (
    Project, ProjectBookmark, ProjectOption, ProjectPlatform, ProjectStatus, Release, UserOption,
    DEFAULT_SUBJECT_TEMPLATE
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

    def __init__(self, stats_period=None):
        if stats_period is not None:
            assert stats_period in STATS_PERIOD_CHOICES

        self.stats_period = stats_period

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
                model=tsdb.models.project_total_received,
                keys=project_ids,
                end=now,
                start=now - ((segments - 1) * interval),
                rollup=int(interval.total_seconds()),
            )
        else:
            stats = None

        result = {}
        for item in item_list:
            result[item] = {
                'is_bookmarked': item.id in bookmarks,
                'is_subscribed':
                bool(user_options.get(
                    (item.id, 'mail:alert'),
                    default_subscribe,
                )),
            }
            if stats:
                result[item]['stats'] = stats[item.id]
        return result

    def serialize(self, obj, attrs, user):
        from sentry import features

        feature_list = []
        for feature in (
            'global-events', 'data-forwarding', 'rate-limits', 'custom-filters', 'similarity-view',
            'custom-inbound-filters',
        ):
            if features.has('projects:' + feature, obj, actor=user):
                feature_list.append(feature)

        if obj.flags.has_releases:
            feature_list.append('releases')

        status_label = STATUS_LABELS.get(obj.status, 'unknown')

        context = {
            'id': six.text_type(obj.id),
            'slug': obj.slug,
            'name': obj.name,
            'isPublic': obj.public,
            'isBookmarked': attrs['is_bookmarked'],
            'callSign': obj.callsign,
            'color': obj.color,
            'dateCreated': obj.date_added,
            'firstEvent': obj.first_event,
            'features': feature_list,
            'status': status_label,
            'platform': obj.platform,
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

        teams = {d['id']: d for d in serialize(
            list(set(i.team for i in item_list)), user)}
        for item in item_list:
            attrs[item]['team'] = teams[six.text_type(item.team_id)]
        return attrs

    def serialize(self, obj, attrs, user):
        data = super(ProjectWithTeamSerializer,
                     self).serialize(obj, attrs, user)
        data['team'] = attrs['team']
        return data


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

        platforms = ProjectPlatform.objects.filter(
            project_id__in=project_ids,
        ).values_list('project_id', 'platform')
        platforms_by_project = defaultdict(list)
        for project_id, platform in platforms:
            platforms_by_project[project_id].append(platform)

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
                    'platforms': platforms_by_project[item.id],
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
                    'sentry:origins':
                    '\n'.join(attrs['options'].get(
                        'sentry:origins', ['*']) or []),
                    'sentry:resolve_age':
                    int(attrs['options'].get('sentry:resolve_age', 0)),
                    'sentry:scrub_data':
                    bool(attrs['options'].get('sentry:scrub_data', True)),
                    'sentry:scrub_defaults':
                    bool(attrs['options'].get('sentry:scrub_defaults', True)),
                    'sentry:safe_fields':
                    attrs['options'].get('sentry:safe_fields', []),
                    'sentry:sensitive_fields':
                    attrs['options'].get('sentry:sensitive_fields', []),
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
                attrs['options'].get('mail:subject_prefix'),
                'subjectTemplate':
                attrs['options'].get(
                    'mail:subject_template') or DEFAULT_SUBJECT_TEMPLATE.template,
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
                attrs['options'].get('default_environment'),
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
            'callSign': obj.callsign,
            'color': obj.color,
            'features': feature_list,
            'organization': {
                'slug': obj.organization.slug,
                'name': obj.organization.name,
            },
        }
