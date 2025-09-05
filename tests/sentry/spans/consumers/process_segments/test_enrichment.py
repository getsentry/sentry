from sentry.spans.consumers.process_segments.enrichment import TreeEnricher, compute_breakdowns
from sentry.spans.consumers.process_segments.shim import make_compatible
from tests.sentry.spans.consumers.process import build_mock_span

# Tests ported from Relay


def test_childless_spans() -> None:
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

    _, enriched = TreeEnricher.enrich_spans(spans)
    enriched = [make_compatible(span) for span in enriched]

    exclusive_times = {span["span_id"]: span["exclusive_time_ms"] for span in enriched}
    assert exclusive_times == {
        "aaaaaaaaaaaaaaaa": 1123.0,
        "bbbbbbbbbbbbbbbb": 3000.0,
        "cccccccccccccccc": 2500.0,
        "dddddddddddddddd": 1877.0,
    }


def test_nested_spans() -> None:
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

    _, enriched = TreeEnricher.enrich_spans(spans)

    exclusive_times = {span["span_id"]: span["exclusive_time_ms"] for span in enriched}
    assert exclusive_times == {
        "aaaaaaaaaaaaaaaa": 4000.0,
        "bbbbbbbbbbbbbbbb": 400.0,
        "cccccccccccccccc": 400.0,
        "dddddddddddddddd": 200.0,
    }


def test_overlapping_child_spans() -> None:
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

    _, enriched = TreeEnricher.enrich_spans(spans)

    exclusive_times = {span["span_id"]: span["exclusive_time_ms"] for span in enriched}
    assert exclusive_times == {
        "aaaaaaaaaaaaaaaa": 4000.0,
        "bbbbbbbbbbbbbbbb": 400.0,
        "cccccccccccccccc": 400.0,
        "dddddddddddddddd": 400.0,
    }


def test_child_spans_dont_intersect_parent() -> None:
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

    _, enriched = TreeEnricher.enrich_spans(spans)

    exclusive_times = {span["span_id"]: span["exclusive_time_ms"] for span in enriched}
    assert exclusive_times == {
        "aaaaaaaaaaaaaaaa": 4000.0,
        "bbbbbbbbbbbbbbbb": 1000.0,
        "cccccccccccccccc": 400.0,
        "dddddddddddddddd": 400.0,
    }


def test_child_spans_extend_beyond_parent() -> None:
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

    _, enriched = TreeEnricher.enrich_spans(spans)

    exclusive_times = {span["span_id"]: span["exclusive_time_ms"] for span in enriched}
    assert exclusive_times == {
        "aaaaaaaaaaaaaaaa": 4000.0,
        "bbbbbbbbbbbbbbbb": 200.0,
        "cccccccccccccccc": 600.0,
        "dddddddddddddddd": 600.0,
    }


def test_child_spans_consumes_all_of_parent() -> None:
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

    _, enriched = TreeEnricher.enrich_spans(spans)

    exclusive_times = {span["span_id"]: span["exclusive_time_ms"] for span in enriched}
    assert exclusive_times == {
        "aaaaaaaaaaaaaaaa": 4000.0,
        "bbbbbbbbbbbbbbbb": 0.0,
        "cccccccccccccccc": 800.0,
        "dddddddddddddddd": 800.0,
    }


def test_only_immediate_child_spans_affect_calculation() -> None:
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

    _, enriched = TreeEnricher.enrich_spans(spans)

    exclusive_times = {span["span_id"]: span["exclusive_time_ms"] for span in enriched}
    assert exclusive_times == {
        "aaaaaaaaaaaaaaaa": 4000.0,
        "bbbbbbbbbbbbbbbb": 600.0,
        "cccccccccccccccc": 400.0,
        "dddddddddddddddd": 400.0,
    }


def test_emit_ops_breakdown() -> None:
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
    _ = TreeEnricher.enrich_spans(spans)
    updates = compute_breakdowns(spans, breakdowns_config)

    assert updates["span_ops.ops.http"] == 3600000.0
    assert updates["span_ops.ops.db"] == 7200000.0
    assert updates["span_ops_2.ops.http"] == 3600000.0
    assert updates["span_ops_2.ops.db"] == 7200000.0

    # NOTE: Relay used to extract a total.time breakdown, which is no longer
    # included in span breakdowns.
    # assert updates["span_ops.total.time"]["value"] == 14400000.01
    # assert updates["span_ops_2.total.time"]["value"] == 14400000.01


def test_write_tags_for_performance_issue_detection():
    segment_span = _mock_performance_issue_span(
        is_segment=True,
        span_id="ffffffffffffffff",
        data={
            "sentry.sdk.name": "sentry.php.laravel",
            "sentry.environment": "production",
            "sentry.release": "1.0.0",
            "sentry.platform": "php",
        },
    )

    spans = [
        _mock_performance_issue_span(
            is_segment=False,
            data={
                "sentry.system": "mongodb",
                "sentry.normalized_description": '{"filter":{"productid":{"buffer":"?"}},"find":"reviews"}',
            },
        ),
        segment_span,
    ]

    _, spans = TreeEnricher.enrich_spans(spans)
    spans = [make_compatible(span) for span in spans]

    child_span, segment_span = spans

    assert segment_span["sentry_tags"] == {
        "sdk.name": "sentry.php.laravel",
        "environment": "production",
        "release": "1.0.0",
        "platform": "php",
    }

    assert child_span["sentry_tags"] == {
        "system": "mongodb",
        "description": '{"filter":{"productid":{"buffer":"?"}},"find":"reviews"}',
        "sdk.name": "sentry.php.laravel",
        "environment": "production",
        "release": "1.0.0",
        "platform": "php",
    }


def _mock_performance_issue_span(is_segment, data, **fields):
    return {
        "description": "OrganizationNPlusOne",
        "duration_ms": 107,
        "is_segment": is_segment,
        "is_remote": is_segment,
        "parent_span_id": None,
        "profile_id": "dbae2b82559649a1a34a2878134a007b",
        "project_id": 1,
        "organization_id": 1,
        "received": 1707953019.044972,
        "retention_days": 90,
        "segment_id": "a49b42af9fb69da0",
        "data": data,
        "span_id": "a49b42af9fb69da0",
        "start_timestamp_ms": 1707953018865,
        "start_timestamp_precise": 1707953018.865,
        "end_timestamp_precise": 1707953018.972,
        "trace_id": "94576097f3a64b68b85a59c7d4e3ee2a",
        **fields,
    }
