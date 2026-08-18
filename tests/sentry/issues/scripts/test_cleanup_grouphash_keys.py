from __future__ import annotations

import itertools
import time

from sentry.issues.scripts.cleanup_grouphash_keys import (
    DELETE_IF_STALE,
    MATCH,
    MIN_IDLE_SECONDS,
    get_client,
    sweep,
)
from sentry.testutils.cases import TestCase

TTL = 86400

# Redis keeps one shared object for the integers 0 to 9999 unless `maxmemory` is
# set and `maxmemory-policy` is an LRU policy. A shared value carries no per-key
# LRU clock, so the sweep cannot read the age of a key that holds one. The dev
# and CI Redis run with no `maxmemory`, so seed with a value above that range to
# get the private object production has, and use a small integer where the test
# wants the shared case.
PRIVATE = 10000
SHARED = 1


class CleanupGrouphashKeysTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.client = get_client()
        # Each xdist worker gets its own redis db, but an earlier test in this
        # worker may have left keys under the prefix behind. Clear them so the
        # counts below are exact.
        self._clear()
        self.addCleanup(self._clear)

    def _clear(self) -> None:
        cursor = 0
        while True:
            cursor, keys = self.client.scan(cursor=cursor, match=MATCH, count=500)
            if keys:
                self.client.delete(*keys)
            if cursor == 0:
                return

    def _seed(self, leaked: int = 0, live: int = 0, shared: int = 0, unrelated: int = 0) -> None:
        for i in range(leaked):
            self.client.set(f"grouphash:leaked{i}:{self.project.id}", PRIVATE)
        for i in range(live):
            self.client.set(f"grouphash:live{i}:{self.project.id}", PRIVATE, ex=TTL)
        for i in range(shared):
            self.client.set(f"grouphash:shared{i}:{self.project.id}", SHARED)
        for i in range(unrelated):
            self.client.set(f"unrelated:{i}", PRIVATE)
            self.addCleanup(self.client.delete, f"unrelated:{i}")

    def _keys(self, pattern: str) -> list[str]:
        return sorted(self.client.keys(pattern))

    def test_uses_the_issue_platform_cluster(self) -> None:
        # The keys this sweeps are written by should_create_group, which resolves
        # its client the same way.
        from sentry.utils.redis import redis_clusters

        assert self.client is redis_clusters.get("default")

    def test_the_age_threshold_is_the_expiry_the_key_would_have_had(self) -> None:
        # Every noise_config in the tree takes the default expiry, so a leaked
        # counter would have carried this TTL had its group type set one.
        assert MIN_IDLE_SECONDS == 86400

    def test_deletes_only_stale_keys_without_a_ttl(self) -> None:
        self._seed(leaked=25, live=10, unrelated=5)

        result = sweep(self.client, dry_run=False, min_idle_seconds=0)

        assert result.matched == 25
        assert result.skipped_live == 10
        assert result.cursor == 0
        assert self._keys("grouphash:leaked*") == []
        assert len(self._keys("grouphash:live*")) == 10
        assert len(self._keys("unrelated:*")) == 5

    def test_keeps_a_key_that_has_not_reached_the_age_threshold(self) -> None:
        self._seed(leaked=12)

        result = sweep(self.client, dry_run=False, min_idle_seconds=MIN_IDLE_SECONDS)

        assert result.matched == 0
        assert result.skipped_young == 12
        assert len(self._keys("grouphash:leaked*")) == 12

    def test_a_key_becomes_deletable_once_it_is_old_enough(self) -> None:
        self._seed(leaked=3)

        assert sweep(self.client, dry_run=False, min_idle_seconds=2).matched == 0
        assert len(self._keys("grouphash:leaked*")) == 3

        time.sleep(2.5)

        assert sweep(self.client, dry_run=False, min_idle_seconds=2).matched == 3
        assert self._keys("grouphash:leaked*") == []

    def test_keeps_a_key_whose_age_cannot_be_read(self) -> None:
        # A shared value object carries no per-key LRU clock. Reading its idle
        # time would report the shared object's age, not this key's, so the
        # sweep has to leave the key alone however old it looks.
        self._seed(shared=6, leaked=4)

        result = sweep(self.client, dry_run=False, min_idle_seconds=0)

        assert result.matched == 4
        assert result.skipped_unreadable == 6
        assert len(self._keys("grouphash:shared*")) == 6
        assert self._keys("grouphash:leaked*") == []

    def test_leaves_the_ttl_on_a_live_key_untouched(self) -> None:
        self._seed(live=3)

        sweep(self.client, dry_run=False, min_idle_seconds=0)

        for key in self._keys("grouphash:live*"):
            assert 0 < self.client.ttl(key) <= TTL

    def test_dry_run_counts_without_deleting(self) -> None:
        self._seed(leaked=12, live=4, shared=2)

        result = sweep(self.client, dry_run=True, min_idle_seconds=0)

        assert result.matched == 12
        assert result.skipped_live == 4
        assert result.skipped_unreadable == 2
        assert len(self._keys("grouphash:leaked*")) == 12
        assert len(self._keys("grouphash:live*")) == 4
        assert len(self._keys("grouphash:shared*")) == 2

    def test_dry_run_and_execute_agree(self) -> None:
        self._seed(leaked=9, live=3, shared=2)

        dry = sweep(self.client, dry_run=True, min_idle_seconds=0)
        wet = sweep(self.client, dry_run=False, min_idle_seconds=0)

        assert dry == wet

    def test_is_idempotent(self) -> None:
        self._seed(leaked=8, live=2)

        assert sweep(self.client, dry_run=False, min_idle_seconds=0).matched == 8
        assert sweep(self.client, dry_run=False, min_idle_seconds=0).matched == 0
        assert len(self._keys("grouphash:live*")) == 2

    def test_empty_keyspace(self) -> None:
        assert sweep(self.client, dry_run=False, min_idle_seconds=0) == (0, 0, 0, 0, 0, 0)

    def test_max_deletes_stops_and_resumes(self) -> None:
        self._seed(leaked=40)

        first = sweep(self.client, dry_run=False, min_idle_seconds=0, batch_size=5, max_deletes=10)

        assert first.cursor != 0
        assert 0 < first.matched < 40
        assert len(self._keys("grouphash:leaked*")) == 40 - first.matched

        total = first.matched
        cursor = first.cursor
        while cursor:
            nxt = sweep(
                self.client, dry_run=False, min_idle_seconds=0, batch_size=5, start_cursor=cursor
            )
            total += nxt.matched
            cursor = nxt.cursor

        assert total == 40
        assert self._keys("grouphash:leaked*") == []

    def test_max_seconds_stops_and_resumes(self) -> None:
        self._seed(leaked=40)
        # Each call advances the fake clock by one second, so a 3 second budget
        # stops the walk part way through rather than at the end.
        clock = itertools.count(0.0, 1.0)

        first = sweep(
            self.client,
            dry_run=False,
            min_idle_seconds=0,
            batch_size=5,
            max_seconds=3,
            now=lambda: next(clock),
        )

        assert first.cursor != 0
        assert 0 < first.matched < 40

        total = first.matched
        cursor = first.cursor
        while cursor:
            nxt = sweep(
                self.client, dry_run=False, min_idle_seconds=0, batch_size=5, start_cursor=cursor
            )
            total += nxt.matched
            cursor = nxt.cursor

        assert total == 40
        assert self._keys("grouphash:leaked*") == []

    def test_chunks_a_scan_page_larger_than_the_batch_size(self) -> None:
        self._seed(leaked=30)
        calls: list[int] = []
        script = self.client.register_script(DELETE_IF_STALE)

        class RecordingClient:
            def __init__(self, inner):
                self._inner = inner

            def __getattr__(self, name):
                return getattr(self._inner, name)

            def scan(self, cursor, match, count):
                # One page holding every key, ignoring the COUNT hint.
                return 0, sorted(self._inner.keys(match))

            def register_script(self, source):
                def run(keys, args):
                    calls.append(len(keys))
                    return script(keys=keys, args=args)

                return run

        result = sweep(
            RecordingClient(self.client), dry_run=False, min_idle_seconds=0, batch_size=7
        )

        assert result.matched == 30
        assert calls == [7, 7, 7, 7, 2]
        assert self._keys("grouphash:leaked*") == []

    def test_lua_skips_a_key_that_gained_a_ttl_after_the_scan(self) -> None:
        # The delete re-checks the TTL server side, so a key that gets an expiry
        # between the scan and the delete survives.
        raced = f"grouphash:raced:{self.project.id}"
        leaked = f"grouphash:leaked:{self.project.id}"
        self.client.set(raced, PRIVATE, ex=TTL)
        self.client.set(leaked, PRIVATE)

        stale, live, young, unreadable = self.client.register_script(DELETE_IF_STALE)(
            keys=[raced, leaked], args=[0]
        )

        assert (stale, live, young, unreadable) == (1, 1, 0, 0)
        assert self.client.exists(raced)
        assert not self.client.exists(leaked)
