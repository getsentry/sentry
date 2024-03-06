import logging
import random
from collections.abc import Mapping, Sequence, Set
from copy import deepcopy
from typing import Any

import sentry_sdk
from celery.exceptions import SoftTimeLimitExceeded
from sentry_kafka_schemas import get_codec
from sentry_kafka_schemas.codecs import Codec
from sentry_kafka_schemas.schema_types.snuba_spans_v1 import SpanEvent

from sentry import options
from sentry.event_manager import (
    Job,
    ProjectsMapping,
    _calculate_span_grouping,
    _detect_performance_problems,
    _pull_out_data,
)
from sentry.issues.grouptype import PerformanceStreamedSpansGroupTypeExperimental
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
    stack = [span_id]

    while len(stack):
        span_id = stack.pop()

        span = deepcopy(tree[span_id])
        children = span.pop("children")

        if span_id not in visited:
            flattened_spans.append(span)
            tree.pop(span_id)
            visited.add(span_id)

        for child in sorted(children, key=lambda span: span["start_timestamp"], reverse=True):
            if child["span_id"] not in visited:
                stack.append(child["span_id"])


def flatten_tree(tree, root_span_id):
    visited: Set[str] = set()
    flattened_spans: list[Mapping[str, Any]] = []

    if root_span_id:
        dfs(visited, flattened_spans, tree, root_span_id)

    # Catch all for orphan spans
    remaining = sorted(tree.items(), key=lambda span: span[1]["start_timestamp"])
    for span_id, _ in remaining:
        if span_id not in visited:
            dfs(visited, flattened_spans, tree, span_id)

    return flattened_spans


def _update_occurrence_group_type(jobs: Sequence[Job], projects: ProjectsMapping) -> None:
    for job in jobs:
        updated_problems = []
        performance_problems = job.pop("performance_problems")
        for performance_problem in performance_problems:
            performance_problem.type = PerformanceStreamedSpansGroupTypeExperimental
            updated_problems.append(performance_problem)

        job["performance_problems"] = updated_problems


def transform_spans_to_event_dict(spans):
    event: dict[str, Any] = {"type": "transaction", "level": "info", "contexts": {}}
    deserialized_spans: list[dict[str, Any]] = []
    for span in spans:
        try:
            deserialized_span = dict(_deserialize_span(span))
        except Exception:
            logger.exception("Failed to process span payload")
            continue

        sentry_tags = deserialized_span.get("sentry_tags", {})

        if deserialized_span["is_segment"] is True:
            event["event_id"] = deserialized_span.get("event_id")
            event["project_id"] = deserialized_span["project_id"]
            event["transaction"] = sentry_tags.get("transaction")
            event["contexts"]["trace"] = {
                "trace_id": deserialized_span["trace_id"],
                "type": "trace",
                "op": sentry_tags.get("transaction.op"),
                "span_id": deserialized_span["span_id"],
            }
            event["received"] = deserialized_span["received"]
            event["timestamp"] = (
                deserialized_span["start_timestamp_ms"] + deserialized_span["duration_ms"]
            ) / 1000

            if (profile_id := deserialized_span.get("profile_id")) is not None:
                event["contexts"]["profile"] = {"profile_id": profile_id, "type": "profile"}

        if (op := sentry_tags.get("op")) is not None:
            deserialized_span["op"] = op

        deserialized_span["start_timestamp"] = deserialized_span["start_timestamp_ms"] / 1000
        deserialized_span["timestamp"] = (
            deserialized_span["start_timestamp_ms"] + deserialized_span["duration_ms"]
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


def _process_segment(spans: list[str | bytes]):
    with sentry_sdk.start_span(op="sentry.tasks.spans.transform_spans_to_event_dict"):
        event = transform_spans_to_event_dict(spans)

    project_id = event["project_id"]
    with metrics.timer("tasks.spans.project.get_from_cache"):
        project = Project.objects.get_from_cache(id=project_id)

    projects = {project.id: project}

    data = CanonicalKeyDict(event)
    jobs: Sequence[Job] = [
        {
            "data": data,
            "project_id": project.id,
            "raw": False,
            "start_time": None,
        }
    ]

    _pull_out_data(jobs, projects)
    _calculate_span_grouping(jobs, projects)
    _detect_performance_problems(jobs, projects)
    _update_occurrence_group_type(jobs, projects)

    return jobs


def _process_segments(keys):
    client = RedisSpansBuffer()
    segments = client.read_many_segments(keys)

    # TODO: check how long we think this is going to take
    try:
        for i, segment in enumerate(segments):
            _, spans = segment
            if len(spans) > 0:
                _process_segment(spans)

    except SoftTimeLimitExceeded as err:
        metrics.incr("performance_issue.standalone_spans.processing.error", len(segments) - i)
        sentry_sdk.capture_exception(err)

    client.expire_many_segments(keys)


@instrumented_task(
    name="sentry.tasks.spans.process_segments",
    queue="spans.process_segments",
    soft_time_limit=5,
    max_retries=0,
)
def process_segments(keys):
    mark_scope_as_unsafe()
    try:
        _process_segments(keys)
    except Exception as err:
        if random.random() < 0.05:
            sentry_sdk.capture_exception(err)


@instrumented_task(
    name="sentry.tasks.spans.run_performnance_issue_detection",
    queue="spans.run_performnance_issue_detection",
    max_retries=0,
)
def run_performnance_issue_detection() -> None:
    if not options.get("standalone-spans.performance-issue-detection.enable"):
        return

    client = RedisSpansBuffer()

    batch_size = options.get("standalone-spans.process-segments.batch-size")
    max_batches = options.get("standalone-spans.process-segments.max-batches")

    drain = options.get("standalone-spans.process-segments.drain.enable")

    for _ in range(max_batches):
        keys = client.get_segment_keys_and_prune(batch_size)
        if len(keys) == 0:
            break

        if drain:
            continue

        process_segments.delay(keys)
