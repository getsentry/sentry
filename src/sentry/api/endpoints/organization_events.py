from __future__ import absolute_import

from datetime import timedelta
from functools32 import partial

from django.utils import timezone

from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from sentry import roles
from sentry.api.bases import OrganizationEndpoint
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.event import SnubaEvent
from sentry.api.utils import parse_stats_period
from sentry.models import OrganizationMember, OrganizationMemberTeam, Project, ProjectStatus
from sentry.search.utils import parse_datetime_string, InvalidQuery
from sentry.utils.snuba import raw_query


MIN_STATS_PERIOD = timedelta(hours=1)
MAX_STATS_PERIOD = timedelta(days=90)


class InvalidParams(Exception):
    pass


def get_date_range_from_params(params):
    # Returns (start, end) or raises an `InvalidParams` exception
    now = timezone.now()

    end = now
    start = now - MAX_STATS_PERIOD

    stats_period = params.get('statsPeriod')
    if stats_period is not None:
        stats_period = parse_stats_period(stats_period)
        if stats_period is None or stats_period < MIN_STATS_PERIOD or stats_period >= MAX_STATS_PERIOD:
            raise InvalidParams('Invalid statsPeriod')
        start = now - stats_period
    elif params.get('start') or params.get('end'):
        if not all([params.get('start'), params.get('end')]):
            raise InvalidParams('start and end are both required')
        try:
            start = parse_datetime_string(params['start'])
            end = parse_datetime_string(params['end'])
        except InvalidQuery as exc:
            raise InvalidParams(exc.message)
        if start > end:
            raise InvalidParams('start must be before end')

    return (start, end)


class OrganizationEventsEndpoint(OrganizationEndpoint):

    def get_project_ids(self, request, organization):
        project_ids = set(map(int, request.GET.getlist('project')))

        requested_projects = project_ids.copy()

        om_role = OrganizationMember.objects.filter(
            user=request.user,
            organization=organization,
        ).values_list('role', flat=True).get()

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

    def get(self, request, organization):
        query = request.GET.get('query')
        conditions = []
        if query:
            conditions.append(
                [['positionCaseInsensitive', ['message', "'%s'" % (query,)]], '!=', 0])

        try:
            start, end = get_date_range_from_params(request.GET)
        except InvalidParams as exc:
            return Response({'detail': exc.message}, status=400)

        try:
            project_ids = self.get_project_ids(request, organization)
        except ValueError:
            return Response({'detail': 'Invalid project ids'}, status=400)

        data_fn = partial(
            # extract 'data' from raw_query result
            lambda *args, **kwargs: raw_query(*args, **kwargs)['data'],
            start=start,
            end=end,
            conditions=conditions,
            filter_keys={'project_id': project_ids},
            selected_columns=SnubaEvent.selected_columns,
            orderby='-timestamp',
        )

        return self.paginate(
            request=request,
            on_results=lambda results: serialize(
                [SnubaEvent(row) for row in results], request.user),
            paginator=GenericOffsetPaginator(data_fn=data_fn)
        )
