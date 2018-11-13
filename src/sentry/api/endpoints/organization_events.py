from __future__ import absolute_import

from collections import namedtuple
from datetime import timedelta
from functools32 import partial

from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from sentry import roles
from sentry.api.bases import OrganizationEndpoint
from sentry.api.event_search import get_snuba_query_args, InvalidSearchQuery
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.event import SnubaEvent
from sentry.api.serializers.snuba import SnubaTSResultSerializer
from sentry.api.utils import get_date_range_from_params, InvalidParams
from sentry.models import (
    Environment, OrganizationMember, OrganizationMemberTeam, Project, ProjectStatus
)
from sentry.utils.dates import parse_stats_period
from sentry.utils.snuba import raw_query


SnubaTSResult = namedtuple('SnubaTSResult', ('data', 'start', 'end', 'rollup'))


class OrganizationEventsError(Exception):
    pass


class OrganizationEventsEndpointBase(OrganizationEndpoint):

    def get_project_ids(self, request, organization):
        project_ids = set(map(int, request.GET.getlist('project')))

        requested_projects = project_ids.copy()

        try:
            om_role = OrganizationMember.objects.filter(
                user=request.user,
                organization=organization,
            ).values_list('role', flat=True).get()
        except OrganizationMember.DoesNotExist:
            om_role = None

        if request.user.is_superuser or (om_role and roles.get(om_role).is_global):
            qs = Project.objects.filter(
                organization=organization,
                status=ProjectStatus.VISIBLE,
            )
        else:
            qs = Project.objects.filter(
                organization=organization,
                teams__in=OrganizationMemberTeam.objects.filter(
                    organizationmember__user=request.user,
                    organizationmember__organization=organization,
                ).values_list('team'),
                status=ProjectStatus.VISIBLE,
            )

        if project_ids:
            qs = qs.filter(id__in=project_ids)

        project_ids = set(qs.values_list('id', flat=True))

        if requested_projects and project_ids != requested_projects:
            raise PermissionDenied

        return list(project_ids)

    def get_environments(self, request, organization):
        requested_environments = set(request.GET.getlist('environment'))

        if not requested_environments:
            return []

        environments = set(
            Environment.objects.filter(
                organization_id=organization.id,
                name__in=requested_environments,
            ).values_list('name', flat=True),
        )

        if requested_environments != environments:
            raise ResourceDoesNotExist

        return list(environments)

    def get_snuba_query_args(self, request, organization):
        try:
            start, end = get_date_range_from_params(request.GET)
        except InvalidParams as exc:
            raise OrganizationEventsError(exc.message)

        try:
            project_ids = self.get_project_ids(request, organization)
        except ValueError:
            raise OrganizationEventsError('Invalid project ids')

        environments = self.get_environments(request, organization)
        params = {
            'start': start,
            'end': end,
            'project_id': project_ids,
        }
        if environments:
            params['environment'] = environments

        try:
            return get_snuba_query_args(query=request.GET.get('query'), params=params)
        except InvalidSearchQuery as exc:
            raise OrganizationEventsError(exc.message)


class OrganizationEventsEndpoint(OrganizationEventsEndpointBase):

    def get(self, request, organization):
        try:
            snuba_args = self.get_snuba_query_args(request, organization)
        except OrganizationEventsError as exc:
            return Response({'detail': exc.message}, status=400)

        data_fn = partial(
            # extract 'data' from raw_query result
            lambda *args, **kwargs: raw_query(*args, **kwargs)['data'],
            selected_columns=SnubaEvent.selected_columns,
            orderby='-timestamp',
            referrer='api.organization-events',
            **snuba_args
        )

        return self.paginate(
            request=request,
            on_results=lambda results: serialize(
                [SnubaEvent(row) for row in results], request.user),
            paginator=GenericOffsetPaginator(data_fn=data_fn)
        )


class OrganizationEventsStatsEndpoint(OrganizationEventsEndpointBase):

    def get(self, request, organization):
        try:
            snuba_args = self.get_snuba_query_args(request, organization)
        except OrganizationEventsError as exc:
            return Response({'detail': exc.message}, status=400)

        interval = parse_stats_period(request.GET.get('interval', '1h'))
        if interval is None:
            interval = timedelta(hours=1)

        rollup = int(interval.total_seconds())

        result = raw_query(
            aggregations=[
                ('count()', '', 'count'),
            ],
            orderby='time',
            groupby=['time'],
            rollup=rollup,
            referrer='api.organization-events-stats',
            **snuba_args
        )

        serializer = SnubaTSResultSerializer(organization, None, request.user)
        return Response(
            serializer.serialize(
                SnubaTSResult(result, snuba_args['start'], snuba_args['end'], rollup),
            ),
            status=200,
        )
