from collections.abc import Callable, Iterable
from dataclasses import dataclass
from typing import ClassVar, NoReturn

from sentry.workflow_engine.types import ConditionError


def _find_error(
    items: list["TriggerResult"], predicate: Callable[["TriggerResult"], bool]
) -> ConditionError | None:
    """Helper to find an error from items matching the predicate."""
    return next((item.error for item in items if predicate(item)), None)


@dataclass(frozen=True)
class TriggerResult:
    """
    Represents the result of a trigger evaluation with taint tracking.

    The triggered field indicates whether the trigger condition was met.

    The error field contains error information if the evaluation was tainted.
    When error is not None, it indicates that the result may not be accurate due to
    errors encountered during evaluation. Note that there may have been additional
    errors beyond the one captured here - this field contains a representative error
    from the evaluation, not necessarily all errors that occurred.
    """

    triggered: bool
    error: ConditionError | None

    # Constant untainted TriggerResult values (initialized after class definition).
    # These represent clean success/failure with no errors.
    TRUE: ClassVar["TriggerResult"]
    FALSE: ClassVar["TriggerResult"]

    def is_tainted(self) -> bool:
        """
        Returns True if this result is less trustworthy due to an error during
        evaluation.
        """
        return self.error is not None

    def with_error(self, error: ConditionError) -> "TriggerResult":
        """
        Returns a new TriggerResult with the same triggered value but the given error.
        If the result is already tainted, the error is ignored.
        """
        if self.is_tainted():
            return self
        return TriggerResult(triggered=self.triggered, error=error)

    @staticmethod
    def choose_tainted(a: "TriggerResult", b: "TriggerResult") -> "TriggerResult":
        """
        Returns the first tainted TriggerResult, or `a` if neither is tainted.
        Useful for tracking whether any evaluation in a series was tainted.
        """
        if a.is_tainted():
            return a
        if b.is_tainted():
            return b
        return a

    @staticmethod
    def any(items: Iterable["TriggerResult"]) -> "TriggerResult":
        """
        Like `any()`, but for TriggerResult. If any inputs had errors that could
        impact the result, the result will contain an error from one of them.
        """
        items_list = list(items)
        result = any(item.triggered for item in items_list)

        if result:
            # Result is True. If we have any untainted True, the result is clean.
            # Only tainted if all Trues are tainted.
            if any(item.triggered and not item.is_tainted() for item in items_list):
                return TriggerResult(triggered=True, error=None)
            # All Trues are tainted
            return TriggerResult(
                triggered=True, error=_find_error(items_list, lambda x: x.triggered)
            )
        else:
            # Result is False. Any tainted item could have changed the result.
            return TriggerResult(
                triggered=False,
                error=_find_error(items_list, lambda x: x.is_tainted()),
            )

    @staticmethod
    def all(items: Iterable["TriggerResult"]) -> "TriggerResult":
        """
        Like `all()`, but for TriggerResult. If any inputs had errors that could
        impact the result, the result will contain an error from one of them.
        """
        items_list = list(items)
        result = all(item.triggered for item in items_list)

        if result:
            # Result is True. Any tainted item could have changed the result.
            return TriggerResult(
                triggered=True,
                error=_find_error(items_list, lambda x: x.is_tainted()),
            )
        else:
            # Result is False. If we have any untainted False, the result is clean.
            # Only tainted if all Falses are tainted.
            if any(not item.triggered and not item.is_tainted() for item in items_list):
                return TriggerResult(triggered=False, error=None)
            # All Falses are tainted
            return TriggerResult(
                triggered=False,
                error=_find_error(items_list, lambda x: not x.triggered),
            )

    @staticmethod
    def none(items: Iterable["TriggerResult"]) -> "TriggerResult":
        """
        Like `not any()`, but for TriggerResult. If any inputs had errors that could
        impact the result, the result will contain an error from one of them.
        """
        items_list = list(items)

        # No items is guaranteed True, no possible error.
        if not items_list:
            return TriggerResult(triggered=True, error=None)

        result = all(not item.triggered for item in items_list)

        if result:
            # Result is True (no conditions triggered)
            # Any tainted item could have changed the result
            return TriggerResult(
                triggered=True,
                error=_find_error(items_list, lambda x: x.is_tainted()),
            )
        else:
            # Result is False (at least one condition triggered)
            # If we have any untainted True, the result is clean
            if any(item.triggered and not item.is_tainted() for item in items_list):
                return TriggerResult(triggered=False, error=None)
            # All triggered items are tainted
            return TriggerResult(
                triggered=False,
                error=_find_error(items_list, lambda x: x.triggered),
            )

    def __or__(self, other: "TriggerResult") -> "TriggerResult":
        """
        OR operation, equivalent to TriggerResult.any([self, other]).
        """
        return TriggerResult.any([self, other])

    def __and__(self, other: "TriggerResult") -> "TriggerResult":
        """
        AND operation, equivalent to TriggerResult.all([self, other]).
        """
        return TriggerResult.all([self, other])

    def __bool__(self) -> NoReturn:
        raise AssertionError("TriggerResult cannot be used as a boolean")


# Constant untainted TriggerResult values for common cases.
# These are singleton instances representing clean success/failure with no errors.
TriggerResult.TRUE = TriggerResult(triggered=True, error=None)
TriggerResult.FALSE = TriggerResult(triggered=False, error=None)
