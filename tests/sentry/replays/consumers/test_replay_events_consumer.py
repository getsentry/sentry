from unittest.mock import Mock

import msgpack
import pytest

from sentry import replaystore
from sentry.replays.consumers.replay_event_consumer import ReplayEventsConsumer

from ..fixtures import *  # NOQA


@pytest.mark.django_db
def test_process(replay_event_init, replay_event_update):
    consumer = ReplayEventsConsumer()
    message = Mock()
    message.value.return_value = msgpack.packb(replay_event_init)
    replay_message = consumer.process_message(message)
    assert replay_message

    consumer.flush_batch([replay_message])
    stored_replay = replaystore.get_replay(replay_message["data"]["event_id"])
    assert stored_replay.init
