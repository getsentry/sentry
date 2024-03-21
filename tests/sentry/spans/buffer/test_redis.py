from sentry.spans.buffer.redis import RedisSpansBuffer


class TestRedisSpansBuffer:
    def test_first_span_in_segment_calls_expire(self):
        buffer = RedisSpansBuffer()
        buffer.write_span_and_check_processing("segment_1", "foo", 1710280889, 0, b"span data")
        buffer.write_span_and_check_processing("segment_2", "foo", 1710280889, 0, b"span data")
        assert buffer.client.ttl("segment:foo:segment_1:process-segment") == 300
        assert buffer.client.lrange(
            "performance-issues:unprocessed-segments:partition:0", 0, -1
        ) == [
            b'[1710280889,"segment:foo:segment_1:process-segment"]',
            b'[1710280889,"segment:foo:segment_2:process-segment"]',
        ]

        assert buffer.read_and_expire_many_segments(
            ["segment:foo:segment_1:process-segment", "segment:foo:segment_2:process-segment"]
        ) == [[b"span data"], [b"span data"]]

    def test_segment_not_pushed_repeatedly_to_process_bucket(self):
        buffer = RedisSpansBuffer()
        buffer.write_span_and_check_processing("bar", "foo", 1710280889, 0, b"span data")
        buffer.write_span_and_check_processing("bar", "foo", 1710280890, 0, b"other span data")
        assert buffer.client.lrange(
            "performance-issues:unprocessed-segments:partition:0", 0, -1
        ) == [b'[1710280889,"segment:foo:bar:process-segment"]']

    def test_processing_intervals(self):
        buffer = RedisSpansBuffer()
        should_process = buffer.write_span_and_check_processing(
            "bar", "foo", 1710280889, 0, b"span data"
        )
        assert should_process is False

        should_process = buffer.write_span_and_check_processing(
            "bar", "foo", 1710280889, 0, b"span data 2"
        )
        assert should_process is False

        should_process = buffer.write_span_and_check_processing(
            "bar", "foo", 1710280890, 0, b"other span data"
        )
        assert should_process is True
