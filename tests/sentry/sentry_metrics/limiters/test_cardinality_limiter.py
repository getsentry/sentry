import time
from typing import Optional, Sequence, Tuple

import pytest

from sentry.ratelimits.cardinality import (
    CardinalityLimiter,
    GrantedQuota,
    Quota,
    RequestedQuota,
    Timestamp,
)
from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.sentry_metrics.consumers.indexer.batch import PartitionIdxOffset
from sentry.sentry_metrics.indexer.limiters.cardinality import TimeseriesCardinalityLimiter


@pytest.fixture(autouse=True)
def rollout_all_orgs_release_health(set_sentry_option):
    with set_sentry_option("sentry-metrics.cardinality-limiter-rh.orgs-rollout-rate", 1.0):
        yield


class MockCardinalityLimiter(CardinalityLimiter):
    def __init__(self):
        self.grant_hashes = 10
        self.assert_quota: Optional[Quota] = None
        self.assert_requests: Optional[Sequence[RequestedQuota]] = None

    def check_within_quotas(
        self, requests: Sequence[RequestedQuota], timestamp: Optional[Timestamp] = None
    ) -> Tuple[Timestamp, Sequence[GrantedQuota]]:
        if timestamp is None:
            timestamp = int(time.time())
        else:
            timestamp = int(timestamp)

        if self.assert_requests is not None:
            assert requests == self.assert_requests

        grants = []
        granted = 0
        for request in requests:
            assert request.quota == self.assert_quota
            granted_hashes = set()
            for hash in request.unit_hashes:
                if granted < self.grant_hashes:
                    granted += 1
                    granted_hashes.add(hash)

            # reached_quotas is incorrect, but we don't necessarily need it for testing
            grants.append(
                GrantedQuota(
                    request=request, granted_unit_hashes=granted_hashes, reached_quota=None
                )
            )

        return timestamp, grants

    def use_quotas(
        self,
        grants: Sequence[GrantedQuota],
        timestamp: Timestamp,
    ) -> None:
        pass


def test_reject_all(set_sentry_option):
    with set_sentry_option(
        "sentry-metrics.cardinality-limiter.limits.releasehealth.per-org",
        [{"window_seconds": 3600, "granularity_seconds": 60, "limit": 0}],
    ):
        backend = MockCardinalityLimiter()
        backend.assert_quota = Quota(window_seconds=3600, granularity_seconds=60, limit=0)
        backend.grant_hashes = 0
        limiter = TimeseriesCardinalityLimiter("", backend)

        result = limiter.check_cardinality_limits(
            UseCaseKey.RELEASE_HEALTH,
            {
                PartitionIdxOffset(0, 0): {"org_id": 1, "name": "foo", "tags": {}},
                PartitionIdxOffset(0, 1): {"org_id": 1, "name": "bar", "tags": {}},
            },
        )

        assert result.keys_to_remove == [PartitionIdxOffset(0, 0), PartitionIdxOffset(0, 1)]


def test_reject_partial(set_sentry_option):
    with set_sentry_option(
        "sentry-metrics.cardinality-limiter.limits.releasehealth.per-org",
        [{"window_seconds": 3600, "granularity_seconds": 60, "limit": 1}],
    ):
        backend = MockCardinalityLimiter()
        backend.assert_quota = Quota(window_seconds=3600, granularity_seconds=60, limit=1)
        backend.grant_hashes = 1
        limiter = TimeseriesCardinalityLimiter("", backend)

        result = limiter.check_cardinality_limits(
            UseCaseKey.RELEASE_HEALTH,
            {
                PartitionIdxOffset(0, 0): {"org_id": 1, "name": "foo", "tags": {}},
                PartitionIdxOffset(0, 1): {"org_id": 1, "name": "bar", "tags": {}},
                PartitionIdxOffset(0, 2): {"org_id": 1, "name": "baz", "tags": {}},
            },
        )

        assert result.keys_to_remove == [PartitionIdxOffset(0, 1), PartitionIdxOffset(0, 2)]


def test_accept_all(set_sentry_option):
    with set_sentry_option("sentry-metrics.cardinality-limiter.limits.releasehealth.per-org", []):
        backend = MockCardinalityLimiter()
        backend.grant_hashes = 1000
        limiter = TimeseriesCardinalityLimiter("", backend)

        result = limiter.check_cardinality_limits(
            UseCaseKey.RELEASE_HEALTH,
            {
                PartitionIdxOffset(0, 0): {"org_id": 1, "name": "foo", "tags": {}},
                PartitionIdxOffset(0, 1): {"org_id": 1, "name": "bar", "tags": {}},
                PartitionIdxOffset(0, 2): {"org_id": 1, "name": "baz", "tags": {}},
            },
        )

        assert not result.keys_to_remove


def test_sample_rate_zero(set_sentry_option):
    """
    Assert that with a rollout rate of zero, no quotas are applied.
    """

    with set_sentry_option(
        "sentry-metrics.cardinality-limiter.limits.releasehealth.per-org",
        [{"window_seconds": 3600, "granularity_seconds": 60, "limit": 0}],
    ), set_sentry_option("sentry-metrics.cardinality-limiter-rh.orgs-rollout-rate", 0.0):
        backend = MockCardinalityLimiter()
        backend.grant_hashes = 0
        backend.assert_requests = []
        limiter = TimeseriesCardinalityLimiter("", backend)

        result = limiter.check_cardinality_limits(
            UseCaseKey.RELEASE_HEALTH,
            {
                PartitionIdxOffset(0, 0): {"org_id": 1, "name": "foo", "tags": {}},
                PartitionIdxOffset(0, 1): {"org_id": 1, "name": "bar", "tags": {}},
                PartitionIdxOffset(0, 2): {"org_id": 1, "name": "baz", "tags": {}},
            },
        )

        assert not result.keys_to_remove
        # Assert that we are not just passing the rate limiter, but also do not
        # check any quotas. If there are no quotas, there are no requests, and
        # therefore no grants.
        #
        # Right now we do call the limiter with an empty list of requests. If
        # we didn't, `_grants` would be `None` instead of `[]`. Either behavior
        # would be fine, in neither case we are hitting redis.
        assert result._grants == []


def test_sample_rate_half(set_sentry_option):
    with set_sentry_option(
        "sentry-metrics.cardinality-limiter.limits.releasehealth.per-org",
        [{"window_seconds": 3600, "granularity_seconds": 60, "limit": 0}],
    ), set_sentry_option("sentry-metrics.cardinality-limiter-rh.orgs-rollout-rate", 0.5):

        backend = MockCardinalityLimiter()
        backend.grant_hashes = 0
        backend.assert_quota = Quota(window_seconds=3600, granularity_seconds=60, limit=0)
        limiter = TimeseriesCardinalityLimiter("", backend)

        result = limiter.check_cardinality_limits(
            UseCaseKey.RELEASE_HEALTH,
            {
                PartitionIdxOffset(0, 0): {"org_id": 1, "name": "foo", "tags": {}},
                PartitionIdxOffset(0, 1): {"org_id": 99, "name": "bar", "tags": {}},
            },
        )

        # We are sampling org_id=1 into cardinality limiting. Because our quota is
        # zero, only that org's metrics are dropped.
        assert result.keys_to_remove == [PartitionIdxOffset(0, 0)]
