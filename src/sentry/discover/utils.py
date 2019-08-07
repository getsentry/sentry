from __future__ import absolute_import

import re
import six

from copy import deepcopy
from functools import partial

from sentry.utils import snuba


JSON_TYPE_MAP = {
    'UInt8': 'boolean',
    'UInt16': 'integer',
    'UInt32': 'integer',
    'UInt64': 'integer',
    'Float32': 'number',
    'Float64': 'number',
}

# Field aliases are pre-canned aggregations and field expressions
# that we want to expose to the user as simple fields. They are
# only valid when the query contains a groupby
FIELD_ALIASES = {
    'last_seen': {
        'aggregations': [
            ['max', 'timestamp', 'last_seen']
        ],
    },
    'latest_event_id': {
        'fields': [
            ['argMax', ['id', 'timestamp'], 'latest_event_id'],
        ],
    },
}


def get_json_type(snuba_type):
    """
    Convert Snuba/Clickhouse type to JSON type
    Default is string
    """

    # Ignore Nullable part
    nullable_match = re.search(r'^Nullable\((.+)\)$', snuba_type)

    if nullable_match:
        snuba_type = nullable_match.group(1)

    # Check for array
    array_match = re.search(r'^Array\(.+\)$', snuba_type)
    if array_match:
        return 'array'

    return JSON_TYPE_MAP.get(snuba_type, 'string')


def handle_results(snuba_results, query_params, projects):
    """
    Process results converting types and replacing project.id with project slugs.
    UI operations generally require slugs and not numeric IDs.
    """
    projects_map = {}
    for project in projects:
        projects_map[project.id] = project.slug

    if 'project.name' in query_params['selected_columns']:
        project_name_index = query_params['selected_columns'].index('project.name')
        snuba_results['meta'].insert(
            project_name_index, {
                'name': 'project.name', 'type': 'String'})
        if 'project.id' not in query_params['selected_columns']:
            snuba_results['meta'] = [
                field for field in snuba_results['meta'] if field['name'] != 'project.id'
            ]

        for result in snuba_results['data']:
            if 'project.id' in result:
                result['project.name'] = projects_map[result['project.id']]
                if 'project.id' not in query_params['selected_columns']:
                    del result['project.id']

    if 'project.name' in query_params['groupby']:
        project_name_index = query_params['groupby'].index('project.name')
        snuba_results['meta'].insert(
            project_name_index, {
                'name': 'project.name', 'type': 'String'})
        if 'project.id' not in query_params['groupby']:
            snuba_results['meta'] = [
                field for field in snuba_results['meta'] if field['name'] != 'project.id'
            ]

        for result in snuba_results['data']:
            if 'project.id' in result:
                result['project.name'] = projects_map[result['project.id']]
                if 'project.id' not in query_params['groupby']:
                    del result['project.id']

    # Convert snuba types to json types
    for col in snuba_results['meta']:
        col['type'] = get_json_type(col.get('type'))

    return snuba_results


def extend_groupby(fields, groupby):
    """
    Ensure that all basic selected fields are included in
    the group by clause so that we can generate a valid query.
    """
    for field in fields:
        if (isinstance(field, six.string_types) and
                field not in groupby and field not in FIELD_ALIASES):
            groupby.append(field)
    return groupby


def build_query_v1(request_data):
    has_aggregations = len(request_data.get('aggregations')) > 0

    # conditionFields are used by dashboards to conditionally generate
    # release data.
    selected_columns = request_data.get(
        'conditionFields', []) + [] if has_aggregations else request_data.get('fields', [])

    # Make sure that all selected fields are in the group by clause if there
    # are aggregations
    groupby = request_data.get('groupby') or []
    if has_aggregations:
        groupby = extend_groupby(request_data.get('fields') or [], groupby)

    return dict(
        start=request_data.get('start'),
        end=request_data.get('end'),
        groupby=groupby,
        selected_columns=selected_columns,
        conditions=request_data.get('conditions'),
        orderby=request_data.get('orderby'),
        limit=request_data.get('limit'),
        aggregations=request_data.get('aggregations'),
        rollup=request_data.get('rollup'),
        filter_keys={'project.id': request_data.get('projects')},
        arrayjoin=request_data.get('arrayjoin'),
        turbo=request_data.get('turbo'),
    )


def execute_query_v1(query_params):
    """
    Execute discover v1 queries.

    This function handles running discover queries that don't have access
    to all the aggregate functions that are offered in new discover
    """
    # Don't mutate the dict we were passed.
    query = deepcopy(query_params)

    selected_columns = query['selected_columns']
    groupby_columns = query['groupby']

    if 'project.name' in query['selected_columns']:
        selected_columns.remove('project.name')
        if 'project.id' not in selected_columns:
            selected_columns.append('project.id')

    if 'project.name' in query['groupby']:
        groupby_columns.remove('project.name')
        if 'project.id' not in groupby_columns:
            groupby_columns.append('project.id')

    for aggregation in query['aggregations']:
        if aggregation[1] == 'project.name':
            aggregation[1] = 'project.id'

    return partial(
        snuba.transform_aliases_and_query,
        referrer='discover',
        **query
    )


def build_query_v2(request_data):
    aggregations = request_data['aggregations'] or []

    # conditionFields are used by dashboards to conditionally generate
    # release data.
    selected_columns = request_data.get('fields') or []
    if 'conditionFields' in request_data:
        selected_columns = request_data.get('conditionFields') or []

    groupby = request_data.get('groupby') or []

    # Add fields required to generate links to the modal view.
    if not (aggregations or groupby):
        required_fields = ('id', 'project.name')
    else:
        required_fields = ('latest_event_id', 'project.name')
    for field in required_fields:
        if field not in selected_columns:
            selected_columns.append(field)

    if aggregations or groupby:
        for field in selected_columns[:]:
            if isinstance(field, six.string_types) and field in FIELD_ALIASES:
                selected_columns.remove(field)
                selected_columns.extend(FIELD_ALIASES[field].get('fields', []))
                aggregations.extend(FIELD_ALIASES[field].get('aggregations', []))

    # If the query has aggregates put all non-aggregate fields
    # into the group by so we end up with a query that can be run.
    if aggregations:
        groupby = extend_groupby(selected_columns, groupby)

    return dict(
        start=request_data.get('start'),
        end=request_data.get('end'),
        groupby=groupby,
        selected_columns=selected_columns,
        aggregations=aggregations,
        conditions=request_data.get('conditions'),
        orderby=request_data.get('orderby'),
        limit=request_data.get('limit'),
        rollup=request_data.get('rollup'),
        filter_keys={'project.id': request_data.get('projects')},
        arrayjoin=request_data.get('arrayjoin'),
        turbo=request_data.get('turbo'),
    )


def execute_query_v2(query_params):
    """
    Execute discover v2 queries.

    Discover v2 offers additional aggregate function support through column aliases
    that will be converted to the appropriate snuba functions here.
    """
    # Don't mutate the dict we were passed.
    query = deepcopy(query_params)

    selected_columns = query['selected_columns']
    groupby_columns = query['groupby']

    if 'project.name' in query['selected_columns']:
        selected_columns.remove('project.name')
        if 'project.id' not in selected_columns:
            selected_columns.append('project.id')

    if 'project.name' in query['groupby']:
        groupby_columns.remove('project.name')
        if 'project.id' not in groupby_columns:
            groupby_columns.append('project.id')

    for aggregation in query['aggregations']:
        if aggregation[1] == 'project.name':
            aggregation[1] = 'project.id'

    return partial(
        snuba.transform_aliases_and_query,
        referrer='discover-v2',
        **query
    )
