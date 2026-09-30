from __future__ import annotations

from enum import StrEnum
from typing import TYPE_CHECKING

from sentry.workflow_engine.handlers.detector_outcome.registry import DetectorOutcomeRegistry

if TYPE_CHECKING:
    from sentry.workflow_engine.models import Detector
    from sentry.workflow_engine.processors import DetectorEvaluation


class DetectorOutcome(StrEnum):
    """
    The DetectorOutcome enum is used to access the different handlers in this module.

    Usage:
    - When registering a new outcome; `@detector_outcome_registry.add(DetectorOutcome.ISSUE_PLATFORM)`
    - When adding an outcome to a DetectorHandler: `on_complete = DetectorOutcome.ISSUE_PLATFORM.dispatch`
    """

    ISSUE_PLATFORM = "issue_platform"

    def dispatch(self, detector: Detector, evaluation: DetectorEvaluation) -> None:
        detector_outcome_registry.get(self).handle(detector, evaluation)


detector_outcome_registry = DetectorOutcomeRegistry[DetectorOutcome]()
