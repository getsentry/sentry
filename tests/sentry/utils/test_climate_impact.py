from typing import Any

import pytest

from sentry.utils.climate_impact import (
    ACTIVE_CPU_WATTS,
    GRID_INTENSITY_GCO2E_PER_KWH,
    annotate_trace_item,
    annotate_trace_summaries,
    annotate_trace_tree,
    estimate_gco2e_from_duration_ms,
    estimate_span_climate_impact,
)


def test_estimate_gco2e_from_duration_ms() -> None:
    assert estimate_gco2e_from_duration_ms(1000) == pytest.approx(
        ACTIVE_CPU_WATTS * GRID_INTENSITY_GCO2E_PER_KWH / 3_600_000
    )
    assert estimate_gco2e_from_duration_ms(0) == 0


@pytest.mark.parametrize(
    ("span", "duration_ms"),
    [
        ({"duration": 1500}, 1500),
        ({"attributes": [{"name": "span.duration", "value": "2500"}]}, 2500),
    ],
)
def test_estimate_span_climate_impact(span: dict[str, Any], duration_ms: float) -> None:
    assert estimate_span_climate_impact(span) == pytest.approx(
        estimate_gco2e_from_duration_ms(duration_ms)
    )


@pytest.mark.parametrize(
    "span",
    [
        {},
        {"duration": "invalid"},
        {"duration": -1},
        {"attributes": []},
        {"attributes": [{"name": "span.op", "value": "db"}]},
    ],
)
def test_estimate_span_climate_impact_omits_unknown_duration(span: dict[str, Any]) -> None:
    assert estimate_span_climate_impact(span) is None


def test_annotate_trace_tree() -> None:
    events = [
        {
            "event_type": "span",
            "duration": 1000,
            "children": [
                {"event_type": "span", "duration": 500},
                {"event_type": "error", "duration": 500},
                {"event_type": "span"},
            ],
        }
    ]

    annotate_trace_tree(events)

    root = events[0]
    assert root["estimated_climate_impact_co2e_grams"] == pytest.approx(
        estimate_gco2e_from_duration_ms(1000)
    )
    assert root["children"][0]["estimated_climate_impact_co2e_grams"] == pytest.approx(
        estimate_gco2e_from_duration_ms(500)
    )
    assert "estimated_climate_impact_co2e_grams" not in root["children"][1]
    assert "estimated_climate_impact_co2e_grams" not in root["children"][2]


def test_annotate_trace_summaries() -> None:
    traces = {"data": [{"duration": 60_000}, {}]}

    annotate_trace_summaries(traces)

    assert traces["data"][0]["estimatedClimateImpactCo2eGrams"] == pytest.approx(
        estimate_gco2e_from_duration_ms(60_000)
    )
    assert "estimatedClimateImpactCo2eGrams" not in traces["data"][1]


def test_annotate_trace_item() -> None:
    item = {"attributes": [{"name": "span.duration", "value": "1000"}]}
    empty = {"attributes": []}

    annotate_trace_item(item)
    annotate_trace_item(empty)

    assert item["estimatedClimateImpactCo2eGrams"] == pytest.approx(
        estimate_gco2e_from_duration_ms(1000)
    )
    assert "estimatedClimateImpactCo2eGrams" not in empty
