import pytest

from sentry import replaystore
from sentry.replays.tasks import save_replay_event

from ..fixtures import *  # NOQA


@pytest.mark.django_db
def test_replay_event_init(default_project, replay_event_init_parsed):
    save_replay_event(
        replay_event_init_parsed,
    )
    replay = replaystore.get_replay(replay_event_init_parsed["data"]["event_id"])

    assert replay.init


@pytest.mark.django_db
def test_replay_event_update(default_project, replay_event_update_parsed):
    save_replay_event(
        replay_event_update_parsed,
    )

    replay = replaystore.get_replay(replay_event_update_parsed["data"]["event_id"])

    assert replay.events
