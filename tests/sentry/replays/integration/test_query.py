import datetime
import uuid

import pytest
import requests
from django.conf import settings
from snuba_sdk import Column, Condition, Op

from sentry.api.event_search import SearchFilter, SearchKey, SearchValue
from sentry.replays.testutils import mock_replay
from sentry.replays.usecases.query import (
    Paginators,
    query_using_optimized_search,
    replay_existence_check,
)
from sentry.testutils.skips import requires_snuba


class ReplayStore:

    def save(self, data):
        request_url = settings.SENTRY_SNUBA + "/tests/entities/replays/insert"
        response = requests.post(request_url, json=[data])
        assert response.status_code == 200


@pytest.fixture
def replay_store():
    assert requests.post(settings.SENTRY_SNUBA + "/tests/replays/drop").status_code == 200
    return ReplayStore()


@pytest.mark.snuba
@requires_snuba
def test_find_replay_outside_range(replay_store):
    """
    Assert searches can find a replay if the search range does not cover segment-0.
    """
    replay_id = uuid.uuid4().hex

    t3 = datetime.datetime.now()
    t1 = t3 - datetime.timedelta(hours=1)
    t2 = t3 - datetime.timedelta(minutes=5)
    replay_store.save(mock_replay(t1, 1, replay_id, segment_id=0))
    replay_store.save(mock_replay(t2, 1, replay_id, segment_id=1))

    response = query_using_optimized_search(
        fields=["id", "project_id"],  # intentionally selecting multiple fields.
        search_filters=[],
        environments=[],
        sort=None,
        pagination=Paginators(100, 0),
        organization_id=1,
        project_ids=[1],
        period_start=t2,
        period_stop=t3,
        viewed_by_denylist=[],
        request_user_id=None,
    )
    assert response.response[0]["replay_id"] == str(uuid.UUID(replay_id))


@pytest.mark.snuba
@requires_snuba
@pytest.mark.parametrize(
    "delta, is_returned, reason",
    [
        (datetime.timedelta(seconds=0), True, "In range."),
        (datetime.timedelta(hours=1), True, "In extended range."),
        (datetime.timedelta(hours=1, seconds=1), False, "Outside extended range."),
        (-datetime.timedelta(minutes=5, seconds=1), False, "In the future."),
    ],
)
def test_replay_existence_check(replay_store, delta, is_returned, reason):
    """
    Assert a replay is only found if its zeroth segment is within the extended range defined by
    the query.

    Limit is set to `2` so that we can assert duplicates are removed.
    """
    replay_id = str(uuid.uuid4())

    end = datetime.datetime.now()
    start = end - datetime.timedelta(minutes=5)
    replay_store.save(mock_replay(start - delta, 1, replay_id, segment_id=0))
    replay_store.save(mock_replay(start, 1, replay_id, segment_id=1))

    response = replay_existence_check(
        project_ids=[1],
        start=start,
        stop=end,
        conditions=[Condition(Column("replay_id"), Op.EQ, replay_id)],
        limit=2,
        organization_id=1,
    )

    if is_returned:
        assert len(response) == 1, reason
        assert response[0]["replay_id"] == replay_id
    else:
        assert len(response) == 0, reason


@pytest.mark.snuba
@requires_snuba
def test_optimized_search_leads_to_existence_check(replay_store):
    """
    Assert optimized search function will perform a greedy existence check under certain
    conditions.
    """
    replay_id = uuid.uuid4().hex

    end = datetime.datetime.now()
    start = end - datetime.timedelta(minutes=5)
    replay_store.save(mock_replay(start, 1, replay_id, segment_id=0))

    response = query_using_optimized_search(
        fields=["id"],
        search_filters=[SearchFilter(SearchKey("id"), "IN", SearchValue([replay_id]))],
        environments=[],
        sort=None,
        pagination=Paginators(100, 0),
        organization_id=1,
        project_ids=[1],
        period_start=start,
        period_stop=end,
        viewed_by_denylist=[],
        request_user_id=None,
    )
    assert response.response[0]["replay_id"] == str(uuid.UUID(replay_id))
    assert response.source == "replay-existence-check"
