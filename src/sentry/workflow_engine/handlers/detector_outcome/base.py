from __future__ import annotations

import abc
from collections.abc import Callable
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sentry.workflow_engine.models import Detector
    from sentry.workflow_engine.processors import DetectorEvaluation

type DetectorOutcomeCallback = Callable[[Detector, DetectorEvaluation], None]


class DetectorOutcomeHandler(abc.ABC):
    @abc.abstractmethod
    def handler(self, detector: Detector, evaluation: DetectorEvaluation) -> None:
        pass
