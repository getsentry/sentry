import os

from sentry.testutils.factories import get_fixture_path
from sentry.utils import json

from .span_builder import SpanBuilder

_fixture_path = get_fixture_path("events", "performance_problems")

EVENTS = {}
PROJECT_ID = 1

for filename in os.listdir(_fixture_path):
    if not filename.endswith(".json"):
        continue

    [event_name, _extension] = filename.split(".")

    with open(os.path.join(_fixture_path, filename)) as f:
        event = json.load(f)
        event["project"] = PROJECT_ID
        EVENTS[event_name] = event


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


def create_span(op, duration=100.0, desc="SELECT count() FROM table WHERE id = %s", hash=""):
    return modify_span_duration(
        SpanBuilder().with_op(op).with_description(desc).with_hash(hash).build(),
        duration,
    )


def create_event(spans, event_id="a" * 16):
    return {
        "event_id": event_id,
        "project": PROJECT_ID,
        "spans": spans,
        "sdk": {"name": "sentry.python"},
    }
