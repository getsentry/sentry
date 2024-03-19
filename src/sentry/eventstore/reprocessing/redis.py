import uuid
from collections.abc import Sequence
from datetime import datetime
from typing import Any

import redis
from django.conf import settings

from sentry.utils import json
from sentry.utils.dates import to_datetime
from sentry.utils.redis import redis_clusters

from .base import ReprocessingStore


def _get_sync_counter_key(group_id: int) -> str:
    return f"re2:count:{group_id}"


def _get_info_reprocessed_key(group_id: int) -> str:
    return f"re2:info:{group_id}"


def _get_old_primary_hash_subset_key(project_id: int, group_id: int, primary_hash: str) -> str:
    return f"re2:tombstones:{{{project_id}:{group_id}:{primary_hash}}}"


def _get_remaining_key(project_id: int, group_id: int) -> str:
    return f"re2:remaining:{{{project_id}:{group_id}}}"


class RedisReprocessingStore(ReprocessingStore):
    def __init__(self, **options: dict[str, Any]) -> None:
        cluster = options.pop("cluster", "default")
        assert isinstance(cluster, str), "cluster option must be a string"
        self.redis = redis_clusters.get(cluster)

    def event_count_for_hashes(
        self, project_id: int, group_id: int, old_primary_hashes: Sequence[str]
    ) -> int:
        # Events for a group are split and bucketed by their primary hashes. If flushing is to be
        # performed on a per-group basis, the event count needs to be summed up across all buckets
        # belonging to a single group.
        event_count = 0
        for primary_hash in old_primary_hashes:
            key = _get_old_primary_hash_subset_key(project_id, group_id, primary_hash)
            event_count += self.redis.llen(key)
        return event_count

    def pop_batched_events(
        self, project_id: int, group_id: int, primary_hash: str
    ) -> tuple[list[str], datetime | None, datetime | None]:
        """
        For redis key pointing to a list of buffered events structured like
        `event id;datetime of event`, returns a list of event IDs, the
        earliest datetime, and the latest datetime.
        """
        key = _get_old_primary_hash_subset_key(project_id, group_id, primary_hash)
        return self.pop_batched_events_by_key(key)

    def pop_batched_events_by_key(
        self, key: str
    ) -> tuple[list[str], datetime | None, datetime | None]:
        event_ids_batch = []
        min_datetime: datetime | None = None
        max_datetime: datetime | None = None

        for row in self.redis.lrange(key, 0, -1):
            datetime_raw, event_id = row.split(";")
            parsed_datetime = to_datetime(float(datetime_raw))

            assert parsed_datetime is not None

            if min_datetime is None or parsed_datetime < min_datetime:
                min_datetime = parsed_datetime
            if max_datetime is None or parsed_datetime > max_datetime:
                max_datetime = parsed_datetime

            event_ids_batch.append(event_id)

        self.redis.delete(key)

        return event_ids_batch, min_datetime, max_datetime

    def get_old_primary_hashes(self, project_id: int, group_id: int) -> set[Any]:
        # This is a meta key that contains old primary hashes. These hashes are then
        # combined with other values to construct a key that points to a list of
        # tombstonable events.
        primary_hash_set_key = f"re2:tombstone-primary-hashes:{project_id}:{group_id}"

        return self.redis.smembers(primary_hash_set_key)

    def expire_hash(
        self,
        project_id: int,
        group_id: int,
        event_id: str,
        date_val: datetime,
        old_primary_hash: str,
    ) -> None:
        event_key = _get_old_primary_hash_subset_key(project_id, group_id, old_primary_hash)
        self.redis.lpush(event_key, f"{date_val.timestamp()};{event_id}")
        self.redis.expire(event_key, settings.SENTRY_REPROCESSING_TOMBSTONES_TTL)

    def add_hash(self, project_id: int, group_id: int, hash: str) -> None:
        primary_hash_set_key = f"re2:tombstone-primary-hashes:{project_id}:{group_id}"

        self.redis.sadd(primary_hash_set_key, hash)
        self.redis.expire(primary_hash_set_key, settings.SENTRY_REPROCESSING_TOMBSTONES_TTL)

    def get_remaining_event_count(
        self, project_id: int, old_group_id: int, datetime_to_event: list[tuple[datetime, str]]
    ) -> int:
        # We explicitly cluster by only project_id and group_id here such that our
        # RENAME command later succeeds.
        key = _get_remaining_key(project_id, old_group_id)

        if datetime_to_event:
            llen = self.redis.lpush(
                key,
                *(f"{datetime.timestamp()};{event_id}" for datetime, event_id in datetime_to_event),
            )
            self.redis.expire(key, settings.SENTRY_REPROCESSING_SYNC_TTL)
        else:
            llen = self.redis.llen(key)
        return llen

    def rename_key(self, project_id: int, old_group_id: int) -> str | None:
        key = _get_remaining_key(project_id, old_group_id)
        new_key = f"{key}:{uuid.uuid4().hex}"
        try:
            # Rename `key` to a new temp key that is passed to celery task. We
            # use `renamenx` instead of `rename` only to detect UUID collisions.
            assert self.redis.renamenx(key, new_key), "UUID collision for new_key?"

            return new_key
        except redis.exceptions.ResponseError:
            # `key` does not exist in Redis. `ResponseError` is a bit too broad
            # but it seems we'd have to do string matching on error message
            # otherwise.
            return None

    def mark_event_reprocessed(self, group_id: int, num_events: int) -> bool:
        # refresh the TTL of the metadata:
        pipe = self.redis.pipeline()
        pipe.expire(
            name=_get_info_reprocessed_key(group_id), time=settings.SENTRY_REPROCESSING_SYNC_TTL
        )
        sync_counter_key = _get_sync_counter_key(group_id)
        pipe.expire(name=sync_counter_key, time=settings.SENTRY_REPROCESSING_SYNC_TTL)
        pipe.decrby(name=sync_counter_key, amount=num_events)
        new_decremented_value = pipe.execute()[2]
        return new_decremented_value == 0

    def start_reprocessing(
        self, group_id: int, date_created: Any, sync_count: int, event_count: int
    ) -> None:
        self.redis.setex(
            _get_sync_counter_key(group_id), settings.SENTRY_REPROCESSING_SYNC_TTL, sync_count
        )
        self.redis.setex(
            _get_info_reprocessed_key(group_id),
            settings.SENTRY_REPROCESSING_SYNC_TTL,
            json.dumps(
                {"dateCreated": date_created, "syncCount": sync_count, "totalEvents": event_count}
            ),
        )

    def get_pending(self, group_id: int) -> tuple[str | None, int]:
        pending_key = _get_sync_counter_key(group_id)
        pending = self.redis.get(pending_key)
        ttl = self.redis.ttl(pending_key)
        return pending, ttl

    def get_progress(self, group_id: int) -> dict[str, Any] | None:
        info = self.redis.get(_get_info_reprocessed_key(group_id))
        if info is None:
            return None
        return json.loads(info)
