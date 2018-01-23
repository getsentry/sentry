from __future__ import absolute_import

import six

from rest_framework import status


class InvalidQuery(Exception):
    message = 'Unsupported query type'
    code = 1001
    response = {'error': message, 'code': code}
    status_code = status.HTTP_400_BAD_REQUEST


def parse(body):
    try:
        from django.utils.importlib import import_module

        query_results = {}
        for query_id, query in six.iteritems(body.get('queries', {})):
            # TODO(hazat): check security
            agent_query = import_module('sentry.agent.queries.%s' % query.get('type', None))
            execute = getattr(agent_query, 'execute')
            query_results[query_id] = execute(query.get('data', None))
        return query_results

    except ImportError:
        raise InvalidQuery
