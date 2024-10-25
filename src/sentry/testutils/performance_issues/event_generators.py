from __future__ import annotations

import os
from copy import deepcopy
from typing import Any

from sentry.testutils.factories import get_fixture_path
from sentry.utils import json

from .span_builder import SpanBuilder

_fixture_path = get_fixture_path("events", "performance_problems")

EVENTS = {}
PROJECT_ID = 1

for dirpath, dirnames, filenames in os.walk(_fixture_path):

    for filename in filenames:
        [name, extension] = filename.split(".")

        if not extension == "json":
            continue

        filepath = os.path.join(dirpath, filename)
        relative_path = os.path.relpath(filepath, _fixture_path)

        [full_event_name, _] = relative_path.split(".")

        with open(filepath) as f:
            event = json.load(f)
            event["project"] = PROJECT_ID

        EVENTS[full_event_name] = event


def get_event(event_name: str) -> dict[str, Any]:
    # Create copy to avoid the risk of tests altering the event and affecting
    # other tests.
    return deepcopy(EVENTS[event_name])


# Duration is in ms
def modify_span_duration(obj, duration):
    obj["start_timestamp"] = 0.0
    obj["timestamp"] = duration / 1000.0
    return obj


# Start is in ms
def modify_span_start(obj, start):
    duration = obj["timestamp"] - obj["start_timestamp"]
    obj["start_timestamp"] = start / 1000.0
    obj["timestamp"] = obj["start_timestamp"] + duration
    return obj


def create_span(
    op, duration=100.0, desc="SELECT count() FROM table WHERE id = %s", hash="", data=None
):
    return modify_span_duration(
        SpanBuilder().with_op(op).with_description(desc).with_hash(hash).with_data(data).build(),
        duration,
    )


def create_event(spans, event_id: str = "a" * 16) -> dict[str, Any]:
    return {
        "event_id": event_id,
        "project": PROJECT_ID,
        "spans": spans,
        "sdk": {"name": "sentry.python"},
    }
