from sentry.spans.buffer.redis import ProcessSegmentsContext, RedisSpansBuffer, SegmentKey
from sentry.testutils.pytest.fixtures import django_db_all


class TestRedisSpansBuffer:
    def test_first_span_in_segment_calls_expire(self):
        buffer = RedisSpansBuffer()
        buffer.write_span_and_check_processing("segment_1", "foo", 1710280889, 0, b"span data")
        buffer.write_span_and_check_processing("segment_2", "foo", 1710280889, 0, b"span data")
        assert buffer.client.ttl("segment:foo:segment_1:process-segment") == 300
        assert buffer.client.lrange(
            "performance-issues:unprocessed-segments:partition-2:0", 0, -1
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
            "performance-issues:unprocessed-segments:partition-2:0", 0, -1
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

    def test_batch_write(self):
        buffer = RedisSpansBuffer()
        spans_map = {
            SegmentKey("segment_1", 1, 1): [b"span data", b"span data 2", b"span data 3"],
            SegmentKey("segment_2", 1, 1): [b"span data"],
        }
        timestamp_map = {
            SegmentKey("segment_1", 1, 1): 1710280889,
            SegmentKey("segment_2", 1, 1): 1710280889,
        }
        last_seen_map = {
            1: 1710280889,
        }
        result = buffer.batch_write_and_check_processing(
            spans_map=spans_map,
            segment_first_seen_ts=timestamp_map,
            latest_ts_by_partition=last_seen_map,
        )
        assert result == [
            ProcessSegmentsContext(timestamp=1710280889, partition=1, should_process_segments=True)
        ]
        assert buffer.client.ttl("segment:segment_1:1:process-segment") == 300
        assert buffer.client.lrange(
            "performance-issues:unprocessed-segments:partition-2:1", 0, -1
        ) == [
            b"1710280889",
            b"segment:segment_1:1:process-segment",
            b"1710280889",
            b"segment:segment_2:1:process-segment",
        ]

        assert buffer.read_and_expire_many_segments(
            ["segment:segment_1:1:process-segment", "segment:segment_2:1:process-segment"]
        ) == [[b"span data", b"span data 2", b"span data 3"], [b"span data"]]

    def test_multiple_batch_write(self):
        buffer = RedisSpansBuffer()
        spans_map = {
            SegmentKey("segment_1", 1, 1): [b"span data", b"span data 2", b"span data 3"],
            SegmentKey("segment_2", 1, 2): [b"span data"],
        }
        timestamp_map = {
            SegmentKey("segment_1", 1, 1): 1710280889,
            SegmentKey("segment_2", 1, 2): 1710280889,
        }
        last_seen_map = {
            1: 1710280889,
            2: 1710280889,
        }
        buffer.batch_write_and_check_processing(
            spans_map=spans_map,
            segment_first_seen_ts=timestamp_map,
            latest_ts_by_partition=last_seen_map,
        )

        spans_map_2 = {
            SegmentKey("segment_1", 1, 1): [b"span data 4", b"span data 5"],
            SegmentKey("segment_2", 1, 2): [b"span data 2"],
            SegmentKey("segment_3", 1, 1): [b"span data"],
        }
        timestamp_map_2 = {
            SegmentKey("segment_1", 1, 1): 1710280890,
            SegmentKey("segment_2", 1, 2): 1710280889,
            SegmentKey("segment_3", 1, 1): 1710280891,
        }
        last_seen_map_2 = {
            1: 1710280891,
            2: 1710280889,
        }

        result = buffer.batch_write_and_check_processing(
            spans_map=spans_map_2,
            segment_first_seen_ts=timestamp_map_2,
            latest_ts_by_partition=last_seen_map_2,
        )

        assert result == [
            ProcessSegmentsContext(timestamp=1710280891, partition=1, should_process_segments=True),
            ProcessSegmentsContext(
                timestamp=1710280889, partition=2, should_process_segments=False
            ),
        ]

        assert buffer.client.ttl("segment:segment_1:1:process-segment") == 300
        assert buffer.client.lrange(
            "performance-issues:unprocessed-segments:partition-2:1", 0, -1
        ) == [
            b"1710280889",
            b"segment:segment_1:1:process-segment",
            b"1710280891",
            b"segment:segment_3:1:process-segment",
        ]
        assert buffer.read_and_expire_many_segments(["segment:segment_1:1:process-segment"]) == [
            [b"span data", b"span data 2", b"span data 3", b"span data 4", b"span data 5"]
        ]

    @django_db_all
    def test_get_unprocessed_segments_and_prune_bucket(self):
        buffer = RedisSpansBuffer()
        spans_map = {
            SegmentKey("segment_1", 1, 1): [b"span data"],
            SegmentKey("segment_2", 1, 1): [b"span data"],
            SegmentKey("segment_3", 1, 1): [b"span data"],
            SegmentKey("segment_4", 1, 2): [b"span data"],
        }
        timestamp_map = {
            SegmentKey("segment_1", 1, 1): 1710280890,
            SegmentKey("segment_2", 1, 1): 1710280891,
            SegmentKey("segment_3", 1, 1): 1710280892,
            SegmentKey("segment_4", 1, 2): 1710280893,
        }
        last_seen_map = {
            1: 1710280893,
        }
        buffer.batch_write_and_check_processing(
            spans_map=spans_map,
            segment_first_seen_ts=timestamp_map,
            latest_ts_by_partition=last_seen_map,
        )

        assert buffer.client.lrange(
            "performance-issues:unprocessed-segments:partition-2:1", 0, -1
        ) == [
            b"1710280890",
            b"segment:segment_1:1:process-segment",
            b"1710280891",
            b"segment:segment_2:1:process-segment",
            b"1710280892",
            b"segment:segment_3:1:process-segment",
        ]

        segment_keys = buffer.get_unprocessed_segments_and_prune_bucket(1710281011, 1)
        assert segment_keys == [
            "segment:segment_1:1:process-segment",
            "segment:segment_2:1:process-segment",
        ]

        assert buffer.client.lrange(
            "performance-issues:unprocessed-segments:partition-2:1", 0, -1
        ) == [
            b"1710280892",
            b"segment:segment_3:1:process-segment",
        ]
