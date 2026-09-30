from __future__ import annotations

from collections.abc import Callable
from enum import StrEnum
from typing import TYPE_CHECKING

from sentry.utils.registry import AlreadyRegisteredError, NoRegistrationExistsError
from sentry.workflow_engine.handlers.detector_output.base import DetectorOutcomeHandler

if TYPE_CHECKING:
    from sentry.workflow_engine.models import Detector
    from sentry.workflow_engine.processors import DetectorEvaluation


type DetectorOutcomeCallback = Callable[[Detector, DetectorEvaluation], None]


class DetectorOutcome(StrEnum):
    ISSUE_PLATFORM = "issue_platform"

    @property
    def handler(self) -> DetectorOutcomeCallback:
        return detector_outcome.get(self).handler


class DetectorOutcomeRegistry:
    def __init__(self) -> None:
        self.registrations: dict[DetectorOutcome, DetectorOutcomeHandler] = {}

    def add[T: DetectorOutcomeHandler](
        self, outcome: DetectorOutcome
    ) -> Callable[[type[T]], type[T]]:
        def register(handler: type[T]) -> type[T]:
            if outcome in self.registrations:
                raise AlreadyRegisteredError(
                    f"A detector outcome handler is already registered for {outcome}"
                )

            self.registrations[outcome] = handler()
            return handler

        return register

    def get(self, outcome: DetectorOutcome) -> DetectorOutcomeHandler:
        try:
            return self.registrations[outcome]
        except KeyError:
            raise NoRegistrationExistsError(
                f"No detector outcome handler is registered for {outcome}"
            ) from None


detector_outcome = DetectorOutcomeRegistry()
