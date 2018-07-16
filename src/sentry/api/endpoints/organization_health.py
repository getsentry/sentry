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
    Project, ProjectStatus, OrganizationMemberTeam,
    Environment,
)
from sentry.api.serializers.snuba import SnubaResultSerializer, TAG_USER, TAG_RELEASE
from sentry.utils import snuba


SnubaResultSet = namedtuple('SnubaResultSet', ('current', 'previous'))


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


def query(**kwargs):
    kwargs['referrer'] = 'health'
    return snuba.raw_query(**kwargs)['data']


TAGKEYS = {
    'user': TAG_USER,
    'release': TAG_RELEASE,
}

MIN_STATS_PERIOD = timedelta(hours=1)
MAX_STATS_PERIOD = timedelta(days=45)
MAX_LIMIT = 50


class OrganizationHealthEndpointBase(OrganizationEndpoint, EnvironmentMixin):
    def empty(self):
        return Response({'data': []})

    def get_project_ids(self, request, organization):
        project_ids = set(map(int, request.GET.getlist('project')))
        if not project_ids:
            return

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
            return

        # Make sure project_ids is now a list, otherwise
        # snuba isn't happy with it being a set
        return list(project_ids)

    def get_environment(self, request, organization):
        try:
            return self._get_environment_from_request(
                request,
                organization.id,
            )
        except Environment.DoesNotExist:
            raise ResourceDoesNotExist


class OrganizationHealthTopEndpoint(OrganizationHealthEndpointBase):
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

        project_ids = self.get_project_ids(request, organization)
        if not project_ids:
            return self.empty()

        environment = self.get_environment(request, organization)

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

        data = query(
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
        )

        if not data:
            return self.empty()

        values = [r[tagkey] for r in data]

        previous = query(
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
        )

        serializer = SnubaResultSerializer(organization, tagkey, request.user)
        return Response(
            serializer.serialize(
                SnubaResultSet(data, previous),
            ),
            status=200,
        )
