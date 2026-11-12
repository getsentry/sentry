from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

from sentry.replays.query import MAX_REPLAY_LENGTH_HOURS
from sentry.replays.usecases.replay_existence import filter_existing_replay_ids


@patch("sentry.replays.usecases.replay_existence.raw_snql_query")
def test_filter_existing_replay_ids_pads_time_window(mock_raw_snql_query: MagicMock) -> None:
    mock_raw_snql_query.return_value = {"data": [{"rid": "a" * 32}]}
    start = datetime(2024, 1, 15, 12, 0, tzinfo=UTC)
    end = datetime(2024, 1, 15, 13, 0, tzinfo=UTC)

    result = filter_existing_replay_ids(
        project_ids=[1],
        start=start,
        end=end,
        replay_ids=["a" * 32],
        tenant_ids={"organization_id": 1},
    )

    assert result == {"a" * 32}
    request = mock_raw_snql_query.call_args.args[0]
    where = request.query.where
    assert where[1].rhs == end + timedelta(hours=MAX_REPLAY_LENGTH_HOURS)
    assert where[2].rhs == start - timedelta(hours=MAX_REPLAY_LENGTH_HOURS)


def test_filter_existing_replay_ids_empty_input() -> None:
    assert (
        filter_existing_replay_ids(
            project_ids=[1],
            start=datetime(2024, 1, 15, tzinfo=UTC),
            end=datetime(2024, 1, 16, tzinfo=UTC),
            replay_ids=[],
            tenant_ids={"organization_id": 1},
        )
        == set()
    )
