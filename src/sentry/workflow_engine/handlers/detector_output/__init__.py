from __future__ import annotations

from collections.abc import Callable
from enum import Enum
from typing import TYPE_CHECKING, cast

from sentry.workflow_engine.handlers.detector_output.base import DetectorOutcomeHandler
from sentry.workflow_engine.handlers.detector_output.issue_platform import (
    IssuePlatformOutcomeHandler,
)

if TYPE_CHECKING:
    from sentry.workflow_engine.models import Detector
    from sentry.workflow_engine.processors import DetectorEvaluation


class DetectorOutcome(Enum):
    ISSUE_PLATFORM = IssuePlatformOutcomeHandler()

    @property
    def handler(self) -> Callable[[Detector, DetectorEvaluation], None]:
        outcome_handler = cast(DetectorOutcomeHandler, self.value)
        return outcome_handler.handler


__all__ = ["DetectorOutcome", "DetectorOutcomeHandler"]
