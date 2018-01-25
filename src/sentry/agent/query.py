from __future__ import absolute_import

import six

from rest_framework import status


class InvalidQuery(Exception):
    # TODO(hazat): maybe create all possible errors and exceptions in one place
    message = 'Unsupported query type'
    code = 1001
    response = {'error': message, 'code': code}
    status_code = status.HTTP_400_BAD_REQUEST


def parse(body):
    try:
        from django.utils.importlib import import_module

        query_results = {}
        for query_id, query in six.iteritems(body.get('queries', {})):
            # TODO(hazat): check security not all imports allowed
            agent_query = import_module('sentry.agent.queries.%s' % query.get('type', None))
            execute = getattr(agent_query, 'execute')
            query_results[query_id] = execute(query.get('data', None))
        return query_results

    except ImportError:
        raise InvalidQuery
