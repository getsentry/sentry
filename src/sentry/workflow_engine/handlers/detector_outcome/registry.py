from __future__ import annotations

from collections.abc import Callable

from sentry.utils.registry import AlreadyRegisteredError, NoRegistrationExistsError
from sentry.workflow_engine.handlers.detector_outcome.base import DetectorOutcomeHandler


class DetectorOutcomeRegistry[OutcomeT]:
    def __init__(self) -> None:
        self.registrations: dict[OutcomeT, DetectorOutcomeHandler] = {}

    def add[T: DetectorOutcomeHandler](self, outcome: OutcomeT) -> Callable[[type[T]], type[T]]:
        def register(handler: type[T]) -> type[T]:
            if outcome in self.registrations:
                raise AlreadyRegisteredError(
                    f"A detector outcome handler is already registered for {outcome}"
                )

            self.registrations[outcome] = handler()
            return handler

        return register

    def get(self, outcome: OutcomeT) -> DetectorOutcomeHandler:
        try:
            return self.registrations[outcome]
        except KeyError:
            raise NoRegistrationExistsError(
                f"No detector outcome handler is registered for {outcome}"
            ) from None
