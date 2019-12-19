# -*- coding: utf-8 -*-

from __future__ import absolute_import

import pytest

from sentry import eventstore
from sentry.event_manager import EventManager


@pytest.fixture
def make_frames_snapshot(insta_snapshot):
    def inner(data):
        mgr = EventManager(data={"stacktrace": {"frames": [data]}})
        mgr.normalize()
        evt = eventstore.create_event(data=mgr.get_data())
        frame = evt.interfaces["stacktrace"].frames[0]

        insta_snapshot({"errors": evt.data.get("errors"), "to_json": frame.to_json()})

    return inner


@pytest.mark.parametrize(
    "input",
    [
        {"filename": 1},
        {"filename": "foo", "abs_path": 1},
        {"function": 1},
        {"module": 1},
        {"function": "?"},
    ],
)
def test_bad_input(make_frames_snapshot, input):
    make_frames_snapshot(input)


@pytest.mark.parametrize(
    "x", [float("inf"), float("-inf"), float("nan")], ids=["inf", "neginf", "nan"]
)
def test_context_with_nan(make_frames_snapshot, x):
    make_frames_snapshot({"filename": "x", "vars": {"x": x}})


def test_address_normalization(make_frames_snapshot):
    make_frames_snapshot(
        {
            "lineno": 1,
            "filename": "blah.c",
            "function": "main",
            "instruction_addr": 123456,
            "symbol_addr": "123450",
            "image_addr": "0x0",
        }
    )
