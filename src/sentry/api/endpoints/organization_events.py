from __future__ import absolute_import

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
from sentry.api.utils import get_date_range_from_params, InvalidParams
from sentry.models import (
    Environment, OrganizationMember, OrganizationMemberTeam, Project, ProjectStatus
)
from sentry.utils.snuba import raw_query


class OrganizationEventsEndpoint(OrganizationEndpoint):

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

        environments = dict(
            Environment.objects.filter(
                organization_id=organization.id,
                name__in=requested_environments,
            ).values_list('name', 'id'),
        )

        if requested_environments != set(environments.keys()):
            raise ResourceDoesNotExist

        # snuba requires ids for filter keys
        return environments.values()

    def get(self, request, organization):
        try:
            start, end = get_date_range_from_params(request.GET)
        except InvalidParams as exc:
            return Response({'detail': exc.message}, status=400)

        try:
            project_ids = self.get_project_ids(request, organization)
        except ValueError:
            return Response({'detail': 'Invalid project ids'}, status=400)

        environments = self.get_environments(request, organization)
        params = {
            'start': start,
            'end': end,
            'project_id': project_ids,
        }
        if environments:
            params['environment'] = environments

        try:
            snuba_args = get_snuba_query_args(query=request.GET.get('query'), params=params)
        except InvalidSearchQuery as exc:
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
