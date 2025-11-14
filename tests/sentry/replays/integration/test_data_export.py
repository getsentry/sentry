from typing import int
import csv
import datetime
import uuid

import pytest

from sentry.replays.data_export import (
    export_clickhouse_rows,
    export_replay_row_set,
    get_replay_date_query_ranges,
    query_replays_dataset,
)
from sentry.replays.testutils import mock_replay
from sentry.testutils.skips import requires_snuba


@pytest.mark.snuba
@requires_snuba
def test_export_clickhouse_rows(replay_store) -> None:  # type: ignore[no-untyped-def]
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
def test_export_replay_row_set(replay_store) -> None:  # type: ignore[no-untyped-def]
    replay1_id = "030c5419-9e0f-46eb-ae18-bfe5fd0331b5"
    replay2_id = "0dbda2b3-9286-4ecc-a409-aa32b241563d"
    replay3_id = "ff08c103-a9a4-47c0-9c29-73b932c2da34"
    t0 = datetime.datetime(year=2025, month=1, day=1)
    t1 = t0 + datetime.timedelta(seconds=30)
    t2 = t0 + datetime.timedelta(minutes=1)

    replay_store.save(mock_replay(t0, 1, replay1_id, segment_id=0))
    replay_store.save(mock_replay(t1, 1, replay2_id, segment_id=0))
    replay_store.save(mock_replay(t2, 1, replay3_id, segment_id=0))

    class Sink:
        def __init__(self) -> None:
            self.filename: str | None = None
            self.contents: str | None = None

        def __call__(self, filename: str, contents: str) -> None:
            self.filename = filename
            self.contents = contents

    sink = Sink()
    project_id = 1
    initial_offset = 0
    export_replay_row_set(
        project_id, t0, t2, limit=100, initial_offset=initial_offset, write_to_storage=sink
    )

    assert (
        sink.filename
        == f"clickhouse/session-replay/{project_id}/{t0.isoformat()}/{t2.isoformat()}/{initial_offset}"
    )
    assert sink.contents is not None

    csvfile = csv.reader(sink.contents.splitlines())
    rows = [r for r in csvfile]
    assert len(rows) == 3
    assert rows[1][0] == replay1_id
    assert rows[2][0] == replay2_id


@pytest.mark.snuba
@requires_snuba
def test_get_replay_date_query_ranges(replay_store) -> None:  # type: ignore[no-untyped-def]
    replay1_id = str(uuid.uuid4())
    replay2_id = str(uuid.uuid4())
    replay3_id = str(uuid.uuid4())
    replay4_id = str(uuid.uuid4())
    replay5_id = str(uuid.uuid4())

    t0 = datetime.datetime.now()
    t1 = t0 + datetime.timedelta(days=10)
    t2 = t0 + datetime.timedelta(days=20)

    replay_store.save(mock_replay(t0, 1, replay1_id, segment_id=0))
    replay_store.save(mock_replay(t1, 1, replay2_id, segment_id=0))
    replay_store.save(mock_replay(t2, 1, replay3_id, segment_id=0))
    replay_store.save(mock_replay(t2, 1, replay4_id, segment_id=0))
    replay_store.save(mock_replay(t2, 2, replay5_id, segment_id=0))

    results = list(get_replay_date_query_ranges(1))
    assert len(results) == 3
    assert results[0][0] == datetime.datetime(year=t0.year, month=t0.month, day=t0.day)
    assert results[0][1] == datetime.datetime(
        year=t0.year, month=t0.month, day=t0.day
    ) + datetime.timedelta(days=1)
    assert results[0][2] == 1
    assert results[1][0] == datetime.datetime(year=t1.year, month=t1.month, day=t1.day)
    assert results[1][1] == datetime.datetime(
        year=t1.year, month=t1.month, day=t1.day
    ) + datetime.timedelta(days=1)
    assert results[1][2] == 1
    assert results[2][0] == datetime.datetime(year=t2.year, month=t2.month, day=t2.day)
    assert results[2][1] == datetime.datetime(
        year=t2.year, month=t2.month, day=t2.day
    ) + datetime.timedelta(days=1)
    assert results[2][2] == 2
