from enum import StrEnum

from sentry.workflow_engine.handlers.detector_outcome.base import DetectorOutcomeCallback
from sentry.workflow_engine.handlers.detector_outcome.registry import DetectorOutcomeRegistry


class DetectorOutcome(StrEnum):
    ISSUE_PLATFORM = "issue_platform"

    @property
    def handler(self) -> DetectorOutcomeCallback:
        return detector_outcome_registry.get(self).handler


detector_outcome_registry = DetectorOutcomeRegistry[DetectorOutcome]()
