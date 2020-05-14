from __future__ import absolute_import

import logging

get_by_id_methods = [
    "get_next_event_id",
    "get_prev_event_id",
    "get_earliest_event_id",
    "get_latest_event_id",
]

methods_to_test = get_by_id_methods

logger = logging.getLogger("sentry.eventstore")


def selector_func(context, method, callargs):
    if method in methods_to_test:
        return ["snuba", "snuba_discover"]

    return ["snuba"]


def callback_func(context, method, callargs, backends, results):
    """
    Log if results are different
    """
    if backends == ["snuba", "snuba_discover"]:
        if method in get_by_id_methods:
            snuba_result = results[0].result()
            snuba_discover_result = results[1].result()

            if snuba_result != snuba_discover_result:
                logger.info(
                    "discover.result-mismatch",
                    extra={
                        "method": method,
                        "event_id": callargs["event"].event_id,
                        "filter_keys": callargs["filter"].filter_keys,
                        "conditions": callargs["filter"].conditions,
                        "snuba_result": results[0].result(),
                        "snuba_discover_result": results[1].result(),
                    },
                )
