from __future__ import absolute_import

from rest_framework.exceptions import PermissionDenied

from sentry import eventstore, features
from sentry.api.bases import OrganizationEndpoint, OrganizationEventsError
from sentry.api.event_search import (
    get_snuba_query_args,
    resolve_field_list,
    InvalidSearchQuery
)
from sentry.models.project import Project


class OrganizationEventsEndpointBase(OrganizationEndpoint):
    def get_snuba_query_args(self, request, organization, params):
        query = request.GET.get('query')

        group_ids = request.GET.getlist('group')
        if group_ids:
            # TODO(mark) This parameter should be removed in the long term.
            # Instead of using this parameter clients should use `issue.id`
            # in their query string.
            try:
                group_ids = set(map(int, filter(None, group_ids)))
            except ValueError:
                raise OrganizationEventsError('Invalid group parameter. Values must be numbers')

            projects = Project.objects.filter(
                organization=organization,
                group__id__in=group_ids,
            ).distinct()
            if any(p for p in projects if not request.access.has_project_access(p)):
                raise PermissionDenied
            params['issue.id'] = list(group_ids)
            params['project_id'] = list(set([p.id for p in projects] + params['project_id']))

        try:
            snuba_args = get_snuba_query_args(query=query, params=params)
        except InvalidSearchQuery as exc:
            raise OrganizationEventsError(exc.message)

        sort = request.GET.getlist('sort')
        if sort:
            snuba_args['orderby'] = sort

        # Deprecated. `sort` should be used as it is supported by
        # more endpoints.
        orderby = request.GET.getlist('orderby')
        if orderby and 'orderby' not in snuba_args:
            snuba_args['orderby'] = orderby

        if request.GET.get('rollup'):
            try:
                snuba_args['rollup'] = int(request.GET.get('rollup'))
            except ValueError:
                raise OrganizationEventsError('rollup must be an integer.')

        fields = request.GET.getlist('field')[:]
        if fields:
            try:
                snuba_args.update(resolve_field_list(fields, snuba_args))
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

    def get_snuba_query_args_legacy(self, request, organization):
        params = self.get_filter_params(request, organization)

        group_ids = request.GET.getlist('group')
        if group_ids:
            # TODO(mark) This parameter should be removed in the long term.
            # Instead of using this parameter clients should use `issue.id`
            # in their query string.
            try:
                group_ids = set(map(int, filter(None, group_ids)))
            except ValueError:
                raise OrganizationEventsError('Invalid group parameter. Values must be numbers')

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

    def next_event_id(self, request, organization, snuba_args, event):
        """
        Returns the next event ID if there is a subsequent event matching the
        conditions provided. Ignores the project_id.
        """
        next_event = eventstore.get_next_event_id(
            event,
            conditions=snuba_args['conditions'],
            filter_keys=snuba_args['filter_keys']
        )

        if next_event:
            return next_event[1]

    def prev_event_id(self, request, organization, snuba_args, event):
        """
        Returns the previous event ID if there is a previous event matching the
        conditions provided. Ignores the project_id.
        """
        prev_event = eventstore.get_prev_event_id(
            event,
            conditions=snuba_args['conditions'],
            filter_keys=snuba_args['filter_keys']
        )

        if prev_event:
            return prev_event[1]
