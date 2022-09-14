import time
from typing import Optional, Sequence, Tuple

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


class MockCardinalityLimiter(CardinalityLimiter):
    def __init__(self):
        self.grant_hashes = 10
        self.assert_quotas = []

    def check_within_quotas(
        self, requests: Sequence[RequestedQuota], timestamp: Optional[Timestamp] = None
    ) -> Tuple[Timestamp, Sequence[GrantedQuota]]:
        if timestamp is None:
            timestamp = int(time.time())
        else:
            timestamp = int(timestamp)

        grants = []
        granted = 0
        for request in requests:
            assert request.quotas == self.assert_quotas
            granted_hashes = set()
            for hash in request.unit_hashes:
                if granted < self.grant_hashes:
                    granted += 1
                    granted_hashes.add(hash)

            # reached_quotas is incorrect, but we don't necessarily need it for testing
            grants.append(
                GrantedQuota(request=request, granted_unit_hashes=granted_hashes, reached_quotas=[])
            )

        return timestamp, grants

    def use_quotas(
        self,
        grants: Sequence[GrantedQuota],
        timestamp: Timestamp,
    ) -> None:
        pass


def test_reject_all(set_sentry_option):
    set_sentry_option("sentry-metrics.cardinality-limiter.limits.releasehealth.per-org", [])
    backend = MockCardinalityLimiter()
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
    set_sentry_option(
        "sentry-metrics.cardinality-limiter.limits.releasehealth.per-org",
        [{"window_seconds": 3600, "granularity_seconds": 60, "limit": 1}],
    )

    backend = MockCardinalityLimiter()
    backend.assert_quotas = [
        Quota(window_seconds=3600, granularity_seconds=60, limit=1),
    ]
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
    set_sentry_option("sentry-metrics.cardinality-limiter.limits.releasehealth.per-org", [])
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
