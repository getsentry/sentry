from datetime import UTC, datetime, timedelta, timezone

import pytest

from sentry.anomaly_detection.state import (
    STATE_TTL,
    AnomalyDetectionState,
    _client,
    _key,
    delete_state,
    get_state,
    set_state,
)

ORG_ID = 1
MINUTE = datetime(2020, 1, 1, 12, 0, tzinfo=UTC)
# Not valid UTF-8, so a decoding client would corrupt it.
BLOB = b"\x78\x9c\xff\x00checkpoint"


def _ttl(organization_id: int) -> int:
    return _client().ttl(_key(organization_id))


def test_round_trips_state_with_ttl() -> None:
    assert get_state(ORG_ID) is None

    set_state(ORG_ID, next_minute=MINUTE, checkpoint=BLOB)

    assert get_state(ORG_ID) == AnomalyDetectionState(next_minute=MINUTE, checkpoint=BLOB)
    assert 0 < _ttl(ORG_ID) <= STATE_TTL.total_seconds()


def test_overwrite_replaces_state_and_restarts_ttl() -> None:
    set_state(ORG_ID, next_minute=MINUTE, checkpoint=BLOB)
    _client().expire(_key(ORG_ID), 10)
    later = MINUTE + timedelta(minutes=5)

    set_state(ORG_ID, next_minute=later, checkpoint=b"")

    assert get_state(ORG_ID) == AnomalyDetectionState(next_minute=later, checkpoint=b"")
    assert _ttl(ORG_ID) > 10


def test_stores_minutes_as_utc() -> None:
    set_state(ORG_ID, next_minute=MINUTE.astimezone(timezone(timedelta(hours=-8))), checkpoint=BLOB)

    state = get_state(ORG_ID)
    assert state is not None
    assert state.next_minute == MINUTE
    assert state.next_minute.tzinfo == UTC


def test_rejects_naive_minutes() -> None:
    with pytest.raises(ValueError):
        set_state(ORG_ID, next_minute=MINUTE.replace(tzinfo=None), checkpoint=BLOB)
    assert get_state(ORG_ID) is None


def test_state_is_per_organization() -> None:
    set_state(ORG_ID, next_minute=MINUTE, checkpoint=BLOB)
    set_state(ORG_ID + 1, next_minute=MINUTE, checkpoint=b"other")

    delete_state(ORG_ID)

    assert get_state(ORG_ID) is None
    assert get_state(ORG_ID + 1) == AnomalyDetectionState(next_minute=MINUTE, checkpoint=b"other")
