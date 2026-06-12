"""
Test utilities for constructing segment-shape (`StandaloneSpan`) span data, parallel to
`event_generators.py` which produces legacy transaction-event-shape data.

Use these when writing tests for the span-first detectors in
`sentry.issue_detection.detectors.span_first.*`.
"""

from __future__ import annotations

import os
from copy import deepcopy
from typing import Any

from sentry_conventions.attributes import ATTRIBUTE_NAMES

from sentry.issue_detection.types import Attribute, AttributeType, StandaloneSpan
from sentry.testutils.factories import get_fixture_path
from sentry.utils import json

DEFAULT_PROJECT_ID = 1121
DEFAULT_ORG_ID = 1231
DEFAULT_TRACE_ID = "636861726c6965616e646d6169736579"
DEFAULT_SEGMENT_SPAN_ID = "4d4149534559414e"
DEFAULT_CHILD_SPAN_ID = "5494c42514843444"

_FIXTURE_DIR = get_fixture_path("events", "span_first_issue_detection")
_FIXTURE_PATHS: dict[str, str] = {}
_SEGMENT_FIXTURES: dict[str, list[StandaloneSpan]] = {}


def load_fixture(fixture_name: str) -> list[StandaloneSpan]:
    """
    Load the given fixture. Assumes all fixtures are formatted as an array of spans with the segment
    span first.
    """
    # Populate the fixture path cache if that hasn't yet been done. (We walk the full fixture
    # directory but only store paths rather than full fixtures because tests are sharded and we
    # don't need every fixture in every shard. Actual fixture data is loaded as needed.)
    if not _FIXTURE_PATHS:
        for dirpath, _, filenames in os.walk(_FIXTURE_DIR):
            for filename in filenames:
                fixture_basename, extension = filename.split(".")

                if extension != "json":
                    continue

                _FIXTURE_PATHS[fixture_basename] = os.path.join(dirpath, filename)

    # Load the fixture itself if we haven't yet
    if not _SEGMENT_FIXTURES.get(fixture_name):
        with open(_FIXTURE_PATHS[fixture_name]) as f:
            _SEGMENT_FIXTURES[fixture_name] = json.load(f)

    # Create a copy to avoid the risk of tests altering the data and affecting other tests
    return deepcopy(_SEGMENT_FIXTURES[fixture_name])


def create_child_span(
    op: str,
    duration: float | int = 100,  # ms
    description: str = "SELECT count() FROM table WHERE id = %s",
    hash: str = "",
    data: dict[str, Any] | None = None,
    span_id: str = DEFAULT_CHILD_SPAN_ID,
    parent_span_id: str | None = DEFAULT_SEGMENT_SPAN_ID,
) -> StandaloneSpan:
    """
    Create a child `StandaloneSpan` with sensible test defaults.

    `data` keys are placed in `attributes` alongside the `sentry.*` keys, matching the way Relay
    flattens the legacy `data` dict into segment-shape `attributes`.
    """
    attributes: dict[str, Attribute | None] = {
        ATTRIBUTE_NAMES.SENTRY_OP: _convert_to_attribute(op),
        ATTRIBUTE_NAMES.SENTRY_DESCRIPTION: _convert_to_attribute(description),
        ATTRIBUTE_NAMES.SENTRY_GROUP: _convert_to_attribute(hash),
    }
    if data:
        for key, value in data.items():
            attributes[key] = _convert_to_attribute(value)

    return StandaloneSpan(
        {
            "span_id": span_id,
            "parent_span_id": parent_span_id,
            "trace_id": DEFAULT_TRACE_ID,
            "organization_id": DEFAULT_ORG_ID,
            "project_id": DEFAULT_PROJECT_ID,
            "start_timestamp": 0.0,
            "end_timestamp": duration / 1000.0,
            "received": 1.0,
            "retention_days": 90,
            "name": description,
            "status": "ok",
            "is_segment": False,
            "attributes": attributes,
        }
    )


def create_segment(
    child_spans: list[StandaloneSpan],
    transaction_name: str = "default-transaction",
    segment_span_id: str = DEFAULT_SEGMENT_SPAN_ID,
) -> list[StandaloneSpan]:
    """
    Build a segment root span for the given child spans and return the full segment - a list
    consisting of the segment root followed by the children
    """
    segment_span = StandaloneSpan(
        {
            "span_id": segment_span_id,
            "parent_span_id": None,
            "trace_id": DEFAULT_TRACE_ID,
            "organization_id": DEFAULT_ORG_ID,
            "project_id": DEFAULT_PROJECT_ID,
            "start_timestamp": 0.0,
            "end_timestamp": 1.0,
            "received": 1.0,
            "retention_days": 90,
            "name": transaction_name,
            "status": "ok",
            "is_segment": True,
            "attributes": {
                ATTRIBUTE_NAMES.SENTRY_SEGMENT_NAME: _convert_to_attribute(transaction_name),
                ATTRIBUTE_NAMES.SENTRY_OP: _convert_to_attribute("default"),
            },
        }
    )
    return [segment_span, *child_spans]


def _convert_to_attribute(value: Any) -> Attribute:
    """Wrap a raw value in an `Attribute`-type dictionary"""
    return {"type": _infer_attribute_type(value), "value": value}


def _infer_attribute_type(value: Any) -> AttributeType:
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int):
        return "integer"
    if isinstance(value, float):
        return "double"
    if isinstance(value, str):
        return "string"
    if isinstance(value, list):
        return "array"
    return "object"
