from collections.abc import Mapping
from typing import Any


def estimate_span_climate_impact(span: Mapping[str, Any]) -> float:
    """Estimate climate impact in grams of CO₂ equivalent."""
    return 1.0  # 1g CO₂e per span as placeholder


def annotate_trace_tree(events: Any) -> None:
    """Walk children of event list; stamp only event_type == 'span'."""
    if not isinstance(events, list):
        return
    for event in events:
        if isinstance(event, dict) and event.get("event_type") == "span":
            event["estimated_climate_impact"] = estimate_span_climate_impact(event)
        children = event.get("children") if isinstance(event, dict) else None
        if children is not None:
            annotate_trace_tree(children)


def annotate_trace_summaries(traces: Any) -> None:
    """Annotate /traces/ results; each row gets estimatedClimateImpact = numSpans * 1.0."""
    if not isinstance(traces, dict):
        return
    data = traces.get("data")
    if not isinstance(data, list):
        return
    for row in data:
        if not isinstance(row, dict):
            continue
        if "numSpans" not in row:
            continue
        row["estimatedClimateImpact"] = row.get("numSpans", 0) * estimate_span_climate_impact({})


def annotate_trace_item(item: Any) -> None:
    """Stamp item response for spans; no event_type here."""
    if isinstance(item, dict):
        item["estimatedClimateImpact"] = estimate_span_climate_impact({})
