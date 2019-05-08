from __future__ import absolute_import

from rest_framework.exceptions import PermissionDenied

from sentry import features
from sentry.api.bases import OrganizationEndpoint, OrganizationEventsError
from sentry.api.event_search import get_snuba_query_args, InvalidSearchQuery
from sentry.models.project import Project


class OrganizationEventsEndpointBase(OrganizationEndpoint):

    def get_snuba_query_args(self, request, organization):
        params = self.get_filter_params(request, organization)

        group_ids = set(map(int, request.GET.getlist('group')))
        if group_ids:
            projects = Project.objects.filter(
                organization=organization,
                group__id__in=group_ids,
            ).distinct()
            if any(p for p in projects if not request.access.has_project_access(p)):
                raise PermissionDenied
            params['issue.id'] = list(group_ids)
            params['project_id'] = list(set([p.id for p in projects] + params['project_id']))

        query = request.GET.get('query')
        try:
            snuba_args = get_snuba_query_args(query=query, params=params)
        except InvalidSearchQuery as exc:
            raise OrganizationEventsError(exc.message)

        # TODO(lb): remove once boolean search is fully functional
        has_boolean_op_flag = features.has(
            'organizations:boolean-search',
            organization,
            actor=request.user
        )
        if snuba_args.pop('has_boolean_terms', False) and not has_boolean_op_flag:
            raise OrganizationEventsError(
                'Boolean search operator OR and AND not allowed in this search.')
        return snuba_args
