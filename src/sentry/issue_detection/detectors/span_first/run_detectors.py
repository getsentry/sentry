from __future__ import annotations

import logging
from collections import defaultdict
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
from sentry.issue_detection.performance_problem import PerformanceProblem, PerformanceProblemDict
from sentry.issue_detection.types import StandaloneSpan
from sentry.issues.grouptype import (
    PerformanceNPlusOneAPICallsGroupType,
    PerformanceNPlusOneGroupType,
)
from sentry.models.project import Project
from sentry.utils import metrics
from sentry.utils.rollout import SourceOfTruth
from sentry.utils.sdk import sdk_logger

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
    trace_id: str,
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
    diffs: dict[str, list[str]] = defaultdict(list)

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

        _collect_single_problem_diffs(control_problem, span_first_problem, diffs)

    return diffs


def _collect_single_problem_diffs(
    control_problem_dict: PerformanceProblemDict,
    span_first_problem_dict: PerformanceProblemDict,
    # A mapping of locations where data differs to fingerprints of the problems which differ in
    # those locations, to which any differences found will be added
    diffs: dict[str, list[str]],
) -> None:
    """
    Compare the data in the given problems, and return a list of spots in which the problems differ.
    """
    fingerprint = control_problem_dict["fingerprint"]

    if control_problem_dict["op"] != span_first_problem_dict["op"]:
        diffs["op"].append(fingerprint)

    if control_problem_dict["desc"] != span_first_problem_dict["desc"]:
        diffs["desc"].append(fingerprint)

    if control_problem_dict["type"] != span_first_problem_dict["type"]:
        diffs["type"].append(fingerprint)

    if not _are_equivalent_lists(
        control_problem_dict["parent_span_ids"], span_first_problem_dict["parent_span_ids"]
    ):
        diffs["parent_span_ids"].append(fingerprint)

    if not _are_equivalent_lists(
        control_problem_dict["cause_span_ids"], span_first_problem_dict["cause_span_ids"]
    ):
        diffs["cause_span_ids"].append(fingerprint)

    if not _are_equivalent_lists(
        control_problem_dict["offender_span_ids"], span_first_problem_dict["offender_span_ids"]
    ):
        diffs["offender_span_ids"].append(fingerprint)

    if not _are_equivalent_lists(
        [
            f"{e['name']}{e['value']}{e['important']}"
            for e in control_problem_dict["evidence_display"]
        ],
        [
            f"{e['name']}{e['value']}{e['important']}"
            for e in span_first_problem_dict["evidence_display"]
        ],
    ):
        diffs["evidence_display"].append(fingerprint)

    if (
        control_problem_dict["evidence_data"].keys()
        != span_first_problem_dict["evidence_data"].keys()
    ):
        non_shared_keys = set(control_problem_dict["evidence_data"].keys()).symmetric_difference(
            span_first_problem_dict["evidence_data"].keys()
        )
        diffs["evidence_data.non_shared_keys"].append(
            f"{fingerprint}: {', '.join(sorted(non_shared_keys))}"
        )

    for key, control_evidence_data_value in control_problem_dict["evidence_data"].items():
        if key not in span_first_problem_dict["evidence_data"]:
            continue
        if key in {"op", "parent_span_ids", "cause_span_ids", "offender_span_ids"}:
            # These values have already been checked at the top level of the problem
            continue

        span_first_value = span_first_problem_dict["evidence_data"][key]

        if key == "span_evidence_key_value":
            if not _are_equivalent_lists(
                [
                    f"{d['key']}{d['value']}{d.get('is_multi_value')}"
                    for d in control_evidence_data_value
                ],
                [f"{d['key']}{d['value']}{d.get('is_multi_value')}" for d in span_first_value],
            ):
                diffs[f"evidence_data.{key}"].append(fingerprint)
        elif isinstance(control_evidence_data_value, (int, float, str, NoneType)):
            if control_evidence_data_value != span_first_value:
                diffs[f"evidence_data.{key}"].append(fingerprint)
        elif isinstance(control_evidence_data_value, list):
            if not _are_equivalent_lists(control_evidence_data_value, span_first_value):
                diffs[f"evidence_data.{key}"].append(fingerprint)


def _are_equivalent_lists(list1: Sequence[Any], list2: Sequence[Any]) -> bool:
    """
    Given two lists, check for equality, ignoring list order.
    """
    return set(list1) == set(list2)


