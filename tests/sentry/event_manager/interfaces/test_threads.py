# -*- coding: utf-8 -*-

from __future__ import absolute_import

import pytest

from sentry import eventstore
from sentry.event_manager import EventManager


@pytest.fixture
def make_threads_snapshot(insta_snapshot):
    def inner(data):
        mgr = EventManager(data={"threads": data})
        mgr.normalize()
        evt = eventstore.create_event(data=mgr.get_data())

        interface = evt.interfaces.get("threads")
        insta_snapshot(
            {
                "errors": evt.data.get("errors"),
                "to_json": interface and interface.to_json(),
                "api_context": interface and interface.get_api_context(),
            }
        )

    return inner


basic_payload = dict(
    values=[
        {
            "id": 42,
            "crashed": False,
            "current": True,
            "name": "Main Thread",
            "stacktrace": {
                "frames": [
                    {"filename": "foo/baz.c", "function": "main", "lineno": 1, "in_app": True}
                ]
            },
            "raw_stacktrace": {
                "frames": [
                    {"filename": None, "lineno": 1, "function": "<redacted>", "in_app": True}
                ]
            },
        }
    ]
)


def test_basics(make_threads_snapshot):
    make_threads_snapshot(basic_payload)


@pytest.mark.parametrize(
    "input",
    [
        {"values": [{}]},
        {"values": [{"id": None}]},
        {"values": [{"name": None}]},
        {"values": [{"stacktrace": None}]},
    ],
)
def test_null_values(make_threads_snapshot, input):
    make_threads_snapshot(input)
