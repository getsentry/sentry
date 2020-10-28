from __future__ import absolute_import

import pytest

from sentry import eventstore
from sentry.event_manager import EventManager


@pytest.fixture
def make_message_snapshot(insta_snapshot):
    def inner(data):
        mgr = EventManager(data={"logentry": data})
        mgr.normalize()
        evt = eventstore.create_event(data=mgr.get_data())

        interface = evt.interfaces.get("logentry")
        insta_snapshot(
            {"errors": evt.data.get("errors"), "to_json": interface and interface.to_json()}
        )

    return inner


def test_basic(make_message_snapshot):
    make_message_snapshot(
        dict(message="Hello there %s!", params=("world",), formatted="Hello there world!")
    )


def test_format_kwargs(make_message_snapshot):
    make_message_snapshot(dict(message="Hello there %(name)s!", params={"name": "world"}))


def test_format_braces(make_message_snapshot):
    make_message_snapshot(dict(message="Hello there {}!", params=("world",)))


@pytest.mark.parametrize("input", [42, True, 4.2])
def test_stringify_primitives(make_message_snapshot, input):
    make_message_snapshot(input)


def test_retains_formatted(make_message_snapshot):
    # we had a regression which was throwing this data away
    make_message_snapshot({"message": "foo bar", "formatted": "foo bar baz"})


def test_discards_dupe_message(make_message_snapshot):
    make_message_snapshot({"message": "foo bar", "formatted": "foo bar"})
