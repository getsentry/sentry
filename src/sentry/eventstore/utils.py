from __future__ import absolute_import

import logging

from sentry import options

get_by_id_methods = [
    "get_next_event_id",
    "get_prev_event_id",
    "get_earliest_event_id",
    "get_latest_event_id",
]

logger = logging.getLogger("sentry.eventstore")


def selector_func(context, method, callargs):
    if method == "get_event_by_id" and options.get("eventstore.use-nodestore"):
        return ["snuba", "nodestore"]
    if method in get_by_id_methods:
        return ["snuba", "snuba_discover"]

    return ["snuba"]


def callback_func(context, method, callargs, backends, results):
    """
    Log if results are different
    """
    if backends == ["snuba", "snuba_discover"]:
        if method in get_by_id_methods:
            snuba_result = results[0].result()
            snuba_discover_reuslt = results[1].result()

            if snuba_result != snuba_discover_reuslt:
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

    if method == "get_event_by_id" and backends == ["snuba", "nodestore"]:
        snuba_result = results[0].result()
        nodestore_result = results[1].result()

        snuba_event_id = snuba_result.event_id if snuba_result else None
        nodestore_event_id = nodestore_result.event_id if nodestore_result else None

        if snuba_event_id != nodestore_event_id:
            logger.info(
                "nodestore-snuba-mismatch",
                extra={
                    "project_id": callargs["project_id"],
                    "event_id": callargs["event_id"],
                    "snuba_result": snuba_event_id,
                    "nodestore_result": nodestore_event_id,
                },
            )
