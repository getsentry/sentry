from collections.abc import Mapping, Sequence
from typing import Any

# POC constants for a simple wall-time energy model.
# Not inventory-grade carbon accounting — relative comparison only.
ACTIVE_CPU_WATTS = 15.0
# EPA eGRID2022 US national average for electricity used is ~394 gCO2/kWh
# (823.1 lb CO2/MWh + T&D losses). Rounded for the POC.
GRID_INTENSITY_GCO2E_PER_KWH = 400.0
# W·s -> kWh: divide by 1000 W/kW * 3600 s/h
_WATT_SECONDS_PER_KWH = 3_600_000.0


def estimate_gco2e_from_duration_ms(duration_ms: float) -> float:
    """Estimate grams CO₂e from duration milliseconds.

    Model: duration is treated as active CPU time on one fixed CPU.
    gCO₂e = (watts * seconds / 3_600_000) * gCO₂e/kWh
    """
    seconds = duration_ms / 1000.0
    kilowatt_hours = (ACTIVE_CPU_WATTS * seconds) / _WATT_SECONDS_PER_KWH
    return kilowatt_hours * GRID_INTENSITY_GCO2E_PER_KWH


def _coerce_duration_ms(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        duration_ms = float(value)
    except (TypeError, ValueError):
        return None
    if duration_ms < 0:
        return None
    return duration_ms


def duration_ms_from_span(span: Mapping[str, Any]) -> float | None:
    """Best-effort duration extraction across trace API payload shapes."""
    for key in ("duration", "span.duration", "duration_ms"):
        duration_ms = _coerce_duration_ms(span.get(key))
        if duration_ms is not None:
            return duration_ms

    attributes = span.get("attributes")
    if isinstance(attributes, Sequence) and not isinstance(attributes, (str, bytes)):
        for attribute in attributes:
            if not isinstance(attribute, Mapping):
                continue
            name = attribute.get("name")
            if name in ("span.duration", "duration", "duration_ms", "span.self_time"):
                duration_ms = _coerce_duration_ms(attribute.get("value"))
                if duration_ms is not None:
                    return duration_ms

    start = span.get("start_timestamp")
    end = span.get("end_timestamp")
    try:
        if start is not None and end is not None:
            # Trace tree timestamps are epoch seconds.
            return max(float(end) - float(start), 0.0) * 1000.0
    except (TypeError, ValueError):
        pass

    return None


def estimate_span_climate_impact(span: Mapping[str, Any]) -> float | None:
    """Estimate climate impact in grams of CO₂ equivalent, or None if unknown."""
    duration_ms = duration_ms_from_span(span)
    if duration_ms is None:
        return None
    return estimate_gco2e_from_duration_ms(duration_ms)


def annotate_trace_tree(events: Any) -> None:
    """Walk children of event list; stamp only event_type == 'span' when estimable."""
    if not isinstance(events, list):
        return
    for event in events:
        if isinstance(event, dict) and event.get("event_type") == "span":
            estimate = estimate_span_climate_impact(event)
            if estimate is not None:
                event["estimated_climate_impact_co2e_grams"] = estimate
        children = event.get("children") if isinstance(event, dict) else None
        if children is not None:
            annotate_trace_tree(children)


def annotate_trace_summaries(traces: Any) -> None:
    """Annotate /traces/ rows from trace wall duration when present."""
    if not isinstance(traces, dict):
        return
    data = traces.get("data")
    if not isinstance(data, list):
        return
    for row in data:
        if not isinstance(row, dict):
            continue
        estimate = estimate_span_climate_impact(row)
        if estimate is not None:
            row["estimatedClimateImpactCo2eGrams"] = estimate


def annotate_trace_item(item: Any) -> None:
    """Stamp span item responses when duration can be read from the payload."""
    if not isinstance(item, dict):
        return
    estimate = estimate_span_climate_impact(item)
    if estimate is not None:
        item["estimatedClimateImpactCo2eGrams"] = estimate
