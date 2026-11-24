from datetime import UTC, datetime, timedelta, timezone

import pytest
from django.conf import settings

from sentry.anomaly_detection.state import (
    STATE_TTL,
    AnomalyDetectionState,
    compare_and_set_state,
    delete_state,
    get_state,
)
from sentry.utils import redis

ORG_ID = 1
MINUTE = datetime(2020, 1, 1, 12, 0, tzinfo=UTC)
# Not valid UTF-8, so a decoding client would corrupt it.
BLOB = b"\x78\x9c\xff\x00checkpoint"


def _ttl(organization_id: int) -> int:
    client = redis.redis_clusters.get_binary(settings.SENTRY_ANOMALY_DETECTION_REDIS_CLUSTER)
    return client.ttl(f"anomaly-detection:state:v1:{organization_id}")


def test_first_write_creates_state() -> None:
    assert get_state(ORG_ID) is None

    assert compare_and_set_state(ORG_ID, expected_minute=None, next_minute=MINUTE, checkpoint=BLOB)

    assert get_state(ORG_ID) == AnomalyDetectionState(next_minute=MINUTE, checkpoint=BLOB)
    assert 0 < _ttl(ORG_ID) <= STATE_TTL.total_seconds()


def test_first_write_loses_to_existing_state() -> None:
    compare_and_set_state(ORG_ID, expected_minute=None, next_minute=MINUTE, checkpoint=BLOB)

    assert not compare_and_set_state(
        ORG_ID, expected_minute=None, next_minute=MINUTE + timedelta(minutes=5), checkpoint=b"new"
    )
    assert get_state(ORG_ID) == AnomalyDetectionState(next_minute=MINUTE, checkpoint=BLOB)


def test_advances_from_the_minute_it_read() -> None:
    compare_and_set_state(ORG_ID, expected_minute=None, next_minute=MINUTE, checkpoint=BLOB)
    later = MINUTE + timedelta(minutes=5)

    assert compare_and_set_state(
        ORG_ID, expected_minute=MINUTE, next_minute=later, checkpoint=b"new"
    )

    assert get_state(ORG_ID) == AnomalyDetectionState(next_minute=later, checkpoint=b"new")


def test_stale_writer_does_not_roll_state_back() -> None:
    compare_and_set_state(ORG_ID, expected_minute=None, next_minute=MINUTE, checkpoint=BLOB)
    later = MINUTE + timedelta(minutes=5)
    compare_and_set_state(ORG_ID, expected_minute=MINUTE, next_minute=later, checkpoint=b"new")

    assert not compare_and_set_state(
        ORG_ID, expected_minute=MINUTE, next_minute=MINUTE + timedelta(minutes=1), checkpoint=b"old"
    )
    assert get_state(ORG_ID) == AnomalyDetectionState(next_minute=later, checkpoint=b"new")


def test_compares_instants_across_timezones() -> None:
    compare_and_set_state(ORG_ID, expected_minute=None, next_minute=MINUTE, checkpoint=BLOB)
    pacific = MINUTE.astimezone(timezone(timedelta(hours=-8)))

    assert compare_and_set_state(
        ORG_ID, expected_minute=pacific, next_minute=MINUTE + timedelta(minutes=1), checkpoint=BLOB
    )


def test_rejects_naive_minutes() -> None:
    with pytest.raises(ValueError):
        compare_and_set_state(
            ORG_ID, expected_minute=None, next_minute=MINUTE.replace(tzinfo=None), checkpoint=BLOB
        )
    assert get_state(ORG_ID) is None


def test_state_is_per_organization() -> None:
    compare_and_set_state(ORG_ID, expected_minute=None, next_minute=MINUTE, checkpoint=BLOB)
    compare_and_set_state(ORG_ID + 1, expected_minute=None, next_minute=MINUTE, checkpoint=b"other")

    delete_state(ORG_ID)

    assert get_state(ORG_ID) is None
    assert get_state(ORG_ID + 1) == AnomalyDetectionState(next_minute=MINUTE, checkpoint=b"other")
