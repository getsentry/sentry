from __future__ import annotations

import logging
from functools import reduce
from typing import Any, Callable, MutableMapping, MutableSequence, Sequence

logger = logging.getLogger("sentry.utils.pipeline")


class Pipeline:
    """
    A Pipeline is a way to call an ordered list of Array operations to a list of objects.

    Usage:
    # Construct the pipeline with any number of pipeline steps.
    pipeline = Pipeline()
        .map(...)
        .filter(...)
        ...
        .apply(...)

    # Optionally add new steps.
    if _condition_:
        pipeline = pipeline.filter(...)

    # Invoke the pipeline.
    result = pipeline(objects)
    """

    def __init__(self) -> None:
        self.operations: MutableSequence[Callable[..., Any]] = []
        self.logs: MutableSequence[str] = []

    def __call__(self, sequence: Sequence[Any]) -> tuple[Any, Sequence[str]]:
        # Explicitly typing to satisfy mypy.
        func: Callable[[Any, Callable[[Any], Any]], Any] = lambda x, operation: operation(x)
        return reduce(func, self.operations, sequence), self.logs

    def _log(self, message: str) -> None:
        logger.debug(message)
        self.logs.append(message)

    def apply(self, function: Callable[[MutableMapping[Any, Any]], Any]) -> Pipeline:
        def operation(sequence: MutableMapping[Any, Any]) -> Any:
            result = function(sequence)
            self._log(f"{function!r} applied to {len(sequence)} items.")
            return result

        self.operations.append(operation)
        return self

    def filter(self, function: Callable[[Any], bool]) -> Pipeline:
        def operation(sequence: Sequence[Any]) -> Sequence[Any]:
            result = [s for s in sequence if function(s)]
            self._log(f"{function!r} filtered {len(sequence)} items to {len(result)}.")
            return result

        self.operations.append(operation)
        return self

    def map(self, function: Callable[[Sequence[Any]], Any]) -> Pipeline:
        def operation(sequence: Sequence[Any]) -> Sequence[Any]:
            result = [function(s) for s in sequence]
            self._log(f"{function!r} applied to {len(sequence)} items.")
            return result

        self.operations.append(operation)
        return self

    def reduce(
        self, function: Callable[[Any, Any], Any], initializer: Callable[[Sequence[Any]], Any]
    ) -> Pipeline:
        def operation(sequence: Sequence[Any]) -> Any:
            result = reduce(function, sequence, initializer(sequence))
            self._log(f"{function!r} reduced {len(sequence)} items to {len(result)}.")
            return result

        self.operations.append(operation)
        return self
