from __future__ import annotations

from typing import TYPE_CHECKING, Any, Self

if TYPE_CHECKING:
    from sentry.grouping.strategies.base import StrategyConfiguration
    from sentry.services.eventstore.models import Event


class GroupingContext:
    """
    A key-value store used for passing state between strategy functions and other helpers used
    during grouping.

    Has a dictionary-like interface, along with a context manager which allows values to be
    temporarily overwritten:

        context = GroupingContext(...)
        context["some_key"] = "original_value"

        value_at_some_key = context["some_key"] # will be "original_value"
        value_at_some_key = context.get("some_key") # will be "original_value"

        value_at_another_key = context["another_key"] # will raise a KeyError
        value_at_another_key = context.get("another_key") # will be None
        value_at_another_key = context.get("another_key", "some_default") # will be "some_default"

        with context:
            context["some_key"] = "some_other_value"
            value_at_some_key = context["some_key"] # will be "some_other_value"

        value_at_some_key = context["some_key"] # will be "original_value"
    """

    def __init__(self, strategy_config: StrategyConfiguration, event: Event):
        # The initial context is essentially the grouping config options
        self._stack = [strategy_config.initial_context]
        self.config = strategy_config
        self.event = event
        self._push_context_layer()

    def __setitem__(self, key: str, value: Any) -> None:
        # Add the key-value pair to the context layer at the top of the stack
        self._stack[-1][key] = value

    def __getitem__(self, key: str) -> Any:
        # Walk down the stack from the top and return the first instance of `key` found
        for d in reversed(self._stack):
            if key in d:
                return d[key]
        raise KeyError(key)

    def get(self, key: str, default: Any = None) -> Any | None:
        try:
            return self[key]
        except KeyError:
            return default

    def __enter__(self) -> Self:
        self._push_context_layer()
        return self

    def __exit__(self, exc_type: type[Exception], exc_value: Exception, tb: Any) -> None:
        self._pop_context_layer()

    def _push_context_layer(self) -> None:
        self._stack.append({})

    def _pop_context_layer(self) -> None:
        self._stack.pop()
