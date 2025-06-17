from sentry.spans.consumers.process_segments.enrichment import (
    Enricher,
    segment_span_measurement_updates,
)
from tests.sentry.spans.consumers.process import build_mock_span

# Tests ported from Relay


def test_childless_spans():
    spans = [
        build_mock_span(
            project_id=1,
            is_segment=True,
            start_timestamp_precise=1609455600.0,
            end_timestamp_precise=1609455605.0,
            span_id="aaaaaaaaaaaaaaaa",
        ),
        build_mock_span(
            project_id=1,
            start_timestamp_precise=1609455601.0,
            end_timestamp_precise=1609455604.0,
            span_id="bbbbbbbbbbbbbbbb",
            parent_span_id="aaaaaaaaaaaaaaaa",
        ),
        build_mock_span(
            project_id=1,
            start_timestamp_precise=1609455601.0,
            end_timestamp_precise=1609455603.5,
            span_id="cccccccccccccccc",
            parent_span_id="aaaaaaaaaaaaaaaa",
        ),
        build_mock_span(
            project_id=1,
            start_timestamp_precise=1609455603.0,
            end_timestamp_precise=1609455604.877,
            span_id="dddddddddddddddd",
            parent_span_id="aaaaaaaaaaaaaaaa",
        ),
    ]

    _, enriched = Enricher.enrich_spans(spans)

    exclusive_times = {span["span_id"]: span["exclusive_time"] for span in enriched}
    assert exclusive_times == {
        "aaaaaaaaaaaaaaaa": 1123.0,
        "bbbbbbbbbbbbbbbb": 3000.0,
        "cccccccccccccccc": 2500.0,
        "dddddddddddddddd": 1877.0,
    }


def test_nested_spans():
    spans = [
        build_mock_span(
            project_id=1,
            is_segment=True,
            start_timestamp_precise=1609455600.0,
            end_timestamp_precise=1609455605.0,
            span_id="aaaaaaaaaaaaaaaa",
        ),
        build_mock_span(
            project_id=1,
            start_timestamp_precise=1609455601.0,
            end_timestamp_precise=1609455602.0,
            span_id="bbbbbbbbbbbbbbbb",
            parent_span_id="aaaaaaaaaaaaaaaa",
        ),
        build_mock_span(
            project_id=1,
            start_timestamp_precise=1609455601.2,
            end_timestamp_precise=1609455601.8,
            span_id="cccccccccccccccc",
            parent_span_id="bbbbbbbbbbbbbbbb",
        ),
        build_mock_span(
            project_id=1,
            start_timestamp_precise=1609455601.4,
            end_timestamp_precise=1609455601.6,
            span_id="dddddddddddddddd",
            parent_span_id="cccccccccccccccc",
        ),
    ]

    _, enriched = Enricher.enrich_spans(spans)

    exclusive_times = {span["span_id"]: span["exclusive_time"] for span in enriched}
    assert exclusive_times == {
        "aaaaaaaaaaaaaaaa": 4000.0,
        "bbbbbbbbbbbbbbbb": 400.0,
        "cccccccccccccccc": 400.0,
        "dddddddddddddddd": 200.0,
    }


def test_overlapping_child_spans():
    spans = [
        build_mock_span(
            project_id=1,
            is_segment=True,
            start_timestamp_precise=1609455600.0,
            end_timestamp_precise=1609455605.0,
            span_id="aaaaaaaaaaaaaaaa",
        ),
        build_mock_span(
            project_id=1,
            start_timestamp_precise=1609455601.0,
            end_timestamp_precise=1609455602.0,
            span_id="bbbbbbbbbbbbbbbb",
            parent_span_id="aaaaaaaaaaaaaaaa",
        ),
        build_mock_span(
            project_id=1,
            start_timestamp_precise=1609455601.2,
            end_timestamp_precise=1609455601.6,
            span_id="cccccccccccccccc",
            parent_span_id="bbbbbbbbbbbbbbbb",
        ),
        build_mock_span(
            project_id=1,
            start_timestamp_precise=1609455601.4,
            end_timestamp_precise=1609455601.8,
            span_id="dddddddddddddddd",
            parent_span_id="bbbbbbbbbbbbbbbb",
        ),
    ]

    _, enriched = Enricher.enrich_spans(spans)

    exclusive_times = {span["span_id"]: span["exclusive_time"] for span in enriched}
    assert exclusive_times == {
        "aaaaaaaaaaaaaaaa": 4000.0,
        "bbbbbbbbbbbbbbbb": 400.0,
        "cccccccccccccccc": 400.0,
        "dddddddddddddddd": 400.0,
    }


