from __future__ import absolute_import

from rest_framework.exceptions import PermissionDenied

from sentry import roles
from sentry.api.bases import OrganizationEndpoint
from sentry.api.event_search import get_snuba_query_args, InvalidSearchQuery
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.utils import get_date_range_from_params, InvalidParams
from sentry.models import (
    Environment, OrganizationMember, OrganizationMemberTeam, Project, ProjectStatus
)


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
