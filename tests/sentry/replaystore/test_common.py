from contextlib import contextmanager
from datetime import datetime, timedelta

import pytest

from sentry.replaystore.base import ReplayDataType
from sentry.replaystore.django.backend import DjangoReplayStore
from tests.sentry.replaystore.bigtable.tests import get_temporary_bigtable_replaystore


@contextmanager
def nullcontext(returning):
    # TODO: Replace with ``contextlib.nullcontext`` after upgrading to 3.7
    yield returning


@pytest.fixture(params=["bigtable-real", pytest.param("django", marks=pytest.mark.django_db)])
def rs(request):
    # backends are returned from context managers to support teardown when required
    backends = {
        "bigtable-real": lambda: get_temporary_bigtable_replaystore(),
        "django": lambda: nullcontext(DjangoReplayStore()),
    }

    ctx = backends[request.param]()
    with ctx as rs:
        rs.bootstrap()
        yield rs


def test_set_get(rs):
    init_replay_id = "d2502ebbd7df41ceba8d3275595cac33"
    event_data = (
        (
            init_replay_id,
            {"foo": "bar"},
            ReplayDataType.INIT,
            datetime.now() - timedelta(seconds=10),
        ),
        (
            init_replay_id,
            {"test": "test"},
            ReplayDataType.EVENT,
            datetime.now() - timedelta(seconds=5),
        ),
    )
    payload = (
        init_replay_id,
        b'{"recording": "demo"}',
        datetime.now() - timedelta(seconds=3),
    )

    for id, data, type, timestamp in event_data:
        rs.set_event(id, data, type, timestamp)

    rs.set_payload(payload[0], payload[1], payload[2])

    replay = rs.get_replay(init_replay_id)

    assert replay.id == event_data[0][0]
    assert replay.init == event_data[0][1]
    assert replay.events == [event_data[1][1]]
    assert replay.payloads == [payload[1]]
