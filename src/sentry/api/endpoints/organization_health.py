from __future__ import absolute_import

import re
from collections import namedtuple
from datetime import timedelta

from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from django.utils import timezone

from sentry.api.bases import OrganizationEndpoint, EnvironmentMixin
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import (
    Project, ProjectStatus, Release, OrganizationMemberTeam,
    Environment,
)
from sentry.utils import snuba


SnubaResultSet = namedtuple('SnubaResultSet', ('current', 'previous'))


def serialize_releases(organization, item_list, user):
    return {
        r.version: {
            'id': r.id,
            'version': r.version,
            'shortVersion': r.short_version,
        }
        for r in Release.objects.filter(
            organization=organization,
            version__in=item_list,
        )
    }


def serialize_eventusers(organization, item_list, user):
    # We have no reliable way to map the tag value format
    # back into real EventUser rows. EventUser is only unique
    # per-project, and this is an organization aggregate.
    # This means a single value maps to multiple rows.
    return {
        u: {
            'id': u,
            'type': u.split(':', 1)[0],
            'value': u.split(':', 1)[1],
        }
        for u in item_list
    }


def serialize_projects(organization, item_list, user):
    return {
        id: {
            'id': id,
            'slug': slug,
        }
        for id, slug in Project.objects.filter(
            id__in=item_list,
            organization=organization,
            status=ProjectStatus.VISIBLE,
        ).values_list('id', 'slug')
    }


class SnubaResultSerializer(object):
    def __init__(self, organization, tagkey, user):
        self.organization = organization
        self.tagkey = tagkey
        self.user = user
        self.name = tagkey_to_name[tagkey]

    def get_attrs(self, item_list):
        return serializer_by_tagkey[self.tagkey](self.organization, item_list, self.user)

    def serialize(self, result):
        counts_by_value = {
            r[self.tagkey]: r['count']
            for r in result.previous
        }
        projects = serialize_projects(
            self.organization,
            {p for r in result.current for p in r.get('top_projects', [])},
            self.user,
        )
        attrs = self.get_attrs(
            [r[self.tagkey] for r in result.current],
        )
        return {
            'data': [
                {
                    'count': r['count'],
                    'lastCount': counts_by_value.get(r[self.tagkey], 0),
                    'topProjects': [projects[p] for p in r.get('top_projects', [])],
                    'totalProjects': r.get('total_projects'),
                    self.name: attrs.get(r[self.tagkey]),
                }
                for r in result.current
            ],
        }


def parse_stats_period(period):
    """
    Convert a value such as 1h into a
    proper timedelta.
    """
    m = re.match('^(\d+)([hd])$', period)
    if not m:
        return None
    value, unit = m.groups()
    value = int(value)
    return timedelta(**{
        {'h': 'hours', 'd': 'days'}[unit]: value,
    })


TAG_USER = 'tags[sentry:user]'
TAG_RELEASE = 'tags[sentry:release]'

tagkey_to_name = {
    TAG_USER: 'user',
    TAG_RELEASE: 'release',
}

serializer_by_tagkey = {
    TAG_RELEASE: serialize_releases,
    TAG_USER: serialize_eventusers,
}

TAGKEYS = {
    'user': TAG_USER,
    'release': TAG_RELEASE,
}

MIN_STATS_PERIOD = timedelta(hours=1)
MAX_STATS_PERIOD = timedelta(days=45)
MAX_LIMIT = 50


class OrganizationHealthEndpoint(OrganizationEndpoint, EnvironmentMixin):
    def empty(self):
        return Response({'data': []})

    def get(self, request, organization):
        try:
            tagkey = TAGKEYS[request.GET['tag']]
        except KeyError:
            raise ResourceDoesNotExist

        stats_period = parse_stats_period(request.GET.get('statsPeriod', '24h'))
        if stats_period is None or stats_period < MIN_STATS_PERIOD or stats_period >= MAX_STATS_PERIOD:
            return Response({'detail': 'Invalid statsPeriod'}, status=400)

        limit = int(request.GET.get('limit', '5'))
        if limit > MAX_LIMIT:
            return Response({'detail': 'Invalid limit: max %d' % MAX_LIMIT}, status=400)
        if limit <= 0:
            return self.empty()

        project_ids = set(map(int, request.GET.getlist('project')))
        if not project_ids:
            return self.empty()

        before = project_ids.copy()
        if request.user.is_superuser:
            # Superusers can query any projects within the organization
            project_ids = set(Project.objects.filter(
                organization=organization,
                id__in=project_ids,
            ).values_list('id', flat=True))
        else:
            # Anyone else needs membership of the project
            project_ids = set(Project.objects.filter(
                organization=organization,
                teams__in=OrganizationMemberTeam.objects.filter(
                    organizationmember__user=request.user,
                    organizationmember__organization=organization,
                ).values_list('team'),
                status=ProjectStatus.VISIBLE,
                id__in=project_ids,
            ).values_list('id', flat=True))

        if project_ids != before:
            raise PermissionDenied

        if not project_ids:
            return self.empty()

        try:
            environment = self._get_environment_from_request(
                request,
                organization.id,
            )
        except Environment.DoesNotExist:
            raise ResourceDoesNotExist

        if environment is None:
            env_condition = []
        elif environment.name == '':
            env_condition = ['tags[environment]', 'IS NULL', None]
        else:
            env_condition = ['tags[environment]', '=', environment.name]

        aggregations = [('count()', '', 'count')]
        if 'topk' in request.GET:
            aggregations += [
                ('topK(3)', 'project_id', 'top_projects'),
                ('uniq', 'project_id', 'total_projects'),
            ]

        now = timezone.now()

        data = snuba.raw_query(
            end=now,
            start=now - stats_period,
            aggregations=aggregations,
            filter_keys={
                'project_id': project_ids,
            },
            conditions=[
                [tagkey, 'IS NOT NULL', None],
                env_condition,
            ],
            groupby=[tagkey],
            orderby='-count',
            limit=limit,
            referrer='health',
        )['data']

        if not data:
            return self.empty()

        values = [r[tagkey] for r in data]

        previous = snuba.raw_query(
            end=now - stats_period,
            start=now - (stats_period * 2),
            aggregations=[
                ('count()', '', 'count'),
            ],
            filter_keys={
                'project_id': project_ids,
            },
            conditions=[
                [tagkey, 'IN', values],
                env_condition,
            ],
            groupby=[tagkey],
            referrer='health',
        )['data']

        serializer = SnubaResultSerializer(organization, tagkey, request.user)
        return Response(
            serializer.serialize(
                SnubaResultSet(data, previous),
            ),
            status=200,
        )
