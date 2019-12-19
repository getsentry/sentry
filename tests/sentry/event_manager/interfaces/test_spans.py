# -*- coding: utf-8 -*-

from __future__ import absolute_import

import pytest

from sentry import eventstore
from sentry.event_manager import EventManager

START_TIME = 1562873192.624
END_TIME = 1562873194.624


@pytest.fixture
def make_spans_snapshot(insta_snapshot):
    def inner(data):
        mgr = EventManager(data={"spans": data})
        mgr.normalize()
        evt = eventstore.create_event(data=mgr.get_data())

        interface = evt.interfaces.get("spans")

        insta_snapshot({"errors": evt.data.get("errors"), "to_json": interface.to_json()})

    return inner


def test_empty(make_spans_snapshot):
    make_spans_snapshot([])


def test_single_invalid(make_spans_snapshot):
    make_spans_snapshot(
        [
            {
                "trace_id": "bad",
                "span_id": "bad",
                "start_timestamp": START_TIME,
                "timestamp": END_TIME,
            }
        ]
    )


def test_single_incomplete(make_spans_snapshot):
    make_spans_snapshot(
        [
            {
                "trace_id": "a0fa8803753e40fd8124b21eeb2986b5",
                "span_id": "8c931f4740435fb8",
                "start_timestamp": START_TIME,
                "timestamp": END_TIME,
            }
        ]
    )


def test_single_full(make_spans_snapshot):
    make_spans_snapshot(
        [
            {
                "trace_id": "a0fa8803753e40fd8124b21eeb2986b5",
                "span_id": "8c931f4740435fb8",
                "start_timestamp": START_TIME,
                "timestamp": END_TIME,
                "op": "http",
                "description": "GET http://example.com",
                "data": {"status_code": 200, "reason": "OK"},
                "tags": {"service": "example", "sentry:user": "id:1"},
            }
        ]
    )


def test_multiple_full(make_spans_snapshot):
    make_spans_snapshot(
        [
            {
                "trace_id": "a0fa8803753e40fd8124b21eeb2986b5",
                "span_id": "8c931f4740435fb8",
                "start_timestamp": START_TIME,
                "timestamp": END_TIME,
                "op": "http",
                "description": "GET http://example.com",
                "data": {"status_code": 200, "reason": "OK"},
                "tags": {"service": "example", "sentry:user": "id:1"},
            },
            {
                "trace_id": "a0fa8803753e40fd8124b21eeb2986b5",
                "span_id": "6c931f4740666fb6",
                "start_timestamp": START_TIME,
                "timestamp": END_TIME,
                "op": "db",
                "description": "SELECT * FROM users",
                "tags": {"service": "example"},
            },
        ]
    )
