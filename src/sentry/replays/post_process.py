from typing import Any, Dict, List, Optional


def process_raw_response(response: Dict[str, Any], fields: List[str]) -> Dict[str, Any]:
    """Process the response further into the expected output."""
    make_tags_object(response)
    add_trace_id_computed_fields(response)  # 2 queries

    restricted_response = restrict_response_by_fields(fields, response)
    return restricted_response


def restrict_response_by_fields(
    fields: Optional[List[str]], payload: Dict[str, Any]
) -> Dict[str, Any]:
    """Return only the fields requested by the client."""
    if fields:
        return {field: payload[field] for field in fields}
    else:
        return payload


def make_tags_object(payload: List[Dict[str, Any]]) -> None:
    """Zip the tag keys and values into a tags dictionary."""
    for item in payload:
        keys = item.pop("tags.key")
        values = item.pop("tags.value")
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

    # Set longest_transaction from the max of all transaction times found.
    for item in payload:
        item["longest_transaction"] = max(
            trace_performance_metrics_map.get(trace_id, 0) for trace_id in item["trace_ids"]
        )

    return None


def _make_count_errors_object(trace_ids: List[str]) -> Dict[str, int]:
    """Return a map of trace_id => error count."""
    # TODO: How do we look up errors?
    return {}


def _make_performance_metrics_object(trace_ids: List[str]) -> Dict[str, int]:
    """Return a map of trace_id => time in milliseconds."""
    # TODO: How do we look up performance metrics?
    return {}
