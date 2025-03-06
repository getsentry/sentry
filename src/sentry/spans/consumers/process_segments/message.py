import logging
import uuid
from collections.abc import Sequence, Set
from copy import deepcopy
from typing import Any, cast

from django.core.exceptions import ValidationError
from sentry_kafka_schemas.schema_types.buffered_segments_v1 import SegmentSpan

from sentry import options
from sentry.event_manager import (
    Job,
    ProjectsMapping,
    _calculate_span_grouping,
    _detect_performance_problems,
    _pull_out_data,
    _record_transaction_info,
)
from sentry.issues.grouptype import PerformanceStreamedSpansGroupTypeExperimental
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.models.environment import Environment
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.models.releaseenvironment import ReleaseEnvironment
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
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


def build_tree(spans) -> tuple[dict[str, Any], str | None]:
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


def flatten_tree(tree: dict[str, Any], root_span_id: str | None) -> list[SegmentSpan]:
    visited: Set[str] = set()
    flattened_spans: list[SegmentSpan] = []

    if root_span_id:
        dfs(visited, flattened_spans, tree, root_span_id)

    # Catch all for orphan spans
    remaining = sorted(tree.items(), key=lambda span: span[1]["start_timestamp"])
    for span_id, _ in remaining:
        if span_id not in visited:
            dfs(visited, flattened_spans, tree, span_id)

    return flattened_spans


def _update_occurrence_group_type(jobs: Sequence[Job], projects: ProjectsMapping) -> None:
    """
    Exclusive to the segments consumer: Updates group type and fingerprint of
    all performance problems so they don't double write occurrences as we test.
    """

    for job in jobs:
        updated_problems = []
        performance_problems = job.pop("performance_problems")
        for performance_problem in performance_problems:
            performance_problem.type = PerformanceStreamedSpansGroupTypeExperimental
            performance_problem.fingerprint = f"{performance_problem.fingerprint}-{PerformanceStreamedSpansGroupTypeExperimental.type_id}"
            updated_problems.append(performance_problem)

        job["performance_problems"] = updated_problems


def _find_segment_span(spans: list[SegmentSpan]) -> SegmentSpan | None:
    """
    Finds the segment in the span in the list that has ``is_segment`` set to
    ``True``.

    At most one span in the list can be marked as segment span. If more than one
    span is marked, the function does not have defined behavior.

    If there is no segment span, the function returns ``None``.
    """

    # Iterate backwards since we usually expect the segment span to be at the end.
    for span in reversed(spans):
        if span.get("is_segment"):
            return span

    return None


def _create_models(segment: SegmentSpan, project: Project) -> None:
    """
    Creates the Environment and Release models, along with the necessary
    relationships between them and the Project model.
    """

    # TODO: Read this from original data attributes.
    sentry_tags = segment.get("sentry_tags", {})
    environment_name = sentry_tags.get("environment")
    release_name = sentry_tags.get("release")
    dist_name = sentry_tags.get("dist")
    date = to_datetime(segment["end_timestamp_precise"])  # type: ignore[typeddict-item]

    environment = Environment.get_or_create(project=project, name=environment_name)

    try:
        release = Release.get_or_create(project=project, version=release_name, date_added=date)
    except ValidationError:
        logger.exception(
            "Failed creating Release due to ValidationError",
            extra={"project": project, "version": release_name},
        )
        return

    if dist_name:
        release.add_dist(dist_name)

    ReleaseEnvironment.get_or_create(
        project=project, release=release, environment=environment, datetime=date
    )

    ReleaseProjectEnvironment.get_or_create(
        project=project, release=release, environment=environment, datetime=date
    )


def transform_spans_to_event_dict(
    segment_span: SegmentSpan, spans: list[SegmentSpan]
) -> dict[str, Any]:
    event_spans: list[dict[str, Any]] = []

    sentry_tags = segment_span.get("sentry_tags", {})

    event: dict[str, Any] = {"type": "transaction", "contexts": {}, "level": "info"}
    event["event_id"] = segment_span.get("event_id")
    event["project_id"] = segment_span["project_id"]
    event["transaction"] = sentry_tags.get("transaction")
    event["release"] = sentry_tags.get("release")
    event["dist"] = sentry_tags.get("dist")
    event["environment"] = sentry_tags.get("environment")
    event["platform"] = sentry_tags.get("platform")
    event["tags"] = [["environment", sentry_tags.get("environment")]]

    event["contexts"]["trace"] = {
        "trace_id": segment_span["trace_id"],
        "type": "trace",
        "op": sentry_tags.get("transaction.op"),
        "span_id": segment_span["span_id"],
    }

    if (profile_id := segment_span.get("profile_id")) is not None:
        event["contexts"]["profile"] = {"profile_id": profile_id, "type": "profile"}

    for span in spans:
        event_span = cast(dict[str, Any], deepcopy(span))

        if (op := span.get("sentry_tags", {}).get("op")) is not None:
            event_span["op"] = op

        event_span["start_timestamp"] = span["start_timestamp_ms"] / 1000
        event_span["timestamp"] = (span["start_timestamp_ms"] + span["duration_ms"]) / 1000

        event_spans.append(event_span)

    # The performance detectors expect the span list to be ordered/flattened in the way they
    # are structured in the tree. This is an implicit assumption in the performance detectors.
    # So we build a tree and flatten it depth first.
    # TODO: See if we can update the detectors to work without this assumption so we can
    # just pass it a list of spans.
    tree, root_span_id = build_tree(event_spans)
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


def process_segment(spans: list[SegmentSpan]) -> list[SegmentSpan]:
    segment_span = _find_segment_span(spans)
    if segment_span is None:
        # TODO: Handle segments without a defined segment span once all
        # functions are refactored to a span interface.
        return spans

    with metrics.timer("tasks.spans.project.get_from_cache"):
        project = Project.objects.get_from_cache(id=segment_span["project_id"])

    # The original transaction pipeline ran the following operations in this
    # exact order, where only operations marked with X are relevant to the spans
    # consumer:
    #
    #  - [ ] _pull_out_data
    #  - [X] _get_or_create_release_many               ->  _create_models
    #  - [ ] _get_event_user_many
    #  - [ ] _derive_plugin_tags_many
    #  - [ ] _derive_interface_tags_many
    #  - [X] _calculate_span_grouping
    #  - [ ] _materialize_metadata_many
    #  - [X] _get_or_create_environment_many           ->  _create_models
    #  - [X] _get_or_create_release_associated_models  ->  _create_models
    #  - [X] _tsdb_record_all_metrics
    #  - [ ] _materialize_event_metrics
    #  - [ ] _nodestore_save_many
    #  - [ ] _eventstream_insert_many
    #  - [ ] _track_outcome_accepted_many
    #  - [X]  _detect_performance_problems
    #  - [X]  _send_occurrence_to_platform
    #  - [X] _record_transaction_info

    _create_models(segment_span, project)

    # XXX: Below are old-style functions imported from EventManager that rely on
    # the Event schema:

    event = transform_spans_to_event_dict(segment_span, spans)
    event_light = prepare_event_for_occurrence_consumer(event)
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
    _calculate_span_grouping(jobs, projects)

    if options.get("standalone-spans.detect-performance-problems.enable"):
        _detect_performance_problems(jobs, projects, is_standalone_spans=True)
        _update_occurrence_group_type(jobs, projects)  # NB: exclusive to spans consumer
        if options.get("standalone-spans.send-occurrence-to-platform.enable"):
            _send_occurrence_to_platform(jobs, projects)

    _record_transaction_info(jobs, projects)

    return spans
