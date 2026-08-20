import pytest

from sentry.utils.climate_impact import (
    ACTIVE_CPU_WATTS,
    GRID_INTENSITY_GCO2E_PER_KWH,
    annotate_trace_item,
    annotate_trace_summaries,
    annotate_trace_tree,
    duration_ms_from_span,
    estimate_gco2e_from_duration_ms,
    estimate_span_climate_impact,
)


def test_estimate_gco2e_from_duration_ms() -> None:
    # 1s * 15W / 3_600_000 * 400 g/kWh = 0.001666... g
    assert estimate_gco2e_from_duration_ms(1000.0) == pytest.approx(
        ACTIVE_CPU_WATTS * 1.0 / 3_600_000.0 * GRID_INTENSITY_GCO2E_PER_KWH
    )
    assert estimate_gco2e_from_duration_ms(0.0) == 0.0


def test_duration_ms_from_span_shapes() -> None:
    assert duration_ms_from_span({"duration": 1500}) == 1500.0
    assert duration_ms_from_span({"span.duration": "2500"}) == 2500.0
    assert duration_ms_from_span({"duration_ms": 10}) == 10.0
    assert (
        duration_ms_from_span(
            {
                "attributes": [
                    {"name": "span.op", "value": "db"},
                    {"name": "span.duration", "value": "1000"},
                ]
            }
        )
        == 1000.0
    )
    assert duration_ms_from_span({"start_timestamp": 100.0, "end_timestamp": 101.5}) == 1500.0
    assert duration_ms_from_span({}) is None
    assert duration_ms_from_span({"duration": "nope"}) is None
    assert duration_ms_from_span({"duration": -1}) is None


def test_estimate_span_climate_impact_missing_duration() -> None:
    assert estimate_span_climate_impact({}) is None


def test_annotate_trace_tree() -> None:
    events = [
        {
            "event_type": "span",
            "duration": 1000,
            "children": [
                {"event_type": "span", "duration": 500},
                {"event_type": "error", "duration": 500},
                {"event_type": "span"},  # missing duration
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
    traces = {
        "data": [
            {"trace": "a", "duration": 60_000, "numSpans": 4},
            {"trace": "b", "numSpans": 2},  # no duration
        ]
    }
    annotate_trace_summaries(traces)
    assert traces["data"][0]["estimatedClimateImpactCo2eGrams"] == pytest.approx(
        estimate_gco2e_from_duration_ms(60_000)
    )
    assert "estimatedClimateImpactCo2eGrams" not in traces["data"][1]


def test_annotate_trace_item() -> None:
    item = {
        "itemId": "abc",
        "attributes": [{"name": "span.duration", "type": "int", "value": "1000"}],
    }
    annotate_trace_item(item)
    assert item["estimatedClimateImpactCo2eGrams"] == pytest.approx(
        estimate_gco2e_from_duration_ms(1000)
    )

    empty = {"itemId": "xyz", "attributes": []}
    annotate_trace_item(empty)
    assert "estimatedClimateImpactCo2eGrams" not in empty
