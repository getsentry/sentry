from collections.abc import Mapping
from typing import Any

# These fixed values keep the POC deterministic without requiring hardware experiments or
# location-aware grid data. 15 W represents the single CPU assumed by the model. The grid
# intensity rounds EPA's ~394 gCO2e/kWh estimate to avoid false precision in a rough model.
ACTIVE_CPU_WATTS = 15.0
GRID_INTENSITY_GCO2E_PER_KWH = 400.0
_GCO2E_PER_MILLISECOND = (
    ACTIVE_CPU_WATTS * GRID_INTENSITY_GCO2E_PER_KWH / 3_600_000_000
)


def estimate_gco2e_from_duration_ms(duration_ms: float) -> float:
    return duration_ms * _GCO2E_PER_MILLISECOND


def _duration_ms_from_attributes(attributes: Any) -> float | None:
    if not isinstance(attributes, list):
        return None

    for attribute in attributes:
        if not isinstance(attribute, dict) or attribute.get("name") != "span.duration":
            continue
        try:
            return float(attribute["value"])
        except (KeyError, TypeError, ValueError):
            return None

    return None


def _duration_ms_from_span(span: Mapping[str, Any]) -> float | None:
    duration_ms = span.get("duration")
    if duration_ms is None:
        # Trace item details serializes duration inside its attribute list instead of at the
        # top level, so both API response shapes need explicit support.
        return _duration_ms_from_attributes(span.get("attributes"))

    try:
        return float(duration_ms)
    except (TypeError, ValueError):
        return None


def estimate_span_climate_impact(span: Mapping[str, Any]) -> float | None:
    # The span schema has no CPU-time field. Wall duration is the closest existing proxy and
    # lets this POC ship without SDK or schema changes.
    duration_ms = _duration_ms_from_span(span)
    if duration_ms is None or duration_ms < 0:
        return None
    return estimate_gco2e_from_duration_ms(duration_ms)


def _annotate_span(span: dict[str, Any], field: str) -> None:
    estimate = estimate_span_climate_impact(span)
    if estimate is None:
        # The frontend uses field presence as the availability signal. Omitting unknown values
        # avoids presenting missing measurements as a measured zero-carbon operation.
        return
    span[field] = estimate


def annotate_trace_tree(events: Any) -> None:
    if not isinstance(events, list):
        return

    for event in events:
        if not isinstance(event, dict):
            continue
        if event.get("event_type") == "span":
            _annotate_span(event, "estimated_climate_impact_co2e_grams")
        annotate_trace_tree(event.get("children"))


def annotate_trace_summaries(traces: Any) -> None:
    if not isinstance(traces, dict) or not isinstance(traces.get("data"), list):
        return

    for trace in traces["data"]:
        if not isinstance(trace, dict):
            continue
        # The summary endpoint does not return every span, so trace wall duration provides
        # a stable estimate without an extra query or a misleading partial sum.
        _annotate_span(trace, "estimatedClimateImpactCo2eGrams")


def annotate_trace_item(item: Any) -> None:
    if isinstance(item, dict):
        _annotate_span(item, "estimatedClimateImpactCo2eGrams")
