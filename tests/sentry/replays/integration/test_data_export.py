import datetime
import uuid

import pytest
import requests
from django.conf import settings

from sentry.replays.data_export import (
    export_clickhouse_rows,
    export_replay_row_set,
    query_replays_dataset,
)
from sentry.replays.testutils import mock_replay
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
def test_export_clickhouse_rows(replay_store):
    """
    Assert searches can find a replay if the search range does not cover segment-0.
    """
    replay1_id = uuid.uuid4().hex
    replay2_id = uuid.uuid4().hex
    replay3_id = uuid.uuid4().hex
    replay4_id = uuid.uuid4().hex
    replay5_id = uuid.uuid4().hex

    t0 = datetime.datetime.now()
    t1 = t0 + datetime.timedelta(minutes=1)
    t2 = t0 + datetime.timedelta(minutes=2)
    t3 = t0 + datetime.timedelta(minutes=3)

    replay_store.save(mock_replay(t1, 1, replay1_id, segment_id=0))
    replay_store.save(mock_replay(t1, 1, replay2_id, segment_id=0))
    replay_store.save(mock_replay(t2, 1, replay3_id, segment_id=1))
    replay_store.save(mock_replay(t3, 1, replay4_id, segment_id=0))
    replay_store.save(mock_replay(t2, 2, replay5_id, segment_id=0))

    query_fn = lambda limit, offset: query_replays_dataset(1, t0, t3, limit, offset)
    rows = list(export_clickhouse_rows(query_fn, limit=1, num_pages=10))
    assert len(rows) == 3


@pytest.mark.snuba
@requires_snuba
def test_export_replay_row_set(replay_store):
    replay_id = uuid.uuid4().hex
    t0 = datetime.datetime.now()
    t1 = t0 + datetime.timedelta(minutes=1)

    replay_store.save(mock_replay(t0, 1, replay_id, segment_id=0))

    class Sink:
        def __init__(self):
            self.file_name = None
            self.query_data = None

        def __call__(self, file_name: str, query_data: str) -> None:
            self.file_name = file_name
            self.query_data = query_data

    sink = Sink()
    export_replay_row_set(1, t0, t1, limit=1, initial_offset=0, write_to_sink=sink)

    assert sink.file_name is not None
    assert sink.query_data is not None
