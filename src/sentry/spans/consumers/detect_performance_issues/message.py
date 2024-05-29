import logging
import uuid
from collections.abc import Mapping, Sequence, Set
from copy import deepcopy
from typing import Any

from sentry import options
from sentry.event_manager import (
    Job,
    ProjectsMapping,
    _calculate_span_grouping,
    _detect_performance_problems,
    _get_or_create_environment_many,
    _get_or_create_release_many,
    _pull_out_data,
)
from sentry.issues.grouptype import PerformanceStreamedSpansGroupTypeExperimental
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.models.project import Project
from sentry.utils import metrics
from sentry.utils.dates import to_datetime

logger = logging.getLogger(__name__)


@metrics.wraps("save_event.send_occurrence_to_platform")
def _send_occurrence_to_platform(jobs: Sequence[Job], projects: ProjectsMapping) -> None:
    for job in jobs:
        event = job["event"]
        project = event.project
        event_id = event.event_id

        performance_problems = job["performance_problems"]
        for problem in performance_problems:
            occurrence = IssueOccurrence(
                id=uuid.uuid4().hex,
                resource_id=None,
                project_id=project.id,
                event_id=event_id,
                fingerprint=[problem.fingerprint],
                type=problem.type,
                issue_title=problem.title,
                subtitle=problem.desc,
                culprit=event.transaction,
                evidence_data=problem.evidence_data,
                evidence_display=problem.evidence_display,
                detection_time=event.datetime,
                level=job["level"],
            )

            produce_occurrence_to_kafka(
                payload_type=PayloadType.OCCURRENCE,
                occurrence=occurrence,
                event_data=job["event_data"],
                is_buffered_spans=True,
            )


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
            performance_problem.fingerprint = f"{performance_problem.fingerprint}-{PerformanceStreamedSpansGroupTypeExperimental.type_id}"
            updated_problems.append(performance_problem)

        job["performance_problems"] = updated_problems


def transform_spans_to_event_dict(spans):
    processed_spans: list[dict[str, Any]] = []

    span = spans[0]
    sentry_tags = span.get("sentry_tags", {})

    event: dict[str, Any] = {"type": "transaction", "contexts": {}, "level": "info"}
    event["event_id"] = span.get("event_id")
    event["project_id"] = span["project_id"]
    event["transaction"] = sentry_tags.get("transaction")
    event["release"] = sentry_tags.get("release")
    event["environment"] = sentry_tags.get("environment")
    event["platform"] = sentry_tags.get("platform")
    event["tags"] = [["environment", sentry_tags.get("environment")]]

    event["contexts"]["trace"] = {
        "trace_id": span["trace_id"],
        "type": "trace",
        "op": sentry_tags.get("transaction.op"),
        "span_id": span["span_id"],
    }

    if (profile_id := span.get("profile_id")) is not None:
        event["contexts"]["profile"] = {"profile_id": profile_id, "type": "profile"}

    for span in spans:
        sentry_tags = span.get("sentry_tags", {})

        if (op := sentry_tags.get("op")) is not None:
            span["op"] = op

        span["start_timestamp"] = span["start_timestamp_ms"] / 1000
        span["timestamp"] = (span["start_timestamp_ms"] + span["duration_ms"]) / 1000

        processed_spans.append(span)

    # The performance detectors expect the span list to be ordered/flattened in the way they
    # are structured in the tree. This is an implicit assumption in the performance detectors.
    # So we build a tree and flatten it depth first.
    # TODO: See if we can update the detectors to work without this assumption so we can
    # just pass it a list of spans.
    tree, root_span_id = build_tree(processed_spans)
    flattened_spans = flatten_tree(tree, root_span_id)
    event["spans"] = flattened_spans

    root_span = flattened_spans[0]
    event["received"] = root_span["received"]
    event["timestamp"] = (root_span["start_timestamp_ms"] + root_span["duration_ms"]) / 1000
    event["start_timestamp"] = root_span["start_timestamp_ms"] / 1000
    event["datetime"] = to_datetime(event["timestamp"]).strftime("%Y-%m-%dT%H:%M:%SZ")

    return event


def prepare_event_for_occurrence_consumer(event):
    event_light = deepcopy(event)
    event_light["spans"] = []
    event_light["timestamp"] = event["datetime"]
    return event_light


def process_segment(spans: list[dict[str, Any]]):
    event = transform_spans_to_event_dict(spans)

    event_light = prepare_event_for_occurrence_consumer(event)

    project_id = event["project_id"]
    with metrics.timer("tasks.spans.project.get_from_cache"):
        project = Project.objects.get_from_cache(id=project_id)

    projects = {project.id: project}

    jobs: Sequence[Job] = [
        {
            "data": event,
            "project_id": project.id,
            "raw": False,
            "start_time": None,
            "event_data": event_light,
        }
    ]

    _pull_out_data(jobs, projects)
    _get_or_create_release_many(jobs, projects)
    # _get_event_user_many(jobs, projects)
    _get_or_create_environment_many(jobs, projects)
    _calculate_span_grouping(jobs, projects)
    _detect_performance_problems(jobs, projects, is_standalone_spans=True)
    # Updates group type and fingerprint of all performance problems
    # so they don't double write occurrences as we test.
    _update_occurrence_group_type(jobs, projects)

    if options.get("standalone-spans.send-occurrence-to-platform.enable"):
        _send_occurrence_to_platform(jobs, projects)

    return jobs
