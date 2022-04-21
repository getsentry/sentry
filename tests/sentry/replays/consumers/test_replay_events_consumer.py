from unittest.mock import Mock

import msgpack
import pytest

from sentry.replays.consumers.replay_event_consumer import ReplayEventsConsumer

from ..fixtures import *  # NOQA


@pytest.mark.django_db
def test_process(replay_event_init):
    consumer = ReplayEventsConsumer()
    message = Mock()
    message.value.return_value = msgpack.packb(replay_event_init)
    replay = consumer.process_message(message)
    assert replay
