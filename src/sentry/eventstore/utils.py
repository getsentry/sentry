from __future__ import absolute_import

import logging

methods_to_test = [
    "get_next_event_id",
    "get_prev_event_id",
    "get_earliest_event_id",
    "get_latest_event_id",
]

logger = logging.getLogger("sentry.eventstore")


def selector_func(context, method, callargs):
    if method in methods_to_test:
        return ["snuba", "snuba_discover"]

    return ["snuba"]


def callback_func(context, method, callargs, backends, results):
    """
    Log if results are different
    """
    if backends == ["snuba", "snuba_discover"] and method in methods_to_test:
        if results[0].result() != results[1].result():
            logger.info(
                "discover.result-mismatch",
                extra={
                    "method": method,
                    "callargs": callargs,
                    "snuba": results[0].result(),
                    "snuba_discover": results[1].result(),
                },
            )
