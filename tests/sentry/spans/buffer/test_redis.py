from unittest import mock

from sentry.spans.buffer.redis import RedisSpansBuffer, get_redis_client
from sentry.testutils.helpers.datetime import freeze_time


class TestRedisSpansBuffer:
    def test_first_span_in_segment_calls_expire(self):
        buffer = RedisSpansBuffer()
        buffer.write_span_and_get_last_processed_timestamp(
            "bar", "foo", 1710280889, 0, b"span data"
        )
        assert buffer.read_many_segments(["segment:foo:bar:process-segment"]) == [
            ("segment:foo:bar:process-segment", ["span data"])
        ]
        assert buffer.client.ttl("segment:foo:bar:process-segment") == 300
        assert buffer._read_key("performance-issues:unprocessed-segments:partition:0") == [
            '[1710280889,"segment:foo:bar:process-segment"]'
        ]

    def test_segment_not_pushed_repeatedly_to_process_bucket(self):
        buffer = RedisSpansBuffer()
        buffer.write_span_and_get_last_processed_timestamp(
            "bar", "foo", 1710280889, 0, b"span data"
        )
        buffer.write_span_and_get_last_processed_timestamp(
            "bar", "foo", 1710280890, 0, b"other span data"
        )
        assert buffer._read_key("performance-issues:unprocessed-segments:partition:0") == [
            '[1710280889,"segment:foo:bar:process-segment"]'
        ]

    # def test_ttl_not_set_repeatedly(self):
    #     buffer = RedisSpansBuffer()
    #     buffer.write_span_and_get_last_processed_timestamp(
    #         "bar", "foo", 1710280889, 0, b"span data"
    #     )
    #     with mock.patch.object(buffer, "client", new=get_redis_client()) as mock_client:
    #         mock_client.expire = mock.Mock()
    #         buffer.write_span_and_get_last_processed_timestamp(
    #             "bar", "foo", 1710280889, 0, b"other span data"
    #         )

    #         mock_client.expire.assert_not_called
