import logging
from collections.abc import Mapping
from copy import deepcopy
from typing import Any

import sentry_sdk
from sentry_kafka_schemas import get_codec
from sentry_kafka_schemas.codecs import Codec
from sentry_kafka_schemas.schema_types.snuba_spans_v1 import SpanEvent

from sentry.event_manager import _detect_performance_problems
from sentry.models.project import Project
from sentry.spans.buffer.redis import RedisSpansBuffer
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics
from sentry.utils.canonical import CanonicalKeyDict
from sentry.utils.sdk import mark_scope_as_unsafe

SPAN_SCHEMA: Codec[SpanEvent] = get_codec("snuba-spans")

logger = logging.getLogger(__name__)


def _deserialize_span(value: bytes) -> Mapping[str, Any]:
    return SPAN_SCHEMA.decode(value)


def build_tree(spans):
    span_tree = {}
    root_span_id = None

    for span in spans:
        span_id = span["span_id"]
        is_root = span["is_segment"]
        if is_root:
            root_span_id = span_id
        if span_id not in span_tree:
            span_tree[span_id] = span
            span_tree[span_id]["children"] = []

    for span in span_tree.values():
        parent_id = span.get("parent_span_id")
        if parent_id is not None and parent_id in span_tree:
            parent_span = span_tree[parent_id]
            children = parent_span["children"]
            children.append(span)

    return span_tree, root_span_id


def dfs(visited, flattened_spans, tree, span_id):
    if span_id not in visited:
        span = deepcopy(tree[span_id])
        children = span.pop("children")

        visited.add(span_id)
        flattened_spans.append(span)

        for child in sorted(children, key=lambda span: span["start_timestamp"]):
            dfs(visited, flattened_spans, tree, child["span_id"])

        tree.pop(span_id)


def flatten_tree(tree, root_span_id):
    visited = set()
    flattened_spans = []
    if root_span_id:
        dfs(visited, flattened_spans, tree, root_span_id)

    # Catch all for orphan spans
    remaining = sorted(tree.items(), key=lambda span: span[1]["start_timestamp"])
    for span_id, _ in remaining:
        dfs(visited, flattened_spans, tree, span_id)

    return flattened_spans


def transform_spans_to_event_dict(spans):
    event = {"type": "transaction", "contexts": {}}
    deserialized_spans = []
    for span in spans:
        try:
            deserialized_span = _deserialize_span(span)
        except Exception:
            logger.exception("Failed to process span payload")
            continue

        sentry_tags = deserialized_span.get("sentry_tags", {})

        if deserialized_span["is_segment"] is True:
            event["event_id"] = deserialized_span.get("event_id")
            event["transaction"] = sentry_tags.get("transaction")
            event["contexts"]["trace"] = {
                "trace_id": deserialized_span.get("trace_id"),
                "type": "trace",
                "op": sentry_tags.get("transaction.op"),
            }

            if (profile_id := deserialized_span.get("profile_id")) is not None:
                event["contexts"]["profile"] = {"profile_id": profile_id, "type": "profile"}

        if (op := sentry_tags.get("op")) is not None:
            deserialized_span["op"] = op

        if (group := sentry_tags.get("group")) is not None:
            deserialized_span["hash"] = group

        deserialized_span["start_timestamp"] = deserialized_span.get("start_timestamp_ms") / 1000
        deserialized_span["timestamp"] = (
            deserialized_span.get("start_timestamp_ms", 0) + deserialized_span.get("duration_ms")
        ) / 1000

        deserialized_spans.append(deserialized_span)

    # The performance detectors expect the span list to be ordered/flattened in the way they
    # are structured in the tree. This is an implicit assumption in the performance detectors.
    # So we build a tree and flatten it depth first.
    # TODO: See if we can update the detectors to work without this assumption so we can
    # just pass it a list of spans.
    tree, root_span_id = build_tree(deserialized_spans)
    flattened_spans = flatten_tree(tree, root_span_id)

    event["spans"] = flattened_spans

    return event


def _process_segment(project_id, segment_id):
    client = RedisSpansBuffer()
    spans = client.read_segment(project_id, segment_id)

    with sentry_sdk.start_span(op="sentry.tasks.spans.transform_spans_to_event_dict"):
        event = transform_spans_to_event_dict(spans)

    with metrics.timer("tasks.spans.project.get_from_cache"):
        project = Project.objects.get_from_cache(id=project_id)

    projects = {project.id: project}

    data = CanonicalKeyDict(event)
    job: dict[str, Any] = {
        "data": data,
        "project_id": project.id,
        "raw": False,
        "start_time": None,  # TODO: figure out how to get start time
    }

    _detect_performance_problems([job], projects)

    return job


@instrumented_task(
    name="sentry.tasks.spans.process_segment",
    queue="spans.process_segment",
    max_retries=0,
)
def process_segment(project_id, segment_id):
    mark_scope_as_unsafe()
    _process_segment(project_id, segment_id)
