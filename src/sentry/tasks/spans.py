import logging
import random
from collections.abc import Mapping, Sequence
from typing import Any

import sentry_sdk
from sentry_kafka_schemas import get_codec
from sentry_kafka_schemas.codecs import Codec
from sentry_kafka_schemas.schema_types.snuba_spans_v1 import SpanEvent

from sentry.event_manager import (
    Job,
    _detect_performance_problems,
    _pull_out_data,
    _send_occurrence_to_platform,
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


def transform_spans_to_event_dict(spans):
    event = {"type": "transaction", "contexts": {}}
    deserialized_spans = []
    for span in spans:
        try:
            deserialized_span: SpanEvent = _deserialize_span(span)
        except Exception:
            logger.exception("Failed to process span payload")
            continue

        sentry_tags = deserialized_span.get("sentry_tags", {})

        if deserialized_span["is_segment"] is True:
            event["event_id"] = deserialized_span.get("event_id")
            event["transaction"] = sentry_tags.get("transaction")
            event["contexts"]["trace"] = {
                "trace_id": deserialized_span["trace_id"],
                "type": "trace",
                "op": sentry_tags.get("transaction.op"),
            }
            event["received"] = deserialized_span["received"]
            event["timestamp"] = (
                deserialized_span["start_timestamp_ms"] + deserialized_span["duration_ms"]
            ) / 1000

            if (profile_id := deserialized_span.get("profile_id")) is not None:
                event["contexts"]["profile"] = {"profile_id": profile_id, "type": "profile"}

        if (op := sentry_tags.get("op")) is not None:
            deserialized_span["op"] = op

        if (group := sentry_tags.get("group")) is not None:
            # TODO: Calculate span hash based on raw span description when available.
            deserialized_span["hash"] = group

        deserialized_span["start_timestamp"] = deserialized_span["start_timestamp_ms"] / 1000
        deserialized_span["timestamp"] = (
            deserialized_span["start_timestamp_ms"] + deserialized_span["duration_ms"]
        ) / 1000

        deserialized_spans.append(deserialized_span)

    # The performance detectors expect the span list to be ordered/flattened in the way they
    # are structured in the tree. This is an implicit assumption in the performance detectors.
    # Orderby timestamp should work for synchronously executed code.
    event["spans"] = sorted(deserialized_spans, key=lambda span: span["start_timestamp"])

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
    jobs: Sequence[Job] = [
        {
            "data": data,
            "project_id": project.id,
            "raw": False,
            "start_time": None,
        }
    ]

    _pull_out_data(jobs, projects)
    _detect_performance_problems(jobs, projects)

    for job in jobs:
        updated_problems = []
        performance_problems = job.pop("performance_problems")
        for performance_problem in performance_problems:
            performance_problem.type = PerformanceStreamedSpansGroupTypeExperimental
            updated_problems.append(performance_problem)

        job["performance_problems"] = updated_problems

    _send_occurrence_to_platform(jobs, projects)

    return jobs


@instrumented_task(
    name="sentry.tasks.spans.process_segment",
    queue="spans.process_segment",
    max_retries=0,
)
def process_segment(project_id, segment_id):
    mark_scope_as_unsafe()
    try:
        _process_segment(project_id, segment_id)
    except Exception as err:
        if random.random() < 0.05:
            sentry_sdk.capture_exception(err)
