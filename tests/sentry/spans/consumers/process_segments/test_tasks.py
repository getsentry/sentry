from unittest import mock

from arroyo.types import Topic as ArroyoTopic
from sentry_protos.snuba.v1.trace_item_pb2 import TraceItem

from sentry.spans.consumers.process_segments.convert import convert_span_to_item
from sentry.spans.consumers.process_segments.tasks import (
    _check_span_duplicates,
    process_segment_task,
)
from sentry.testutils.helpers.options import override_options
from sentry.utils import json
from tests.sentry.spans.consumers.process import build_mock_span


@override_options({"spans.process-segments.dedupe-ttl": 0})
@mock.patch(
    "sentry.spans.consumers.process_segments.tasks.process_segment",
    side_effect=lambda x, **kwargs: x,
)
def test_process_segment_task_produces_trace_item(mock_process_segment: mock.MagicMock) -> None:
    span_data = build_mock_span(project_id=1, is_segment=True)
    segment_bytes = json.dumps({"spans": [span_data]}).encode("utf-8")

    with mock.patch(
        "sentry.spans.consumers.process_segments.tasks._snuba_items_producer"
    ) as mock_producer:
        process_segment_task(segment_bytes)

    assert mock_process_segment.call_args.args[0] == [span_data]

    mock_producer.produce.assert_called_once()
    assert mock_producer.produce.call_args.args[0] == ArroyoTopic("snuba-items")

    payload = mock_producer.produce.call_args.args[1]
    assert TraceItem.FromString(payload.value) == convert_span_to_item(span_data)

    headers = {k: v for k, v in payload.headers}
    assert headers["item_type"] == b"1"
    assert headers["project_id"] == b"1"


@override_options(
    {
        "spans.process-segments.dedupe-ttl": 300,
        "spans.process-segments.dedupe-filter-enable": True,
    }
)
@mock.patch(
    "sentry.spans.consumers.process_segments.tasks.process_segment",
    side_effect=lambda x, **kwargs: x,
)
def test_process_segment_task_filters_duplicate_spans(
    mock_process_segment: mock.MagicMock,
) -> None:
    """The task must run spans through dedupe before producing them."""
    span1 = build_mock_span(project_id=1, is_segment=True, span_id="a" * 16)
    span2 = build_mock_span(project_id=1, is_segment=False, span_id="b" * 16)
    segment_bytes = json.dumps({"spans": [span1, span2]}).encode("utf-8")

    with (
        mock.patch("sentry.spans.consumers.process_segments.tasks.redis") as mock_redis,
        mock.patch(
            "sentry.spans.consumers.process_segments.tasks._snuba_items_producer"
        ) as mock_producer,
    ):
        mock_client = mock.MagicMock()
        mock_pipeline = mock.MagicMock()
        mock_redis.redis_clusters.get_binary.return_value = mock_client
        mock_client.pipeline.return_value.__enter__.return_value = mock_pipeline
        # First span is a duplicate, second is new.
        mock_pipeline.execute.return_value = [False, True]

        process_segment_task(segment_bytes)

    # Only the non-duplicate span should be produced.
    assert mock_producer.produce.call_count == 1
    payload = mock_producer.produce.call_args.args[1]
    assert TraceItem.FromString(payload.value) == convert_span_to_item(span2)


@override_options({"spans.process-segments.dedupe-ttl": 0})
@mock.patch(
    "sentry.spans.consumers.process_segments.tasks.process_segment",
    side_effect=lambda x, **kwargs: x,
)
def test_process_segment_task_honors_skip_enrichment(mock_process_segment: mock.MagicMock) -> None:
    span_data = build_mock_span(project_id=1, is_segment=True)
    segment_bytes = json.dumps({"spans": [span_data], "skip_enrichment": True}).encode("utf-8")

    with mock.patch("sentry.spans.consumers.process_segments.tasks._snuba_items_producer"):
        process_segment_task(segment_bytes)

    assert mock_process_segment.call_args.kwargs["skip_enrichment"] is True


class TestCheckSpanDuplicates:
    @override_options({"spans.process-segments.dedupe-ttl": 0})
    def test_disabled_when_ttl_is_zero(self) -> None:
        spans = [build_mock_span(project_id=1, is_segment=True)]
        with mock.patch("sentry.spans.consumers.process_segments.tasks.redis") as mock_redis:
            result = _check_span_duplicates(spans)
            assert result == spans
            mock_redis.redis_clusters.get_binary.assert_not_called()

    @override_options(
        {
            "spans.process-segments.dedupe-ttl": 300,
            "spans.process-segments.dedupe-filter-enable": False,
        }
    )
    def test_emits_metric_on_duplicate(self) -> None:
        spans = [
            build_mock_span(project_id=1, is_segment=True, span_id="span1"),
            build_mock_span(project_id=1, is_segment=False, span_id="span2"),
        ]
        with (
            mock.patch("sentry.spans.consumers.process_segments.tasks.redis") as mock_redis,
            mock.patch("sentry.spans.consumers.process_segments.tasks.metrics") as mock_metrics,
        ):
            mock_client = mock.MagicMock()
            mock_pipeline = mock.MagicMock()
            mock_redis.redis_clusters.get_binary.return_value = mock_client
            mock_client.pipeline.return_value.__enter__.return_value = mock_pipeline
            # First span is duplicate (setnx returns False), second is new (returns True)
            mock_pipeline.execute.return_value = [False, True]

            result = _check_span_duplicates(spans)

            # All spans returned when not filtering
            assert result == spans
            mock_metrics.incr.assert_called_once_with(
                "spans.process-segments.duplicate_span", amount=1
            )

    @override_options(
        {
            "spans.process-segments.dedupe-ttl": 300,
            "spans.process-segments.dedupe-filter-enable": True,
        }
    )
    def test_filters_duplicates_when_enabled(self) -> None:
        spans = [
            build_mock_span(project_id=1, is_segment=True, span_id="span1"),
            build_mock_span(project_id=1, is_segment=False, span_id="span2"),
        ]
        with (
            mock.patch("sentry.spans.consumers.process_segments.tasks.redis") as mock_redis,
            mock.patch("sentry.spans.consumers.process_segments.tasks.metrics") as mock_metrics,
        ):
            mock_client = mock.MagicMock()
            mock_pipeline = mock.MagicMock()
            mock_redis.redis_clusters.get_binary.return_value = mock_client
            mock_client.pipeline.return_value.__enter__.return_value = mock_pipeline
            # First span is duplicate (setnx returns False), second is new (returns True)
            mock_pipeline.execute.return_value = [False, True]

            result = _check_span_duplicates(spans)

            # Only new span returned when filtering
            assert len(result) == 1
            assert result[0]["span_id"] == "span2"
            mock_metrics.incr.assert_called_once_with(
                "spans.process-segments.duplicate_span", amount=1
            )

    @override_options(
        {
            "spans.process-segments.dedupe-ttl": 300,
            "spans.process-segments.dedupe-filter-enable": True,
        }
    )
    def test_returns_all_spans_on_redis_error(self) -> None:
        spans = [build_mock_span(project_id=1, is_segment=True, span_id="span1")]
        with mock.patch("sentry.spans.consumers.process_segments.tasks.redis") as mock_redis:
            mock_redis.redis_clusters.get_binary.side_effect = Exception("redis is down")

            result = _check_span_duplicates(spans)

            assert result == spans
