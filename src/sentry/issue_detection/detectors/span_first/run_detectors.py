from __future__ import annotations

import logging
from collections.abc import Callable, Sequence
from types import NoneType
from typing import Any

from sentry.issue_detection.detectors.span_first.base import SpanFirstDetector
from sentry.issue_detection.detectors.span_first.slow_db_query_detector import (
    SpanFirstSlowDBQueryDetector,
)
from sentry.issue_detection.detectors.span_first.span_first_utils import (
    SpanFirstDetectorsRolloutController,
)
from sentry.issue_detection.performance_detection import get_detection_settings
from sentry.issue_detection.performance_problem import PerformanceProblem
from sentry.issue_detection.types import StandaloneSpan
from sentry.models.project import Project
from sentry.utils import metrics
from sentry.utils.rollout import SourceOfTruth

logger = logging.getLogger(__name__)

SpanFirstDetectorClass = type[SpanFirstDetector]

# Add new span-first detector types here to include them in the experiment
SPAN_FIRST_DETECTORS: list[SpanFirstDetectorClass] = [
    SpanFirstSlowDBQueryDetector,
]


# Bucket detectors by the slug of the grouptype they produce
SPAN_FIRST_DETECTORS_BY_GROUPTYPE: dict[str, list[SpanFirstDetectorClass]] = {}
for detector_class in SPAN_FIRST_DETECTORS:
    SPAN_FIRST_DETECTORS_BY_GROUPTYPE.setdefault(detector_class.grouptype.slug, []).append(
        detector_class
    )


def run_span_first_detectors(
    grouptypes: Sequence[str],
    segment_span: StandaloneSpan,
    spans: Sequence[StandaloneSpan],
    project: Project,
) -> dict[str, list[PerformanceProblem]]:
    """
    For each of grouptype slugs in `grouptypes`, run the corresponding span-first detectors, and
    return the resulting problems bucketed by slug. Detectors that share a grouptype (e.g. N+1 and
    MN+1, or SQL Injection and Query Injection) accumulate into the same bucket -- so callers should
    sample/gate by grouptype, not by detector class. Detectors that fail are logged and excluded
    from the result.

    The caller is responsible for deciding which grouptypes to evaluate (typically via
    `SpanFirstDetectorsRolloutController.should_check_experiment`). This function does no sampling
    of its own.
    """
    detection_settings = get_detection_settings(project)
    span_first_problems: dict[str, list[PerformanceProblem]] = {}

    for grouptype in grouptypes:
        detector_classes = SPAN_FIRST_DETECTORS_BY_GROUPTYPE.get(grouptype, [])

        for detector_class in detector_classes:
            try:
                detector_settings = detection_settings[detector_class.type]
                problems = run_detector(detector_class, detector_settings, segment_span, spans)
            except Exception:
                logger.exception(
                    "span_first_detectors.detector_run_failed",
                    extra={"detector": detector_class.__name__},
                )
            else:
                span_first_problems.setdefault(grouptype, []).extend(problems)

    return span_first_problems


def run_detector(
    detector_class: type[Any],
    settings: dict[str, Any],
    segment_span: StandaloneSpan,
    segment: Sequence[StandaloneSpan],
) -> list[PerformanceProblem]:
    """
    Span-first analogue of `sentry.issue_detection.performance_detection.run_detector_on_data`.

    Instantiates the detector, walks the given spans through it, and returns the problems it
    produced. Returns an empty list if creation gating disallows it.
    """
    detector = detector_class(settings, segment_span, segment)

    if not detector.is_creation_allowed():
        return []

    for span in segment:
        detector.visit_span(span)
    detector.on_complete()

    return list(detector.stored_problems.values())


def compare_span_first_problems_to_control_data(
    project: Project,
    span_first_problems_by_grouptype: dict[str, list[PerformanceProblem]],
    all_control_problems: Sequence[PerformanceProblem],
    get_source_of_truth: Callable[[str], SourceOfTruth],
) -> None:
    """
    For each grouptype slug present in `span_first_problems_by_grouptype`, compare fingerprints
    against the matching subset of control-pipeline problems via the rollout controller's `compare`
    method. Emits a metric tagged with the grouptype slug, whether the results match, and which
    result is being used (if any). Also optionally logs mismatches, depending on controller options.

    `get_source_of_truth` is called per grouptype and should return whatever the caller intends to
    do with that grouptype's problems downstream -- e.g. "both" if the caller will emit both control
    and span-first occurrences, "control" if only control gets emitted, etc. The value is passed
    straight through to the comparator's metric/log tag.

    Grouptypes absent from the span-first problem dict (e.g. because the only detectors mapping to
    them were disabled or threw during `run_span_first_detectors`) are skipped.
    """
    # Bucket control problems by grouptype slug to match the format in which we have the span-first
    # problems
    control_problems_by_grouptype: dict[str, list[PerformanceProblem]] = {}
    for problem in all_control_problems:
        control_problems_by_grouptype.setdefault(problem.type.slug, []).append(problem)

    for grouptype, span_first_problems in span_first_problems_by_grouptype.items():
        control_problems = control_problems_by_grouptype.get(grouptype) or []

        # The vast majority of the time, a given detector isn't going to detect anything, and while
        # it's good to know that the new and legacy detectors agree on not having found anything,
        # those trivial cases can end up overwhelming the more interesting cases. Splitting them off
        # into their own metric lets us continue to track them (at the standard 10% sample rate)
        # while at the same time reducing the hits to the main comparison metric sufficiently that
        # we can afford to ramp its sample rate up to 100%.
        if not control_problems and not span_first_problems:
            metrics.incr(
                "span_first_detectors.empty_result_comparison_skipped", tags={"callsite": grouptype}
            )
            continue  # Skip running the comparison for this grouptype

        # What follows is a little bit of a hack. In the  rollout controller's `compare` method, the
        # `exact_match_comparator` parameter expects a function returning a boolean, and the
        # `debug_context` parameter expects a static value, which `compare` doesn't modify. Thus if
        # we want to include any differences we find as a result of the comparison in the debug
        # context, we have to do the real comparison here and pass a dummy comparator which just
        # returns the result we already found.
        debug_context = {
            "org_slug": project.organization.slug,
            "project_id": project.id,
            "project_slug": project.slug,
        }

        diffs = _compare_problem_sets(control_problems, span_first_problems)
        if diffs:
            debug_context["diffs"] = diffs
            comparator = lambda _, __: False
        else:
            comparator = lambda _, __: True

        SpanFirstDetectorsRolloutController.compare(
            callsite=grouptype,
            control_data=control_problems,
            experimental_data=span_first_problems,
            is_experimental_data_nullish=not bool(span_first_problems),
            source_of_truth=get_source_of_truth(grouptype),
            exact_match_comparator=comparator,
            debug_context=debug_context,
            data_serializer=lambda problems: [problem.to_dict() for problem in problems],
            metric_sample_rate=1.0,
        )


