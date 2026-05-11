from datetime import timedelta
from unittest.mock import patch

from sentry.tasks.seer.night_shift.skip_cache import (
    SKIP_TTL_SECONDS,
    key,
    mark_skipped,
    recently_skipped,
)
from sentry.utils.redis import redis_clusters


def _delete(group_id: int) -> None:
    redis_clusters.get("default").delete(key(group_id))


def test_mark_then_recently_skipped_returns_id() -> None:
    try:
        mark_skipped(101)
        assert recently_skipped([101]) == {101}
    finally:
        _delete(101)


def test_recently_skipped_returns_only_marked_ids() -> None:
    try:
        mark_skipped(202)
        assert recently_skipped([202, 203, 204]) == {202}
    finally:
        _delete(202)


def test_recently_skipped_empty_input() -> None:
    assert recently_skipped([]) == set()


def test_ttl_padded_past_three_days() -> None:
    try:
        mark_skipped(305)
        ttl = redis_clusters.get("default").ttl(key(305))
        assert int(timedelta(days=3).total_seconds()) < ttl <= SKIP_TTL_SECONDS
    finally:
        _delete(305)


def test_deleted_key_no_longer_recently_skipped() -> None:
    mark_skipped(406)
    _delete(406)
    assert recently_skipped([406]) == set()


def test_mark_skipped_swallows_redis_errors() -> None:
    with patch(
        "sentry.tasks.seer.night_shift.skip_cache._client",
        side_effect=ConnectionError("redis down"),
    ):
        mark_skipped(501)


def test_recently_skipped_returns_empty_on_redis_errors() -> None:
    with patch(
        "sentry.tasks.seer.night_shift.skip_cache._client",
        side_effect=ConnectionError("redis down"),
    ):
        assert recently_skipped([601, 602]) == set()
