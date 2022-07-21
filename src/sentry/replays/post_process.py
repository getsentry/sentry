from typing import Any, Dict, List, Optional

REPLAYS_RECORDING_SEQUENCE_KEY = "p:{project_id}:r:{replay_id}:seq:{sequence_id}"


def process_raw_response(response: List[Dict[str, Any]], fields: List[str]) -> Dict[str, Any]:
    """Process the response further into the expected output."""
    make_tags_object(response)
    add_trace_id_computed_fields(response)  # 2 queries

    restricted_response = restrict_response_by_fields(fields, response)
    return restricted_response


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


def make_sequence_urls(payload: List[Dict[str, Any]], project_id: str) -> None:
    """Append sequence_urls field to response payload."""
    for item in payload:
        item["sequence_urls"] = _make_presigned_urls(
            project_id=project_id,
            replay_id=item["replay_id"],
            max_sequence_id=item.pop("max_sequence_id"),
        )


def _make_presigned_urls(
    project_id: str,
    replay_id: str,
    max_sequence_id: int,
) -> List[str]:
    """Return a presigned-url containing the replay's recording content."""
    # TODO!
    return [
        REPLAYS_RECORDING_SEQUENCE_KEY.format(
            project_id=project_id,
            replay_id=replay_id,
            sequence_id=max_sequence_id,
        )
        for i in range(0, max_sequence_id + 1)
    ]


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