def test_child_spans_dont_intersect_parent():
    spans = [
        build_mock_span(
            project_id=1,
            is_segment=True,
            start_timestamp_precise=1609455600.0,
            end_timestamp_precise=1609455605.0,
            span_id="aaaaaaaaaaaaaaaa",
        ),
        build_mock_span(
            project_id=1,
            start_timestamp_precise=1609455601.0,
            end_timestamp_precise=1609455602.0,
            span_id="bbbbbbbbbbbbbbbb",
            parent_span_id="aaaaaaaaaaaaaaaa",
        ),
        build_mock_span(
            project_id=1,
            start_timestamp_precise=1609455600.4,
            end_timestamp_precise=1609455600.8,
            span_id="cccccccccccccccc",
            parent_span_id="bbbbbbbbbbbbbbbb",
        ),
        build_mock_span(
            project_id=1,
            start_timestamp_precise=1609455602.2,
            end_timestamp_precise=1609455602.6,
            span_id="dddddddddddddddd",
            parent_span_id="bbbbbbbbbbbbbbbb",
        ),
    ]

    _, enriched = Enricher.enrich_spans(spans)

    exclusive_times = {span["span_id"]: span["exclusive_time"] for span in enriched}
    assert exclusive_times == {
        "aaaaaaaaaaaaaaaa": 4000.0,
        "bbbbbbbbbbbbbbbb": 1000.0,
        "cccccccccccccccc": 400.0,
        "dddddddddddddddd": 400.0,
    }


def test_child_spans_extend_beyond_parent():
    spans = [
        build_mock_span(
            project_id=1,
            is_segment=True,
            start_timestamp_precise=1609455600.0,
            end_timestamp_precise=1609455605.0,
            span_id="aaaaaaaaaaaaaaaa",
        ),
        build_mock_span(
            project_id=1,
            start_timestamp_precise=1609455601.0,
            end_timestamp_precise=1609455602.0,
            span_id="bbbbbbbbbbbbbbbb",
            parent_span_id="aaaaaaaaaaaaaaaa",
        ),
        build_mock_span(
            project_id=1,
            start_timestamp_precise=1609455600.8,
            end_timestamp_precise=1609455601.4,
            span_id="cccccccccccccccc",
            parent_span_id="bbbbbbbbbbbbbbbb",
        ),
        build_mock_span(
            project_id=1,
            start_timestamp_precise=1609455601.6,
            end_timestamp_precise=1609455602.2,
            span_id="dddddddddddddddd",
            parent_span_id="bbbbbbbbbbbbbbbb",
        ),
    ]

    _, enriched = Enricher.enrich_spans(spans)

    exclusive_times = {span["span_id"]: span["exclusive_time"] for span in enriched}
    assert exclusive_times == {
        "aaaaaaaaaaaaaaaa": 4000.0,
        "bbbbbbbbbbbbbbbb": 200.0,
        "cccccccccccccccc": 600.0,
        "dddddddddddddddd": 600.0,
    }


def test_child_spans_consumes_all_of_parent():
    spans = [
        build_mock_span(
            project_id=1,
            is_segment=True,
            start_timestamp_precise=1609455600.0,
            end_timestamp_precise=1609455605.0,
            span_id="aaaaaaaaaaaaaaaa",
        ),
        build_mock_span(
            project_id=1,
            start_timestamp_precise=1609455601.0,
            end_timestamp_precise=1609455602.0,
            span_id="bbbbbbbbbbbbbbbb",
            parent_span_id="aaaaaaaaaaaaaaaa",
        ),
        build_mock_span(
            project_id=1,
            start_timestamp_precise=1609455600.8,
            end_timestamp_precise=1609455601.6,
            span_id="cccccccccccccccc",
            parent_span_id="bbbbbbbbbbbbbbbb",
        ),
        build_mock_span(
            project_id=1,
            start_timestamp_precise=1609455601.4,
            end_timestamp_precise=1609455602.2,
            span_id="dddddddddddddddd",
            parent_span_id="bbbbbbbbbbbbbbbb",
        ),
    ]

    _, enriched = Enricher.enrich_spans(spans)

    exclusive_times = {span["span_id"]: span["exclusive_time"] for span in enriched}
    assert exclusive_times == {
        "aaaaaaaaaaaaaaaa": 4000.0,
        "bbbbbbbbbbbbbbbb": 0.0,
        "cccccccccccccccc": 800.0,
        "dddddddddddddddd": 800.0,
    }


