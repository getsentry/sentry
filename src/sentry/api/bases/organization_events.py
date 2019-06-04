from __future__ import absolute_import

from copy import deepcopy
from rest_framework.exceptions import PermissionDenied
import six

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

        if aggregations:
            snuba_args['aggregations'] = aggregations

        if groupby:
            snuba_args['groupby'] = groupby

        orderby = request.GET.get('orderby')
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

    def next_event_id(self, request, organization, snuba_args, event):
        """
        Returns the next event ID if there is a subsequent event matching the
        conditions provided
        """

        conditions = snuba_args['conditions'][:]
        conditions.extend([
            ['timestamp', '>=', event.timestamp],
            [['timestamp', '>', event.timestamp], ['event_id', '>', event.event_id]]
        ])

        result = snuba.raw_query(
            start=max(event.datetime, snuba_args['start']),
            end=snuba_args['end'],
            selected_columns=['event_id'],
            conditions=conditions,
            filter_keys=snuba_args['filter_keys'],
            orderby=['timestamp', 'event_id'],
            limit=1,
            referrer='api.organization-events.next_event_id',
        )

        if 'error' in result or len(result['data']) == 0:
            return None

        return six.text_type(result['data'][0]['event_id'])

    def prev_event_id(self, request, organization, snuba_args, event):
        """
        Returns the previous event ID if there is a previous event matching the
        conditions provided
        """

        conditions = snuba_args['conditions'][:]
        conditions.extend([
            ['timestamp', '<=', event.timestamp],
            [['timestamp', '<', event.timestamp], ['event_id', '<', event.event_id]]
        ])

        result = snuba.raw_query(
            start=snuba_args['start'],
            end=min(event.datetime, snuba_args['end']),
            selected_columns=['event_id'],
            conditions=conditions,
            filter_keys=snuba_args['filter_keys'],
            orderby=['-timestamp', '-event_id'],
            limit=1,
            referrer='api.organization-events.prev_event_id',
        )

        if 'error' in result or len(result['data']) == 0:
            return None

        return six.text_type(result['data'][0]['event_id'])
