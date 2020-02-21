# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.constants import MAX_CULPRIT_LENGTH
from sentry.event_manager import generate_culprit
from sentry.grouping.utils import hash_from_values


def test_with_exception_interface():
    data = {
        "exception": {
            "values": [
                {
                    "stacktrace": {
                        "frames": [
                            {"lineno": 1, "filename": "foo.py"},
                            {"lineno": 1, "filename": "bar.py", "in_app": True},
                        ]
                    }
                }
            ]
        },
        "stacktrace": {
            "frames": [
                {"lineno": 1, "filename": "NOTME.py"},
                {"lineno": 1, "filename": "PLZNOTME.py", "in_app": True},
            ]
        },
        "request": {"url": "http://example.com"},
    }
    assert generate_culprit(data) == "bar.py in ?"


def test_with_missing_exception_stacktrace():
    data = {
        "exception": {
            "values": [
                {"stacktrace": None},
                {"stacktrace": {"frames": None}},
                {"stacktrace": {"frames": [None]}},
            ]
        },
        "request": {"url": "http://example.com"},
    }
    assert generate_culprit(data) == "http://example.com"


def test_with_stacktrace_interface():
    data = {
        "stacktrace": {
            "frames": [
                {"lineno": 1, "filename": "NOTME.py"},
                {"lineno": 1, "filename": "PLZNOTME.py", "in_app": True},
            ]
        },
        "request": {"url": "http://example.com"},
    }
    assert generate_culprit(data) == "PLZNOTME.py in ?"


def test_with_missing_stacktrace_frames():
    data = {"stacktrace": {"frames": None}, "request": {"url": "http://example.com"}}
    assert generate_culprit(data) == "http://example.com"


def test_with_empty_stacktrace():
    data = {"stacktrace": None, "request": {"url": "http://example.com"}}
    assert generate_culprit(data) == "http://example.com"


def test_with_only_http_interface():
    data = {"request": {"url": "http://example.com"}}
    assert generate_culprit(data) == "http://example.com"

    data = {"request": {"url": None}}
    assert generate_culprit(data) == ""

    data = {"request": {}}
    assert generate_culprit(data) == ""

    data = {"request": None}
    assert generate_culprit(data) == ""


def test_empty_data():
    assert generate_culprit({}) == ""


def test_truncation():
    data = {
        "exception": {
            "values": [{"stacktrace": {"frames": [{"filename": "x" * (MAX_CULPRIT_LENGTH + 1)}]}}]
        }
    }
    assert len(generate_culprit(data)) == MAX_CULPRIT_LENGTH

    data = {"stacktrace": {"frames": [{"filename": "x" * (MAX_CULPRIT_LENGTH + 1)}]}}
    assert len(generate_culprit(data)) == MAX_CULPRIT_LENGTH

    data = {"request": {"url": "x" * (MAX_CULPRIT_LENGTH + 1)}}
    assert len(generate_culprit(data)) == MAX_CULPRIT_LENGTH


def test_hash_from_values():
    result = hash_from_values(["foo", "bar", u"foô"])
    assert result == "6d81588029ed4190110b2779ba952a00"
