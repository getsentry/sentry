from sentry.spans.buffer.redis import RedisSpansBuffer
from sentry.testutils.helpers.datetime import freeze_time


class TestRedisSpansBuffer:
    def test_first_span_in_segment_sets_ttl_and_pushes_to_bucket(self):
        buffer = RedisSpansBuffer()
        with freeze_time("2000-01-01"):
            buffer.write_span("bar", "foo", b"span data")
            assert buffer.read_many_segments(["segment:foo:bar:process-segment"]) == [
                ("segment:foo:bar:process-segment", ["span data"])
            ]
            assert buffer.client.ttl("segment:foo:bar:process-segment") == 300
            assert buffer._read_key("performance-issues:unprocessed-segments") == [
                '[946684800.0,"segment:foo:bar:process-segment"]'
            ]

    def test_segment_not_pushed_repeatedly_to_process_bucket(self):
        buffer = RedisSpansBuffer()
        with freeze_time("2000-01-01"):
            buffer.write_span("bar", "foo", b"span data")
            buffer.write_span("bar", "foo", b"other span data")
            assert buffer._read_key("performance-issues:unprocessed-segments") == [
                '[946684800.0,"segment:foo:bar:process-segment"]'
            ]

    def test_get_segment_keys_and_prune(self):
        buffer = RedisSpansBuffer()
        with freeze_time("2000-01-01") as frozen_time:
            buffer.write_span("bar", "span1", b"span data")
            frozen_time.shift(10)
            buffer.write_span("bar", "span2", b"other span data")
            frozen_time.shift(120)
            buffer.write_span("bar", "span3", b"other span data")

            assert buffer._read_key("performance-issues:unprocessed-segments") == [
                '[946684800.0,"segment:span1:bar:process-segment"]',
                '[946684810.0,"segment:span2:bar:process-segment"]',
                '[946684930.0,"segment:span3:bar:process-segment"]',
            ]

            result = buffer.get_segment_keys_and_prune()

            assert result == [
                (946684800.0, "segment:span1:bar:process-segment"),
                (946684810.0, "segment:span2:bar:process-segment"),
            ]

            assert buffer._read_key("performance-issues:unprocessed-segments") == [
                '[946684930.0,"segment:span3:bar:process-segment"]',
            ]
