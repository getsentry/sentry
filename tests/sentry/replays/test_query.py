import uuid
from datetime import UTC, datetime, timedelta
from typing import int, Any
from unittest.mock import Mock, patch

import pytest
import requests
from django.conf import settings

from sentry.replays.query import get_replay_range
from sentry.replays.testutils import mock_replay
from sentry.testutils.skips import requires_snuba


class ReplayStore:
    def save(self, data: Any) -> None:
        request_url = settings.SENTRY_SNUBA + "/tests/entities/replays/insert"
        response = requests.post(request_url, json=[data])
        assert response.status_code == 200


@pytest.fixture
def replay_store() -> ReplayStore:
    assert requests.post(settings.SENTRY_SNUBA + "/tests/replays/drop").status_code == 200
    return ReplayStore()


@pytest.mark.snuba
@requires_snuba
def test_get_replay_range_success(replay_store: ReplayStore) -> None:
    """Test that get_replay_range returns correct time range for existing replay."""
    replay_id = uuid.uuid4().hex
    organization_id = 1
    project_id = 1
    start_time = datetime.now(UTC) - timedelta(minutes=10)

    replay_store.save(mock_replay(start_time, project_id, replay_id))

    result = get_replay_range(
        organization_id=organization_id,
        project_id=project_id,
        replay_id=replay_id,
    )

    assert result is not None
    start, end = result

    assert isinstance(start, datetime)
    assert isinstance(end, datetime)

    # The start should be close to our replay start time (within a reasonable tolerance)
    assert abs((start - start_time).total_seconds()) < 60  # Within 1 minute

    assert end >= start

    # Both should be recent (within last 90 days)
    now = datetime.now(UTC)
    assert (now - start).days < 90
    assert (now - end).days < 90


@pytest.mark.snuba
@requires_snuba
def test_get_replay_range_replay_not_found(replay_store: ReplayStore) -> None:
    """Test that get_replay_range returns None for non-existent replay."""
    non_existent_replay_id = uuid.uuid4().hex
    organization_id = 1
    project_id = 1

    result = get_replay_range(
        organization_id=organization_id,
        project_id=project_id,
        replay_id=non_existent_replay_id,
    )

    assert result is None


@pytest.mark.snuba
@requires_snuba
def test_get_replay_range_replay_outside_90_day_window(
    replay_store: ReplayStore,
) -> None:
    """Test that get_replay_range returns None for replay older than 90 days."""
    replay_id = uuid.uuid4().hex
    organization_id = 1
    project_id = 1
    # Create a replay that's older than 90 days
    old_time = datetime.now(UTC) - timedelta(days=100)

    replay_store.save(mock_replay(old_time, project_id, replay_id))

    result = get_replay_range(
        organization_id=organization_id,
        project_id=project_id,
        replay_id=replay_id,
    )

    assert result is None


@pytest.mark.snuba
@requires_snuba
def test_get_replay_range_wrong_project(replay_store: ReplayStore) -> None:
    """Test that get_replay_range returns None when querying wrong project."""
    replay_id = uuid.uuid4().hex
    organization_id = 1
    project_id = 1
    wrong_project_id = 2

    replay_store.save(mock_replay(datetime.now(UTC), project_id, replay_id))

    result = get_replay_range(
        organization_id=organization_id,
        project_id=wrong_project_id,
        replay_id=replay_id,
    )

    assert result is None


@pytest.mark.snuba
@requires_snuba
@patch("sentry.replays.usecases.query.execute_query")
def test_get_replay_range_handles_null_aggregates(
    mock_execute_query: Mock, replay_store: ReplayStore
) -> None:
    """Test that get_replay_range handles null aggregates gracefully."""
    mock_execute_query.return_value = {"data": [{"min": None, "max": None}]}
    replay_id = uuid.uuid4().hex
    organization_id = 1
    project_id = 1

    result = get_replay_range(
        organization_id=organization_id,
        project_id=project_id,
        replay_id=replay_id,
    )

    assert result is None
