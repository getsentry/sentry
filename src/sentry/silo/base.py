from __future__ import annotations

import abc
import functools
import itertools
from enum import Enum
from typing import Any, Callable, Iterable

from django.conf import settings


class SiloMode(Enum):
    """Defines which "silo" component the application is acting as.

    The default choice is "monolith", which assumes that the server is the only
    "silo" in its environment and allows access to all tables and endpoints.
    """

    MONOLITH = "MONOLITH"
    CONTROL = "CONTROL"
    REGION = "REGION"

    @classmethod
    def resolve(cls, mode: str | SiloMode | None) -> SiloMode:
        if not mode:
            return cls.MONOLITH
        if isinstance(mode, SiloMode):
            return mode
        return cls[mode]

    def __str__(self) -> str:
        return self.value

    @classmethod
    def get_current_mode(cls) -> SiloMode:
        return cls.resolve(settings.SILO_MODE)


class SiloLimit(abc.ABC):
    """Decorator for classes or methods that are limited to certain modes."""

    def __init__(self, *modes: SiloMode) -> None:
        self.modes = frozenset(modes)

    @abc.abstractmethod
    def __call__(self, decorated_object: Any) -> Any:
        """Modify the decorated object with appropriate overrides."""
        raise NotImplementedError

    class AvailabilityError(Exception):
        """Indicate that something in unavailable in the current silo mode."""

    @abc.abstractmethod
    def handle_when_unavailable(
        self,
        original_method: Callable[..., Any],
        current_mode: SiloMode,
        available_modes: Iterable[SiloMode],
    ) -> Callable[..., Any]:
        """Handle an attempt to access an unavailable element.

        Return a callback that accepts the same varargs as the original call to
        the method. (We jump through this extra hoop so that the handler can
        access both that and the arguments to this method.)
        """
        raise NotImplementedError

    def is_available(self, extra_modes: Iterable[SiloMode] = ()) -> bool:
        current_mode = SiloMode.get_current_mode()
        return (
            current_mode == SiloMode.MONOLITH
            or current_mode in self.modes
            or current_mode in extra_modes
        )

    def create_override(
        self,
        original_method: Callable[..., Any],
        extra_modes: Iterable[SiloMode] = (),
    ) -> Callable[..., Any]:
        """Create a method that conditionally overrides another method.

        The returned method passes through to the original only if this server
        is in one of the allowed silo modes.

        :param original_method: the method being conditionally overridden
        :param extra_modes: modes to allow in addition to self.modes
        :return: the conditional method object
        """

        def override(*args: Any, **kwargs: Any) -> Any:
            # It's important to do this check inside the override, so that tests
            # using `override_settings` or a similar context can change the value of
            # settings.SILO_MODE effectively. Otherwise, availability would be
            # immutably determined when the decorator is first evaluated.
            is_available = self.is_available(extra_modes)

            if is_available:
                return original_method(*args, **kwargs)
            else:
                handler = self.handle_when_unavailable(
                    original_method,
                    SiloMode.get_current_mode(),
                    itertools.chain([SiloMode.MONOLITH], self.modes, extra_modes),
                )
                return handler(*args, **kwargs)

        functools.update_wrapper(override, original_method)
        return override
