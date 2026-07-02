from __future__ import annotations

import time
import uuid

import pytest

from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.redis import use_redis_cluster
from sentry.utils import redis
from sentry.workflow_engine.papertrail import Papertrail
from sentry.workflow_engine.papertrail.papertrail import _RedisClient

CLUSTER_ID = "papertrail-test"


def _get_test_prefix() -> str:
    return f"test-pt-{uuid.uuid4().hex[:8]}"


class PapertrailTestMixin:
    redis_client: _RedisClient

    def setUp(self) -> None:
        super().setUp()  # type: ignore[misc]
        ctx = use_redis_cluster(CLUSTER_ID)
        ctx.__enter__()
        self.addCleanup(ctx.__exit__, None, None, None)  # type: ignore[attr-defined]
        self.redis_client = redis.redis_clusters.get_binary(CLUSTER_ID)
        self.redis_client.flushdb()
        self.addCleanup(redis.redis_clusters._clusters_bytes.pop, CLUSTER_ID, None)  # type: ignore[attr-defined]


class PapertrailConstructionTest(PapertrailTestMixin, TestCase):
    def test_rejects_invalid_false_positive_rate(self) -> None:
        with pytest.raises(ValueError):
            Papertrail(self.redis_client, _get_test_prefix(), false_positive_rate=0.0)
        with pytest.raises(ValueError):
            Papertrail(self.redis_client, _get_test_prefix(), false_positive_rate=1.0)
        with pytest.raises(ValueError):
            Papertrail(self.redis_client, _get_test_prefix(), false_positive_rate=-0.1)

    def test_rejects_invalid_expected_items(self) -> None:
        with pytest.raises(ValueError):
            Papertrail(self.redis_client, _get_test_prefix(), expected_items_per_window=0)

    def test_rejects_invalid_num_shards(self) -> None:
        with pytest.raises(ValueError):
            Papertrail(self.redis_client, _get_test_prefix(), num_shards=0)

    def test_computes_bloom_parameters(self) -> None:
        pt: Papertrail[int] = Papertrail(
            self.redis_client,
            _get_test_prefix(),
            false_positive_rate=0.01,
            expected_items_per_window=100_000,
            num_shards=16,
        )
        assert pt._bits_per_shard > 0
        assert pt._num_hashes >= 1


class PapertrailObserveTest(PapertrailTestMixin, TestCase):
    def test_observe_and_check_current_hour(self) -> None:
        pt: Papertrail[int] = Papertrail(self.redis_client, _get_test_prefix(), num_shards=4)

        pt.observe(12345)
        assert pt.was_observed(12345, hours_ago=0) is True

    def test_unobserved_item_returns_false(self) -> None:
        pt: Papertrail[int] = Papertrail(self.redis_client, _get_test_prefix(), num_shards=4)

        assert pt.was_observed(99999, hours_ago=0) is False

    def test_observe_multiple_items(self) -> None:
        pt: Papertrail[int] = Papertrail(self.redis_client, _get_test_prefix(), num_shards=4)

        ids = [100, 200, 300, 400, 500]
        for item_id in ids:
            pt.observe(item_id)

        for item_id in ids:
            assert pt.was_observed(item_id) is True

        assert pt.was_observed(999) is False

    def test_different_prefixes_are_isolated(self) -> None:
        pt_a: Papertrail[int] = Papertrail(self.redis_client, _get_test_prefix(), num_shards=4)
        pt_b: Papertrail[int] = Papertrail(self.redis_client, _get_test_prefix(), num_shards=4)

        pt_a.observe(42)
        assert pt_a.was_observed(42) is True
        assert pt_b.was_observed(42) is False


class PapertrailWindowTest(PapertrailTestMixin, TestCase):
    def test_observe_in_past_window(self) -> None:
        now = time.time()
        three_hours_ago = now - 3 * 3600
        current = [three_hours_ago]
        pt: Papertrail[int] = Papertrail(
            self.redis_client,
            _get_test_prefix(),
            num_shards=4,
            ttl_hours=24,
            time_fn=lambda: current[0],
        )

        pt.observe(555)

        current[0] = now
        assert pt.was_observed(555, hours_ago=3) is True
        assert pt.was_observed(555, hours_ago=0) is False

    def test_was_observed_rejects_negative_hours(self) -> None:
        pt: Papertrail[int] = Papertrail(self.redis_client, _get_test_prefix(), num_shards=4)

        with pytest.raises(ValueError):
            pt.was_observed(1, hours_ago=-1)


class PapertrailFalsePositiveRateTest(PapertrailTestMixin, TestCase):
    def test_false_positive_rate_within_bounds(self) -> None:
        target_fpr = 0.01
        n = 1000
        pt: Papertrail[int] = Papertrail(
            self.redis_client,
            _get_test_prefix(),
            false_positive_rate=target_fpr,
            expected_items_per_window=n,
            num_shards=1,
        )

        for i in range(n):
            pt.observe(i)

        false_positives = 0
        test_count = 1000
        for i in range(n, n + test_count):
            if pt.was_observed(i):
                false_positives += 1

        observed_fpr = false_positives / test_count
        assert observed_fpr < target_fpr * 2, f"FPR {observed_fpr} exceeds 2x target {target_fpr}"
