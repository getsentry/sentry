from sentry.tasks.seer.night_shift.skip_cache import (
    SKIP_TTL_SECONDS,
    filter_recently_skipped,
    key,
    mark_skipped,
)
from sentry.utils.redis import redis_clusters


def _delete(group_id: int) -> None:
    redis_clusters.get("default").delete(key(group_id))


def test_mark_then_filter_returns_id() -> None:
    try:
        mark_skipped(101)
        assert filter_recently_skipped([101]) == {101}
    finally:
        _delete(101)


def test_filter_returns_only_marked_ids() -> None:
    try:
        mark_skipped(202)
        assert filter_recently_skipped([202, 203, 204]) == {202}
    finally:
        _delete(202)


def test_filter_empty_input() -> None:
    assert filter_recently_skipped([]) == set()


def test_ttl_padded_past_three_days() -> None:
    try:
        mark_skipped(305)
        ttl = redis_clusters.get("default").ttl(key(305))
        assert 3 * 86400 < ttl <= SKIP_TTL_SECONDS
    finally:
        _delete(305)


def test_deleted_key_no_longer_filtered() -> None:
    mark_skipped(406)
    _delete(406)
    assert filter_recently_skipped([406]) == set()