def test_only_immediate_child_spans_affect_calculation():
    spans = [
        build_mock_span(
            project_id=1,
            is_segment=True,
            start_timestamp_precise=1609455600.0,
            end_timestamp_precise=1609455605.0,
            span_id="aaaaaaaaaaaaaaaa",
        ),
        build_mock_span(
            project_id=1,
            start_timestamp_precise=1609455601.0,
            end_timestamp_precise=1609455602.0,
            span_id="bbbbbbbbbbbbbbbb",
            parent_span_id="aaaaaaaaaaaaaaaa",
        ),
        build_mock_span(
            project_id=1,
            start_timestamp_precise=1609455601.6,
            end_timestamp_precise=1609455602.2,
            span_id="cccccccccccccccc",
            parent_span_id="bbbbbbbbbbbbbbbb",
        ),
        build_mock_span(
            project_id=1,
            start_timestamp_precise=1609455601.4,
            end_timestamp_precise=1609455601.8,
            span_id="dddddddddddddddd",
            parent_span_id="cccccccccccccccc",
        ),
    ]

    _, enriched = Enricher.enrich_spans(spans)

    exclusive_times = {span["span_id"]: span["exclusive_time"] for span in enriched}
    assert exclusive_times == {
        "aaaaaaaaaaaaaaaa": 4000.0,
        "bbbbbbbbbbbbbbbb": 600.0,
        "cccccccccccccccc": 400.0,
        "dddddddddddddddd": 400.0,
    }


def test_emit_ops_breakdown():
    segment_span = build_mock_span(
        project_id=1,
        is_segment=True,
        start_timestamp_precise=1577836800.0,
        end_timestamp_precise=1577858400.01,
        span_id="ffffffffffffffff",
    )

    spans = [
        build_mock_span(
            project_id=1,
            start_timestamp_precise=1577836800.0,  # 2020-01-01 00:00:00
            end_timestamp_precise=1577840400.0,  # 2020-01-01 01:00:00
            span_id="fa90fdead5f74052",
            parent_span_id=segment_span["span_id"],
            span_op="http",
        ),
        build_mock_span(
            project_id=1,
            start_timestamp_precise=1577844000.0,  # 2020-01-01 02:00:00
            end_timestamp_precise=1577847600.0,  # 2020-01-01 03:00:00
            span_id="bbbbbbbbbbbbbbbb",
            parent_span_id=segment_span["span_id"],
            span_op="db",
        ),
        build_mock_span(
            project_id=1,
            start_timestamp_precise=1577845800.0,  # 2020-01-01 02:30:00
            end_timestamp_precise=1577849400.0,  # 2020-01-01 03:30:00
            span_id="cccccccccccccccc",
            parent_span_id=segment_span["span_id"],
            span_op="db.postgres",
        ),
        build_mock_span(
            project_id=1,
            start_timestamp_precise=1577851200.0,  # 2020-01-01 04:00:00
            end_timestamp_precise=1577853000.0,  # 2020-01-01 04:30:00
            span_id="dddddddddddddddd",
            parent_span_id=segment_span["span_id"],
            span_op="db.mongo",
        ),
        build_mock_span(
            project_id=1,
            start_timestamp_precise=1577854800.0,  # 2020-01-01 05:00:00
            end_timestamp_precise=1577858400.01,  # 2020-01-01 06:00:00.01
            span_id="eeeeeeeeeeeeeeee",
            parent_span_id=segment_span["span_id"],
            span_op="browser",
        ),
        segment_span,
    ]

    breakdowns_config = {
        "span_ops": {"type": "spanOperations", "matches": ["http", "db"]},
        "span_ops_2": {"type": "spanOperations", "matches": ["http", "db"]},
    }

    # Compute breakdowns for the segment span
    enriched_segment, _ = Enricher.enrich_spans(spans)
    assert enriched_segment is not None
    updates = segment_span_measurement_updates(enriched_segment, spans, breakdowns_config)

    assert updates["span_ops.ops.http"]["value"] == 3600000.0
    assert updates["span_ops.ops.db"]["value"] == 7200000.0
    assert updates["span_ops_2.ops.http"]["value"] == 3600000.0
    assert updates["span_ops_2.ops.db"]["value"] == 7200000.0

    # NOTE: Relay used to extract a total.time breakdown, which is no longer
    # included in span breakdowns.
    # assert updates["span_ops.total.time"]["value"] == 14400000.01
    # assert updates["span_ops_2.total.time"]["value"] == 14400000.01
