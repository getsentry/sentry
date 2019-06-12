from __future__ import absolute_import

from copy import deepcopy
from rest_framework.exceptions import PermissionDenied
import six
from enum import Enum

from sentry import features
from sentry.api.bases import OrganizationEndpoint, OrganizationEventsError
from sentry.api.event_search import get_snuba_query_args, InvalidSearchQuery
from sentry.models.project import Project
from sentry.utils import snuba

# We support 4 "special fields" on the v2 events API which perform some
# additional calculations over aggregated event data
SPECIAL_FIELDS = {
    'issue_title': {
        'aggregations': [['anyHeavy', 'title', 'issue_title']],
    },
    'last_seen': {
        'aggregations': [['max', 'timestamp', 'last_seen']],
    },
    'event_count': {
        'aggregations': [['uniq', 'id', 'event_count']],
    },
    'user_count': {
        'aggregations': [['uniq', 'user', 'user_count']],
    },
}


class Direction(Enum):
    NEXT = 0
    PREV = 1


class OrganizationEventsEndpointBase(OrganizationEndpoint):

    def get_snuba_query_args(self, request, organization):
        params = self.get_filter_params(request, organization)

        group_ids = request.GET.getlist('group')
        if group_ids:
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

    def get_snuba_query_args_v2(self, request, organization, params):
        query = request.GET.get('query')
        try:
            snuba_args = get_snuba_query_args(query=query, params=params)
        except InvalidSearchQuery as exc:
            raise OrganizationEventsError(exc.message)

        fields = request.GET.getlist('field')[:]
        aggregations = []
        groupby = request.GET.getlist('groupby')

        if fields:
            # If project.name is requested, get the project.id from Snuba so we
            # can use this to look up the name in Sentry
            if 'project.name' in fields:
                fields.remove('project.name')
                if 'project.id' not in fields:
                    fields.append('project.id')

            for field in fields[:]:
                if field in SPECIAL_FIELDS:
                    special_field = deepcopy(SPECIAL_FIELDS[field])
                    fields.remove(field)
                    fields.extend(special_field.get('fields', []))
                    aggregations.extend(special_field.get('aggregations', []))
                    groupby.extend(special_field.get('groupby', []))

            snuba_args['selected_columns'] = fields

        conditions = snuba_args.get('conditions')
        # Add special fields to aggregations if missing
        if conditions:
            for condition in conditions:
                field = condition[0]
                if isinstance(field, (list, tuple)):
                    continue
                if field in SPECIAL_FIELDS:
                    aggregation_included = False
                    for aggregate in aggregations:
                        if aggregate[2] == field:
                            aggregation_included = True
                            break
                    if not aggregation_included:
                        aggregations.extend(deepcopy(SPECIAL_FIELDS[field]).get('aggregations', []))

        if aggregations:
            snuba_args['aggregations'] = aggregations

        if groupby:
            snuba_args['groupby'] = groupby

        orderby = request.GET.getlist('orderby')
        if orderby:
            snuba_args['orderby'] = orderby

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
