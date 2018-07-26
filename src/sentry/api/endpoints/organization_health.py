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
from sentry.api.serializers.snuba import SnubaResultSerializer, SnubaTSResultSerializer, TAG_USER, TAG_RELEASE, TAG_OS_NAME, TAG_BROWSER_NAME, value_from_row
from sentry.utils import snuba


SnubaResultSet = namedtuple('SnubaResultSet', ('current', 'previous'))
SnubaTSResult = namedtuple('SnubaTSResult', ('data', 'start', 'end', 'rollup'))


def parse_stats_period(period):
    """
    Convert a value such as 1h into a
    proper timedelta.
    """
    m = re.match('^(\d+)([hdms])$', period)
    if not m:
        return None
    value, unit = m.groups()
    value = int(value)
    return timedelta(**{
        {'h': 'hours', 'd': 'days', 'm': 'minutes', 's': 'seconds'}[unit]: value,
    })


def query(**kwargs):
    kwargs['referrer'] = 'health'
    return snuba.raw_query(**kwargs)['data']


class OrganizationHealthEndpointBase(OrganizationEndpoint, EnvironmentMixin):
    TAGKEYS = {
        'user': TAG_USER,
        'release': TAG_RELEASE,
        'os.name': TAG_OS_NAME,
        'browser.name': TAG_BROWSER_NAME,
    }

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
            environment = self._get_environment_from_request(
                request,
                organization.id,
            )
        except Environment.DoesNotExist:
            raise ResourceDoesNotExist

        if environment is None:
            return []
        if environment.name == '':
            return ['tags[environment]', 'IS NULL', None]
        return ['tags[environment]', '=', environment.name]


class OrganizationHealthTopEndpoint(OrganizationHealthEndpointBase):
    MIN_STATS_PERIOD = timedelta(hours=1)
    MAX_STATS_PERIOD = timedelta(days=45)
    MAX_LIMIT = 50

    def get(self, request, organization):
        try:
            tagkey = self.TAGKEYS[request.GET['tag']]
        except KeyError:
            raise ResourceDoesNotExist

        stats_period = parse_stats_period(request.GET.get('statsPeriod', '24h'))
        if stats_period is None or stats_period < self.MIN_STATS_PERIOD or stats_period >= self.MAX_STATS_PERIOD:
            return Response({'detail': 'Invalid statsPeriod'}, status=400)

        limit = int(request.GET.get('limit', '5'))
        if limit > self.MAX_LIMIT:
            return Response({'detail': 'Invalid limit: max %d' % self.MAX_LIMIT}, status=400)
        if limit <= 0:
            return self.empty()

        project_ids = self.get_project_ids(request, organization)
        if not project_ids:
            return self.empty()

        environment = self.get_environment(request, organization)

        aggregations = [('count()', '', 'count')]
        if 'topk' in request.GET:
            topk = int(request.GET['topk'])
            aggregations += [
                ('topK(%d)' % topk, 'project_id', 'top_projects'),
                ('uniq', 'project_id', 'total_projects'),
            ]

        # snuba groupby can't be a tuple
        groupby = list(tagkey)

        now = timezone.now()

        data = query(
            end=now,
            start=now - stats_period,
            aggregations=aggregations,
            filter_keys={
                'project_id': project_ids,
            },
            conditions=[
                [tagkey[0], 'IS NOT NULL', None],
                environment,
            ],
            groupby=groupby,
            orderby='-count',
            limit=limit,
        )

        if not data:
            return self.empty()

        values = [value_from_row(r, tagkey) for r in data]

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
                # This isn't really right, and is relying on the fact
                # that project_id is the other key in this composite key
                [tagkey[0], 'IN', [v[0] for v in values]],
                environment,
            ],
            groupby=groupby,
        )

        serializer = SnubaResultSerializer(organization, tagkey, request.user)
        return Response(
            serializer.serialize(
                SnubaResultSet(data, previous),
            ),
            status=200,
        )


class OrganizationHealthGraphEndpoint(OrganizationHealthEndpointBase):
    MIN_STATS_PERIOD = timedelta(hours=1)
    MAX_STATS_PERIOD = timedelta(days=90)

    def get(self, request, organization):
        try:
            tagkey = self.TAGKEYS[request.GET['tag']]
        except KeyError:
            raise ResourceDoesNotExist

        stats_period = parse_stats_period(request.GET.get('statsPeriod', '24h'))
        if stats_period is None or stats_period < self.MIN_STATS_PERIOD or stats_period >= self.MAX_STATS_PERIOD:
            return Response({'detail': 'Invalid statsPeriod'}, status=400)

        interval = parse_stats_period(request.GET.get('interval', '1h'))
        if interval is None:
            interval = timedelta(hours=1)

        project_ids = self.get_project_ids(request, organization)
        if not project_ids:
            return self.empty()

        environment = self.get_environment(request, organization)

        now = timezone.now()

        data = query(
            end=now,
            start=now - stats_period,
            rollup=interval.total_seconds(),
            aggregations=[
                ('uniq', tagkey, 'count'),
            ],
            filter_keys={
                'project_id': project_ids,
            },
            conditions=[
                [tagkey, 'IS NOT NULL', None],
                environment,
            ],
            groupby=['time'],
            orderby='time',
        )
        # TODO: Use proper serializer
        return Response({'data': data})


class OrganizationHealthGraph2Endpoint(OrganizationHealthEndpointBase):
    MIN_STATS_PERIOD = timedelta(hours=1)
    MAX_STATS_PERIOD = timedelta(days=90)

    def get(self, request, organization):
        try:
            tagkey = self.TAGKEYS[request.GET['tag']]
        except KeyError:
            raise ResourceDoesNotExist

        stats_period = parse_stats_period(request.GET.get('statsPeriod', '24h'))
        if stats_period is None or stats_period < self.MIN_STATS_PERIOD or stats_period >= self.MAX_STATS_PERIOD:
            return Response({'detail': 'Invalid statsPeriod'}, status=400)

        interval = parse_stats_period(request.GET.get('interval', '1h'))
        if interval is None:
            interval = timedelta(hours=1)

        project_ids = self.get_project_ids(request, organization)
        if not project_ids:
            return self.empty()

        environment = self.get_environment(request, organization)

        end = timezone.now()
        start = end - stats_period
        rollup = int(interval.total_seconds())

        data = query(
            end=end,
            start=start,
            rollup=rollup,
            aggregations=[
                ('count()', '', 'count'),
                # ('uniq', tagkey[0], 'uniq'),
            ],
            filter_keys={
                'project_id': project_ids,
            },
            conditions=[
                [tagkey[0], 'IS NOT NULL', None],
                environment,
            ],
            groupby=['time'] + list(tagkey),
            orderby='time',
        )

        serializer = SnubaTSResultSerializer(organization, tagkey, request.user)
        return Response(
            serializer.serialize(
                SnubaTSResult(data, start, end, rollup),
            ),
            status=200,
        )
