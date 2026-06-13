from collections.abc import Sequence
from typing import Any

from sentry.issue_detection.performance_problem import PerformanceProblem
from sentry.issue_detection.types import StandaloneSpan


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
