from unittest import mock

from sentry.spans.buffer.redis import RedisSpansBuffer, get_redis_client


class TestRedisSpansBuffer:
    def test_first_span_in_segment_calls_expire(self):
        buffer = RedisSpansBuffer()
        with mock.patch.object(buffer, "client", new=get_redis_client()) as mock_client:
            mock_client.expire = mock.Mock()

            buffer.write_span("bar", "foo", b"span data")
            mock_client.expire.assert_called_once_with("segment:foo:bar:process-segment", 300)

    def test_ttl_not_set_repeatedly(self):
        buffer = RedisSpansBuffer()
        buffer.write_span("bar", "foo", b"span data")
        with mock.patch.object(buffer, "client", new=get_redis_client()) as mock_client:
            mock_client.expire = mock.Mock()
            buffer.write_span("bar", "foo", b"other span data")

            mock_client.expire.assert_not_called
