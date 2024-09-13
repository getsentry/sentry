from __future__ import annotations

import abc
import contextlib
import functools
import itertools
import threading
import typing
from collections.abc import Callable, Generator, Iterable
from enum import Enum
from typing import Any

from sentry.utils.env import in_test_environment

if typing.TYPE_CHECKING:
    from sentry.types.region import Region


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
            return SiloMode.MONOLITH
        if isinstance(mode, SiloMode):
            return mode
        return cls[mode]

    def __str__(self) -> str:
        return str(self.value)

    def __lt__(self, other: object) -> bool:
        if not isinstance(other, SiloMode):
            return NotImplemented
        else:
            return self.value < other.value

    @classmethod
    def get_current_mode(cls) -> SiloMode:
        from django.conf import settings

        configured_mode = settings.SILO_MODE
        process_level_silo_mode = cls.resolve(configured_mode)
        return SingleProcessSiloModeState.get_mode() or process_level_silo_mode


class SingleProcessSiloModeState(threading.local):
    """
    Used by silo endpoint decorators and other contexts that help 'suggest' to
    acceptance testing and local single process silo testing which 'silo context' the
    process should be running in.

    All calls to this class's methods are no-ops in a production environment,
    but are monkey-patched in a test environment. See the function
        sentry.testutils.silo.monkey_patch_single_process_silo_mode_state
    for the test environment's method bodies.
    """

    @staticmethod
    @contextlib.contextmanager
    def enter(mode: SiloMode, region: Region | None = None) -> Generator[None]:
        """
        Prevents re-entrant cases unless the exit_single_process_silo_context is
        explicitly embedded, ensuring that this single process silo mode simulates
        the boundaries explicitly between what would be separate processes in
        deployment.
        """
        yield

    @staticmethod
    @contextlib.contextmanager
    def exit() -> Generator[None]:
        """
        Used by silo endpoint decorators and other contexts to signal that a
        potential inter process interaction is being simulated locally for acceptance
        tests that validate the behavior of multiple endpoints with process
        boundaries in play.  Call this inside of any RPC interaction to ensure that
        such acceptance tests can 'swap' the silo context on the fly.
        """
        yield

    @staticmethod
    def get_mode() -> SiloMode | None:
        return None

    @staticmethod
    def get_region() -> Region | None:
        return None


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

    def is_available(self) -> bool:
        current_mode = SiloMode.get_current_mode()
        return current_mode == SiloMode.MONOLITH or current_mode in self.modes

    def create_override(
        self,
        original_method: Callable[..., Any],
    ) -> Callable[..., Any]:
        """Create a method that conditionally overrides another method.

        The returned method passes through to the original only if this server
        is in one of the allowed silo modes.

        :param original_method: the method being conditionally overridden
        :return: the conditional method object
        """

        def override(*args: Any, **kwargs: Any) -> Any:
            # It's important to do this check inside the override, so that tests
            # using `override_settings` or a similar context can change the value of
            # settings.SILO_MODE effectively. Otherwise, availability would be
            # immutably determined when the decorator is first evaluated.
            is_available = self.is_available()

            if is_available:
                return original_method(*args, **kwargs)
            else:
                handler = self.handle_when_unavailable(
                    original_method,
                    SiloMode.get_current_mode(),
                    itertools.chain([SiloMode.MONOLITH], self.modes),
                )
                return handler(*args, **kwargs)

        functools.update_wrapper(override, original_method)
        return override


class FunctionSiloLimit(SiloLimit):
    """Decorator for functions that are scoped to a silo"""

    def handle_when_unavailable(
        self,
        original_method: Callable[..., Any],
        current_mode: SiloMode,
        available_modes: Iterable[SiloMode],
    ) -> Callable[..., Any]:
        if in_test_environment():
            mode_str = ", ".join(str(m) for m in available_modes)
            message = (
                f"Called {original_method.__name__} in "
                f"{current_mode} mode. This function is available only in: {mode_str}"
            )
            raise self.AvailabilityError(message)
        return original_method

    def __call__(self, decorated_obj: Any) -> Any:
        if not callable(decorated_obj):
            raise TypeError("`@FunctionSiloLimit` must decorate a function")
        return self.create_override(decorated_obj)


region_silo_function = FunctionSiloLimit(SiloMode.REGION)
control_silo_function = FunctionSiloLimit(SiloMode.CONTROL)
all_silo_function = FunctionSiloLimit(SiloMode.REGION, SiloMode.CONTROL)
