# -*- coding: utf-8 -*-

from __future__ import absolute_import

import pytest

from sentry import eventstore
from sentry.event_manager import EventManager


@pytest.fixture
def make_template_snapshot(insta_snapshot):
    def inner(data):
        mgr = EventManager(data={"template": data})
        mgr.normalize()
        evt = eventstore.create_event(data=mgr.get_data())

        interface = evt.interfaces.get("template")
        insta_snapshot(
            {
                "errors": evt.data.get("errors"),
                "to_json": interface and interface.to_json(),
                "api_context": interface and interface.get_api_context(),
                "to_string": interface and interface.to_string(evt),
            }
        )

    return inner


def test_basic(make_template_snapshot):
    make_template_snapshot(dict(filename="foo.html", context_line="hello world", lineno=1))


@pytest.mark.parametrize(
    "input",
    [
        {},
        {"lineno": None, "context_line": ""},
        {"lineno": 0, "context_line": ""},
        {"lineno": 1},
        {"lineno": 1, "context_line": 42},
    ],
)
def test_required_attributes(make_template_snapshot, input):
    make_template_snapshot(input)
