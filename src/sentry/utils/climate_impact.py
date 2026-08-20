from collections.abc import Mapping
from typing import Any


def estimate_span_climate_impact_usd(span: Mapping[str, Any]) -> float:
    return 1.0


def annotate_trace_tree(events: Any) -> None:
    """Walk children of event list; stamp only event_type == 'span'."""
    if not isinstance(events, list):
        return
    for event in events:
        if isinstance(event, dict) and event.get("event_type") == "span":
            event["estimated_climate_impact_usd"] = estimate_span_climate_impact_usd(event)
        children = event.get("children") if isinstance(event, dict) else None
        if children is not None:
            annotate_trace_tree(children)


def annotate_trace_summaries(traces: Any) -> None:
    """Annotate /traces/ results; each row gets estimatedClimateImpactUsd = numSpans * 1.0."""
    if isinstance(traces, dict):
        data = traces.get("data")
        if isinstance(data, list):
            for row in data:
                if isinstance(row, dict) and "numSpans" in row:
                    row["estimatedClimateImpactUsd"] = row.get(
                        "numSpans", 0
                    ) * estimate_span_climate_impact_usd({})


def annotate_trace_item(item: Any) -> None:
    """Stamp item response for spans; no event_type here."""
    if isinstance(item, dict):
        item["estimatedClimateImpactUsd"] = estimate_span_climate_impact_usd({})