def _compare_problem_sets(
    control_problems: list[PerformanceProblem], span_first_problems: list[PerformanceProblem]
) -> dict[str, list[str]]:
    """
    Compare two lists of (hopefully matching) problems, and return a dictionary containing
    information about where, if anywhere, they differ.
    """

    control_problems_by_fingerprint = {problem.fingerprint: problem for problem in control_problems}
    span_first_problems_by_fingerprint = {
        problem.fingerprint: problem for problem in span_first_problems
    }

    overall_diffs = {}

    if control_problems_by_fingerprint.keys() != span_first_problems_by_fingerprint.keys():
        non_shared_fingerprints = sorted(
            set(control_problems_by_fingerprint.keys()).symmetric_difference(
                span_first_problems_by_fingerprint.keys()
            )
        )
        overall_diffs["non_shared_fingerprints"] = non_shared_fingerprints

    for fingerprint, control_problem in control_problems_by_fingerprint.items():
        span_first_problem = span_first_problems_by_fingerprint.get(fingerprint)

        if not span_first_problem:
            continue

        problem_diffs = _compare_problems(control_problem, span_first_problem)
        if problem_diffs:
            overall_diffs[fingerprint] = problem_diffs

    return overall_diffs


def _compare_problems(
    control_problem: PerformanceProblem, span_first_problem: PerformanceProblem
) -> list[str]:
    """
    Compare the data in the given problems, and return a list of spots in which the problems differ.
    """

    diffs = []

    if control_problem.op != span_first_problem.op:
        diffs.append("op")

    if control_problem.desc != span_first_problem.desc:
        diffs.append("desc")

    if control_problem.type.slug != span_first_problem.type.slug:
        diffs.append("type")

    if not _are_equivalent_lists(
        control_problem.parent_span_ids, span_first_problem.parent_span_ids
    ):
        diffs.append("parent_span_ids")

    if not _are_equivalent_lists(control_problem.cause_span_ids, span_first_problem.cause_span_ids):
        diffs.append("cause_span_ids")

    if not _are_equivalent_lists(
        control_problem.offender_span_ids, span_first_problem.offender_span_ids
    ):
        diffs.append("offender_span_ids")

    if not _are_equivalent_lists(
        [f"{e.name}{e.value}{e.important}" for e in control_problem.evidence_display],
        [f"{e.name}{e.value}{e.important}" for e in span_first_problem.evidence_display],
    ):
        diffs.append("evidence_display")

    if control_problem.evidence_data.keys() != span_first_problem.evidence_data.keys():
        non_shared_keys = sorted(
            set(control_problem.evidence_data.keys()).symmetric_difference(
                span_first_problem.evidence_data.keys()
            )
        )
        diffs.append(f"evidence_data.non_shared_keys: {', '.join(non_shared_keys)}")

    for key, control_value in control_problem.evidence_data.items():
        if key not in span_first_problem.evidence_data:
            continue
        if key in {"op", "parent_span_ids", "cause_span_ids", "offender_span_ids"}:
            # These values have already been checked at the top level of the problem
            continue

        span_first_value = span_first_problem.evidence_data[key]

        if key == "span_evidence_key_value":
            if not _are_equivalent_lists(
                [f"{d['key']}{d['value']}{d.get('is_multi_value')}" for d in control_value],
                [f"{d['key']}{d['value']}{d.get('is_multi_value')}" for d in span_first_value],
            ):
                diffs.append("evidence_data.span_evidence_key_value")
        elif isinstance(control_value, (int, float, str, NoneType)):
            if control_value != span_first_value:
                diffs.append(f"evidence_data.{key}")
        elif isinstance(control_value, list):
            if not _are_equivalent_lists(control_value, span_first_value):
                diffs.append(f"evidence_data.{key}")

    return diffs


def _are_equivalent_lists(list1: Sequence[Any], list2: Sequence[Any]) -> bool:
    """
    Given two lists, check for equality, ignoring list order.
    """
    return set(list1) == set(list2)
