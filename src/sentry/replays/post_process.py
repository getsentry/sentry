from typing import Any, Dict, List, Optional

REPLAYS_RECORDING_SEQUENCE_KEY = "p:{project_id}:r:{replay_id}:seq:{sequence_id}"


def process_raw_response(response: List[Dict[str, Any]], fields: List[str]) -> Dict[str, Any]:
    """Process the response further into the expected output."""
    normalize_aliased_fields(response)
    make_tags_object(response)
    add_trace_id_computed_fields(response)  # 2 queries

    restricted_response = restrict_response_by_fields(fields, response)
    return restricted_response


def normalize_aliased_fields(response: List[Dict[str, Any]]) -> None:
    """For each payload in the response strip "agg_" prefixes."""
    for item in response:
        item["project_id"] = item.pop("agg_project_id")


def restrict_response_by_fields(
    fields: Optional[List[str]],
    payload: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Return only the fields requested by the client."""
    if fields:
        return [{field: item[field] for field in fields} for item in payload]
    else:
        return payload


def make_tags_object(payload: List[Dict[str, Any]]) -> None:
    """Zip the tag keys and values into a tags dictionary."""
    for item in payload:
        keys = item.pop("tags.key", []) or []
        values = item.pop("tags.value", []) or []

        if len(keys) != len(values):
            item["tags"] = {}
        else:
            item["tags"] = dict(zip(keys, values))


def add_trace_id_computed_fields(payload: List[Dict[str, Any]]) -> None:
    """Add count_errors and longest_transaction fields to response output."""
    # Collect the trace_ids.
    trace_ids = []
    for item in payload:
        trace_ids.extend(item["trace_ids"])

    # Issue a single query to map the trace_id to the number of errors
    # associated.
    trace_error_count_map = _make_count_errors_object(trace_ids)

    # Accumulate error counts and stash on the response payload.
    for item in payload:
        count_errors = 0
        for trace_id in item["trace_ids"]:
            count_errors += trace_error_count_map.get(trace_id, 0)
        item["count_errors"] = count_errors

    # Issue a single query to map trace_id to the recorded transaction
    # length.
    trace_performance_metrics_map = _make_performance_metrics_object(trace_ids)

    for item in payload:
        # Set longest_transaction from the max of all transaction times found.
        m = [trace_performance_metrics_map.get(trace_id, 0) for trace_id in item["trace_ids"]]
        item["longest_transaction"] = max(m) if m else 0

    return None


def _make_count_errors_object(trace_ids: List[str]) -> Dict[str, int]:
    """Return a map of trace_id => error count."""
    # TODO: How do we look up errors?
    return {}


def _make_performance_metrics_object(trace_ids: List[str]) -> Dict[str, int]:
    """Return a map of trace_id => time in milliseconds."""
    # TODO: How do we look up performance metrics?
    return {}
