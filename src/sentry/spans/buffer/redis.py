from __future__ import annotations

import dataclasses
from collections.abc import Mapping
from typing import NamedTuple

import sentry_sdk
from django.conf import settings
from sentry_redis_tools.clients import RedisCluster, StrictRedis

from sentry import options
from sentry.utils import redis
from sentry.utils.iterators import chunked


@dataclasses.dataclass
class ProcessSegmentsContext:
    timestamp: int
    partition: int
    should_process_segments: bool


class SegmentKey(NamedTuple):
    segment_id: str
    project_id: int
    partition: int


def get_redis_client() -> RedisCluster[bytes] | StrictRedis[bytes]:
    return redis.redis_clusters.get_binary(settings.SENTRY_SPAN_BUFFER_CLUSTER)


def get_segment_key(project_id: str | int, segment_id: str) -> str:
    return f"segment:{segment_id}:{project_id}:process-segment"


def get_last_processed_timestamp_key(partition_index: int) -> str:
    return f"performance-issues:last-processed-timestamp:partition:{partition_index}"


def get_unprocessed_segments_key(partition_index: int) -> str:
    return f"performance-issues:unprocessed-segments:partition-2:{partition_index}"


class RedisSpansBuffer:
    def __init__(self):
        self.client: RedisCluster | StrictRedis = get_redis_client()

    def batch_write_and_check_processing(
        self,
        spans_map: Mapping[SegmentKey, list[bytes]],
        segment_first_seen_ts: Mapping[SegmentKey, int],
        latest_ts_by_partition: Mapping[int, int],
    ) -> list[ProcessSegmentsContext]:
        """
        1. Pushes batches of spans to redis
        2. Check if number of spans pushed == to the number of elements that exist on the key. This
            tells us if it was the first time we see the key. This works fine because RPUSH is atomic.
        3. If it is the first time we see a particular segment, push the segment id and first seen
            timestamp to a bucket so we know when it is ready to be processed.
        3. Checks if 1 second has passed since the last time segments were processed for a partition.
        """
        keys = list(spans_map.keys())
        spans_written_per_segment = []
        ttl = options.get("standalone-spans.buffer-ttl.seconds")

        # Batch write spans in a segment
        with self.client.pipeline() as p:
            for key in keys:
                segment_id, project_id, partition = key
                spans = spans_map[key]
                segment_key = get_segment_key(project_id, segment_id)
                # RPUSH is atomic
                p.rpush(segment_key, *spans)
                spans_written_per_segment.append(len(spans))

            results = p.execute()

        partitions = list(latest_ts_by_partition.keys())
        with self.client.pipeline() as p:
            # Get last processed timestamp for each partition processed
            # by consumer
            for partition in partitions:
                timestamp = latest_ts_by_partition[partition]
                timestamp_key = get_last_processed_timestamp_key(partition)
                # GETSET is atomic
                p.getset(timestamp_key, timestamp)

            for result in zip(keys, spans_written_per_segment, results):
                # Check if this is a new segment, if yes, add to bucket to be processed
                key, num_written, num_total = result
                if num_written == num_total:
                    segment_id, project_id, partition = key
                    segment_key = get_segment_key(project_id, segment_id)
                    bucket = get_unprocessed_segments_key(partition)

                    timestamp = segment_first_seen_ts[key]
                    p.expire(segment_key, ttl)
                    p.rpush(bucket, timestamp, segment_key)

            timestamp_results = p.execute()

        # For each partition this consumer is assigned to, check if it should process segments
        process_segments_contexts: list[ProcessSegmentsContext] = []
        for value in zip(timestamp_results[: len(latest_ts_by_partition)], partitions):
            last_ts, partition = value
            should_process = last_ts is None or int(last_ts) < latest_ts_by_partition[partition]
            process_segments_contexts.append(
                ProcessSegmentsContext(
                    timestamp=latest_ts_by_partition[partition],
                    partition=partition,
                    should_process_segments=should_process,
                )
            )

        return process_segments_contexts

    def read_and_expire_many_segments(self, keys: list[str]) -> list[list[str | bytes]]:
        values = []
        with self.client.pipeline() as p:
            for key in keys:
                p.lrange(key, 0, -1)

            p.delete(*keys)
            response = p.execute()

        for value in response[:-1]:
            values.append(value)

        return values

    def get_unprocessed_segments_and_prune_bucket(self, now: int, partition: int) -> list[str]:
        key = get_unprocessed_segments_key(partition)
        results = self.client.lrange(key, 0, -1) or []

        buffer_window = options.get("standalone-spans.buffer-window.seconds")

        segment_keys = []
        processed_segment_ts = None
        for result in chunked(results, 2):
            try:
                segment_timestamp, segment_key = result
                segment_timestamp = int(segment_timestamp)
                if now - segment_timestamp < buffer_window:
                    break

                processed_segment_ts = segment_timestamp
                segment_keys.append(segment_key.decode("utf-8"))
            except Exception:
                # Just in case something funky happens here
                sentry_sdk.capture_exception()
                break

        self.client.ltrim(key, len(segment_keys) * 2, -1)

        segment_context = {"current_timestamp": now, "segment_timestamp": processed_segment_ts}
        sentry_sdk.set_context("processed_segment", segment_context)

        return segment_keys
