from __future__ import absolute_import

import six
from rest_framework.exceptions import PermissionDenied
from enum import Enum

from sentry.api.bases import OrganizationEndpoint, OrganizationEventsError
from sentry.api.event_search import (
    get_snuba_filter,
    InvalidSearchQuery,
    resolve_field_list,
)
from sentry.models.project import Project
from sentry.utils import snuba


class Direction(Enum):
    NEXT = 0
    PREV = 1


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
            snuba_args = get_snuba_filter(query=query, params=params).to_snuba_args()
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
            snuba_args = get_snuba_filter(query=query, params=params).to_snuba_args()
        except InvalidSearchQuery as exc:
            raise OrganizationEventsError(exc.message)

        return snuba_args

    def next_event_id(self, *args):
        """
        Returns the next event ID if there is a subsequent event matching the
        conditions provided
        """
        return self._get_next_or_prev_id(Direction.NEXT, *args)

    def prev_event_id(self, *args):
        """
        Returns the previous event ID if there is a previous event matching the
        conditions provided
        """
        return self._get_next_or_prev_id(Direction.PREV, *args)

    def _get_next_or_prev_id(self, direction, request, organization, snuba_args, event):
        if (direction == Direction.NEXT):
            time_condition = [
                ['timestamp', '>=', event.timestamp],
                [['timestamp', '>', event.timestamp], ['event_id', '>', event.event_id]]
            ]
            orderby = ['timestamp', 'event_id']
            start = max(event.datetime, snuba_args['start'])
            end = snuba_args['end']

        else:
            time_condition = [
                ['timestamp', '<=', event.timestamp],
                [['timestamp', '<', event.timestamp], ['event_id', '<', event.event_id]]
            ]
            orderby = ['-timestamp', '-event_id']
            start = snuba_args['start']
            end = min(event.datetime, snuba_args['end'])

        conditions = snuba_args['conditions'][:]
        conditions.extend(time_condition)

        result = snuba.raw_query(
            start=start,
            end=end,
            selected_columns=['event_id'],
            conditions=conditions,
            filter_keys=snuba_args['filter_keys'],
            orderby=orderby,
            limit=1,
            referrer='api.organization-events.next-or-prev-id',
        )

        if 'error' in result or len(result['data']) == 0:
            return None

        return six.text_type(result['data'][0]['event_id'])
