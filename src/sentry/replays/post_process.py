from typing import Any, Dict, List, Optional


def process_raw_response(response: List[Dict[str, Any]], fields: List[str]) -> Dict[str, Any]:
    """Process the response further into the expected output."""
    normalize_fields(response)
    add_trace_id_computed_fields(response)

    restricted_response = restrict_response_by_fields(fields, response)
    return restricted_response


def normalize_fields(response: List[Dict[str, Any]]) -> None:
    """For each payload in the response strip "agg_" prefixes."""
    for item in response:
        item["project_id"] = item.pop("agg_project_id")
        item["environment"] = item.pop("agg_environment")
        item["tags"] = dict(zip(item.pop("tags.key") or [], item.pop("tags.value") or []))
        item["user"] = {
            "id": item.pop("user_id"),
            "name": item.pop("user_name"),
            "email": item.pop("user_email"),
            "ip_address": item.pop("user_ip_address"),
        }

        # urls == [[2, url], [0, url], [1, url]]
        item["urls"] = [item[1] for item in sorted(item.pop("urls"), key=lambda url: url[0])]


def restrict_response_by_fields(
    fields: Optional[List[str]],
    payload: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Return only the fields requested by the client."""
    if fields:
        return [{field: item[field] for field in fields} for item in payload]
    else:
        return payload


def add_trace_id_computed_fields(payload: List[Dict[str, Any]]) -> None:
    """Add count_errors and longest_transaction fields to response output."""
    # Collect the trace_ids.
    trace_ids = []
    for item in payload:
        trace_ids.extend(item["trace_ids"])

    # Issue a single query to map trace_id to the recorded transaction
    # length.
    trace_performance_metrics_map = _make_performance_metrics_object(trace_ids)

    for item in payload:
        # Set longest_transaction from the max of all transaction times found.
        m = [trace_performance_metrics_map.get(trace_id, 0) for trace_id in item["trace_ids"]]
        item["longest_transaction"] = max(m) if m else 0

    return None


def _make_performance_metrics_object(trace_ids: List[str]) -> Dict[str, int]:
    """Return a map of trace_id => time in milliseconds."""
    # TODO: How do we look up performance metrics?
    return {}