def _strip_unnecessary_problem_data(
    problem_dict: Any,  # Have to type as Any to be able to delete from it
    diffs: dict[str, list[str]],
) -> dict[str, Any]:
    """
    Before passing it to the logger, strip duplicate data out of the given problem dictionary.
    Mutates in place, but also returns the given dictionary for convenience.
    """
    fingerprint = problem_dict["fingerprint"]
    problem_type_id = problem_dict["type"]

    # We log the detector type separately, so no need to include it in every problem dict
    del problem_dict["type"]

    # The data in `evidence_display` is just a rejiggering of data included elsewhere, so unless we
    # have a mismatch there, we can remove it
    if "evidence_display" not in diffs or fingerprint not in diffs["evidence_display"]:
        del problem_dict["evidence_display"]

    evidence_data = problem_dict["evidence_data"]
    # Iterate over a separate copy of the keys so we can delete freely
    for evidence_data_key in set(evidence_data):
        # These values have already been serialized at the top level of the problem
        if evidence_data_key in {"op", "parent_span_ids", "cause_span_ids", "offender_span_ids"}:
            del evidence_data[evidence_data_key]

        # In most cases, `repeating_spans` and `repeating_spans_compact` contain essentially the
        # same data, so we don't need them both. Check if we're dealing with one of the exceptions
        # to that rule, but otherwise, delete the duplicate data unless there's a mismatch.
        elif evidence_data_key == "repeating_spans_compact":
            # In the N+1 API detector the values are totally different, so we want to keep them both
            if problem_type_id == PerformanceNPlusOneAPICallsGroupType.type_id:
                continue
            # The same goes for the N+1 query detector, but here there's a wrinkle: Both the N+1 and
            # MN+1 detectors create problems with the N+1 type, but only for the N+1 detector do we
            # want to keep both values. Fortunately, the N+1 detector uses a string for
            # `repeating_spans` while the MN+1 detector uses a list, so we can typecheck
            # `repeating_spans` to decide which of the two detectors created the current problem.
            if problem_type_id == PerformanceNPlusOneGroupType.type_id and isinstance(
                evidence_data["repeating_spans"],
                str,  # Must be N+1, not MN+1
            ):
                continue

            # For all other detector types, the data is duplicative, so only keep it if we've found
            # a mismatch
            if (
                "evidence_data.repeating_spans_compact" not in diffs
                or fingerprint not in diffs["evidence_data.repeating_spans_compact"]
            ):
                del evidence_data["repeating_spans_compact"]

    return problem_dict


def _log_mismatch(
    *,
    problem_type: str,
    control_problems: list[PerformanceProblemDict],
    span_first_problems: list[PerformanceProblemDict],
    shared_fingerprints: set[str],
    non_shared_fingerprints: set[str],
    # A mapping of locations where data differs to fingerprints of the problems which differ in
    # those locations
    diffs: dict[str, list[str]],
    # Trace, project, and org ids/slugs
    extra_metadata: dict[str, Any],
) -> None:
    # Remove duplicate data from each problem dict to make logs easier to parse
    stripped_control_problems = [
        _strip_unnecessary_problem_data(problem_dict, diffs) for problem_dict in control_problems
    ]
    stripped_span_first_problems = [
        _strip_unnecessary_problem_data(problem_dict, diffs) for problem_dict in span_first_problems
    ]

    data = {
        "problem_type": problem_type,
        "raw_data": {
            "control": (
                stripped_control_problems[0]
                if len(stripped_control_problems) == 1
                else stripped_control_problems
            ),
            "span_first": (
                stripped_span_first_problems[0]
                if len(stripped_span_first_problems) == 1
                else stripped_span_first_problems
            ),
        },
        **extra_metadata,
    }

    # If there are any problems unique to one set or another, record that
    if non_shared_fingerprints:
        data["non_shared_fingerprints"] = ", ".join(sorted(non_shared_fingerprints))

    # If there are any problems that appear in both the control set and the span-first set, record
    # where they differ
    if shared_fingerprints:
        data["diff_keys"] = ", ".join(sorted(diffs.keys()))

    # If either the control or span-first problem sets has multiple problems in it, record which of
    # those problems the mismatches apply to
    if len(control_problems) > 1 or len(span_first_problems) > 1:
        # Make our diff set more compact by stringifying each list of fingerprints
        data["diffs"] = {
            diff_key: ", ".join(sorted(fingerprints)) for diff_key, fingerprints in diffs.items()
        }

    sdk_logger.info(
        "span_first_detectors.problem_mismatch",
        # Record all of our data under a single key so it doesn't get mixed in with all of the
        # random metadata in the log display
        attributes={"data": data},
    )
