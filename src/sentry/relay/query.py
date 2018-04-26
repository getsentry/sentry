from __future__ import absolute_import

import six

from rest_framework import status


class InvalidQuery(Exception):
    # TODO(hazat): maybe create all possible errors and exceptions in one place
    message = 'Unsupported query type'
    code = 1001
    response = {'error': message, 'code': code}
    status_code = status.HTTP_400_BAD_REQUEST


def execute_queries(relay, queries):
    from django.utils.importlib import import_module

    query_results = {}
    for query_id, query in six.iteritems(queries):
        # TODO(hazat): check security not all imports allowed
        try:
            relay_query = import_module('sentry.relay.queries.%s' % query.get('type', None))
        except ImportError:
            result = {
                'status': 'error',
                'error': 'unknown query'
            }
        else:
            execute = getattr(relay_query, 'execute')
            # TODO(mitsuhiko): support for pending or failing queries
            result = {
                'status': 'ok',
                'result': execute(relay, query.get('project_id'), query.get('data')),
            }
        query_results[query_id] = result

    return query_results
