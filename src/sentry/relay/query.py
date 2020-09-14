from __future__ import absolute_import

from importlib import import_module

import six

from sentry.relay.queries.base import InvalidQuery
from sentry.relay.utils import type_to_class_name


def execute_queries(relay, queries):
    query_results = {}
    for query_id, query in six.iteritems(queries):
        try:
            relay_query = import_module("sentry.relay.queries.%s" % query.get("type", None))
        except ImportError:
            result = {"status": "error", "error": "unknown query"}
        else:
            query_class = getattr(relay_query, type_to_class_name(query.get("type", None)))
            query_inst = query_class(relay)

            try:
                query_inst.preprocess(query)
            except InvalidQuery as exc:
                result = {"status": "error", "error": six.binary_type(exc)}
            else:
                # TODO(mitsuhiko): support for pending or failing queries
                result = {"status": "ok", "result": query_inst.execute()}
        query_results[query_id] = result

    return query_results
