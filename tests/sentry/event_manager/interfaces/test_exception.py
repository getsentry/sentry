# -*- coding: utf-8 -*-

from __future__ import absolute_import

import pytest

from sentry import eventstore
from sentry.interfaces.exception import Exception
from sentry.stacktraces.processing import normalize_stacktraces_for_grouping
from sentry.event_manager import EventManager


@pytest.fixture
def make_exception_snapshot(insta_snapshot):
    def inner(data):
        mgr = EventManager(data={"exception": data})
        mgr.normalize()
        evt = eventstore.create_event(data=mgr.get_data())

        interface = evt.interfaces.get("exception")

        insta_snapshot(
            {
                "errors": evt.data.get("errors"),
                "to_json": interface and interface.to_json(),
                "get_api_context": interface and interface.get_api_context(),
                "to_string": interface and interface.to_string(evt),
            }
        )

    return inner


def test_basic(make_exception_snapshot):
    make_exception_snapshot(
        dict(
            values=[
                {
                    "type": "ValueError",
                    "value": "hello world",
                    "module": "foo.bar",
                    "stacktrace": {
                        "frames": [{"filename": "foo/baz.py", "lineno": 1, "in_app": True}]
                    },
                },
                {
                    "type": "ValueError",
                    "value": "hello world",
                    "module": "foo.bar",
                    "stacktrace": {
                        "frames": [{"filename": "foo/baz.py", "lineno": 1, "in_app": True}]
                    },
                },
            ]
        )
    )


def test_args_as_keyword_args(make_exception_snapshot):
    make_exception_snapshot(
        dict(values=[{"type": "ValueError", "value": "hello world", "module": "foo.bar"}])
    )


def test_args_as_old_style(make_exception_snapshot):
    make_exception_snapshot({"type": "ValueError", "value": "hello world", "module": "foo.bar"})


def test_non_string_value_with_no_type(make_exception_snapshot):
    make_exception_snapshot({"value": {"foo": "bar"}})


def test_context_with_mixed_frames(make_exception_snapshot):
    make_exception_snapshot(
        dict(
            values=[
                {
                    "type": "ValueError",
                    "value": "hello world",
                    "module": "foo.bar",
                    "stacktrace": {
                        "frames": [{"filename": "foo/baz.py", "lineno": 1, "in_app": True}]
                    },
                },
                {
                    "type": "ValueError",
                    "value": "hello world",
                    "module": "foo.bar",
                    "stacktrace": {
                        "frames": [{"filename": "foo/baz.py", "lineno": 1, "in_app": False}]
                    },
                },
            ]
        )
    )


def test_context_with_symbols(make_exception_snapshot):
    make_exception_snapshot(
        dict(
            values=[
                {
                    "type": "ValueError",
                    "value": "hello world",
                    "module": "foo.bar",
                    "stacktrace": {
                        "frames": [
                            {
                                "filename": "foo/baz.py",
                                "function": "myfunc",
                                "symbol": "Class.myfunc",
                                "lineno": 1,
                                "in_app": True,
                            }
                        ]
                    },
                }
            ]
        )
    )


def test_context_with_only_system_frames(make_exception_snapshot):
    make_exception_snapshot(
        dict(
            values=[
                {
                    "type": "ValueError",
                    "value": "hello world",
                    "module": "foo.bar",
                    "stacktrace": {
                        "frames": [{"filename": "foo/baz.py", "lineno": 1, "in_app": False}]
                    },
                },
                {
                    "type": "ValueError",
                    "value": "hello world",
                    "module": "foo.bar",
                    "stacktrace": {
                        "frames": [{"filename": "foo/baz.py", "lineno": 1, "in_app": False}]
                    },
                },
            ]
        )
    )


def test_context_with_only_app_frames(make_exception_snapshot):
    values = [
        {
            "type": "ValueError",
            "value": "hello world",
            "module": "foo.bar",
            "stacktrace": {"frames": [{"filename": "foo/baz.py", "lineno": 1, "in_app": True}]},
        },
        {
            "type": "ValueError",
            "value": "hello world",
            "module": "foo.bar",
            "stacktrace": {"frames": [{"filename": "foo/baz.py", "lineno": 1, "in_app": True}]},
        },
    ]
    exc = dict(values=values)
    normalize_stacktraces_for_grouping({"exception": exc})
    make_exception_snapshot(exc)


def test_context_with_raw_stacks(make_exception_snapshot):
    make_exception_snapshot(
        dict(
            values=[
                {
                    "type": "ValueError",
                    "value": "hello world",
                    "module": "foobar",
                    "raw_stacktrace": {
                        "frames": [
                            {
                                "filename": None,
                                "lineno": 1,
                                "function": "<redacted>",
                                "in_app": True,
                            }
                        ]
                    },
                    "stacktrace": {
                        "frames": [
                            {
                                "filename": "foo/baz.c",
                                "lineno": 1,
                                "function": "main",
                                "in_app": True,
                            }
                        ]
                    },
                }
            ]
        )
    )


def test_context_with_mechanism(make_exception_snapshot):
    make_exception_snapshot(
        dict(
            values=[
                {
                    "type": "ValueError",
                    "value": "hello world",
                    "module": "foo.bar",
                    "stacktrace": {
                        "frames": [{"filename": "foo/baz.py", "lineno": 1, "in_app": True}]
                    },
                    "mechanism": {"type": "generic"},
                }
            ]
        )
    )


def test_iteration():
    inst = Exception.to_python({"values": [None, {"type": "ValueError"}, None]})

    assert len(inst) == 1
    assert inst[0].type == "ValueError"
    for exc in inst:
        assert exc.type == "ValueError"
