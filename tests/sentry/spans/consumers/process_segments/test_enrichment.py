from sentry.spans.consumers.process_segments.enrichment import set_exclusive_time
from sentry.testutils.cases import TestCase
from tests.sentry.spans.consumers.process import build_mock_span


# Tests ported from Relay
class TestExclusiveTime(TestCase):
    def test_childless_spans(self):
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

        set_exclusive_time(spans)

        exclusive_times = {span["span_id"]: span["exclusive_time"] for span in spans}
        assert exclusive_times == {
            "aaaaaaaaaaaaaaaa": 1123.0,
            "bbbbbbbbbbbbbbbb": 3000.0,
            "cccccccccccccccc": 2500.0,
            "dddddddddddddddd": 1877.0,
        }

    def test_nested_spans(self):
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

        set_exclusive_time(spans)

        exclusive_times = {span["span_id"]: span["exclusive_time"] for span in spans}
        assert exclusive_times == {
            "aaaaaaaaaaaaaaaa": 4000.0,
            "bbbbbbbbbbbbbbbb": 400.0,
            "cccccccccccccccc": 400.0,
            "dddddddddddddddd": 200.0,
        }

    def test_overlapping_child_spans(self):
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

        set_exclusive_time(spans)

        exclusive_times = {span["span_id"]: span["exclusive_time"] for span in spans}
        assert exclusive_times == {
            "aaaaaaaaaaaaaaaa": 4000.0,
            "bbbbbbbbbbbbbbbb": 400.0,
            "cccccccccccccccc": 400.0,
            "dddddddddddddddd": 400.0,
        }

    def test_child_spans_dont_intersect_parent(self):
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

        set_exclusive_time(spans)

        exclusive_times = {span["span_id"]: span["exclusive_time"] for span in spans}
        assert exclusive_times == {
            "aaaaaaaaaaaaaaaa": 4000.0,
            "bbbbbbbbbbbbbbbb": 1000.0,
            "cccccccccccccccc": 400.0,
            "dddddddddddddddd": 400.0,
        }

    def test_child_spans_extend_beyond_parent(self):
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

        set_exclusive_time(spans)

        exclusive_times = {span["span_id"]: span["exclusive_time"] for span in spans}
        assert exclusive_times == {
            "aaaaaaaaaaaaaaaa": 4000.0,
            "bbbbbbbbbbbbbbbb": 200.0,
            "cccccccccccccccc": 600.0,
            "dddddddddddddddd": 600.0,
        }

    def test_child_spans_consumes_all_of_parent(self):
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

        set_exclusive_time(spans)

        exclusive_times = {span["span_id"]: span["exclusive_time"] for span in spans}
        assert exclusive_times == {
            "aaaaaaaaaaaaaaaa": 4000.0,
            "bbbbbbbbbbbbbbbb": 0.0,
            "cccccccccccccccc": 800.0,
            "dddddddddddddddd": 800.0,
        }

    def test_only_immediate_child_spans_affect_calculation(self):
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

        set_exclusive_time(spans)

        exclusive_times = {span["span_id"]: span["exclusive_time"] for span in spans}
        assert exclusive_times == {
            "aaaaaaaaaaaaaaaa": 4000.0,
            "bbbbbbbbbbbbbbbb": 600.0,
            "cccccccccccccccc": 400.0,
            "dddddddddddddddd": 400.0,
        }
