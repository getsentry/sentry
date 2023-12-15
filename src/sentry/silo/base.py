from __future__ import annotations

import abc
import contextlib
import functools
import itertools
import threading
import typing
from enum import Enum
from typing import Any, Callable, Generator, Iterable

import sentry_sdk
from django.conf import settings

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
    def resolve(cls, mode: str | SiloMode | None, default: SiloMode | None = None) -> SiloMode:
        if not mode:
            if not default:
                return SiloMode.MONOLITH
            return default
        if isinstance(mode, SiloMode):
            return mode
        return cls[mode]

    def __str__(self) -> str:
        return str(self.value)

    @classmethod
    def single_process_silo_mode(cls) -> bool:
        return bool(settings.SINGLE_SERVER_SILO_MODE)

    @classmethod
    @contextlib.contextmanager
    def enter_single_process_silo_context(
        cls, mode: SiloMode, region: Region | None = None
    ) -> Generator[None, None, None]:
        """
        Used by silo endpoint decorators and other contexts that help 'suggest' to acceptance testing and local
        single process silo testing which 'silo context' the process should be running in.  Prevents re-entrant
        cases unless the exit_single_process_silo_context is explicitly embedded, ensuring that this single process
        silo mode simulates the boundaries explicitly between what would be separate processes in deployment.
        """
        if in_test_environment():
            assert (
                single_process_silo_mode_state.mode is None
            ), "Re-entrant invariant broken! Use exit_single_process_silo_context to explicit pass 'fake' RPC boundaries."
        old_mode = single_process_silo_mode_state.mode
        old_region = single_process_silo_mode_state.region
        single_process_silo_mode_state.mode = mode
        single_process_silo_mode_state.region = region
        try:
            yield
        finally:
            single_process_silo_mode_state.mode = old_mode
            single_process_silo_mode_state.region = old_region

    @classmethod
    @contextlib.contextmanager
    def exit_single_process_silo_context(cls) -> Generator[None, None, None]:
        """
        Used by silo endpoint decorators and other contexts to signal that a potential inter process interaction
        is being simulated locally for acceptance tests that validate the behavior of multiple endpoints with
        process boundaries in play.  Call this inside of any RPC interaction to ensure that such acceptance tests
        can 'swap' the silo context on the fly.
        """
        old_mode = single_process_silo_mode_state.mode
        old_region = single_process_silo_mode_state.region
        single_process_silo_mode_state.mode = None
        single_process_silo_mode_state.region = None
        try:
            yield
        finally:
            single_process_silo_mode_state.mode = old_mode
            single_process_silo_mode_state.region = old_region

    @classmethod
    @contextlib.contextmanager
    def enter_virtual_single_process_silo_context(
        cls, mode: SiloMode
    ) -> Generator[None, None, None]:
        """
        Used in entry points such as tasks, endpoints, or views to established the assumed silo mode
        (or virtual silo mode) for the duration of the context. This is used to test expected silo modes of code paths,
        resources (e.g. database models), functions, etc. For any silo mode violations, we emit a Sentry error event.
        """
        original_virtual_mode = single_process_silo_mode_state.virtual_mode
        if original_virtual_mode is not None and original_virtual_mode != mode:
            # enter_virtual_single_process_silo_context should only be called once to set the virtual mode
            message = "Re-entrant on enter_virtual_single_process_silo_context with different mode"
            try:
                raise Exception(message)
            except Exception as e:
                sentry_sdk.capture_exception(e)

        if mode == SiloMode.MONOLITH:
            message = "Incorrect use of enter_virtual_single_process_silo_context"
            try:
                raise Exception(message)
            except Exception as e:
                sentry_sdk.capture_exception(e)

        single_process_silo_mode_state.virtual_mode = mode
        try:
            yield
        finally:
            single_process_silo_mode_state.virtual_mode = original_virtual_mode

    @classmethod
    def get_current_mode(cls) -> SiloMode:
        process_level_silo_mode = cls.resolve(settings.SILO_MODE)
        return cls.resolve(single_process_silo_mode_state.mode, process_level_silo_mode)

    @classmethod
    def get_virtual_mode(cls) -> SiloMode:
        virtual_mode = single_process_silo_mode_state.virtual_mode
        if virtual_mode is None:
            return SiloMode.MONOLITH
        return virtual_mode


class SingleProcessSiloModeState(threading.local):
    mode: SiloMode | None = None
    region: Region | None = None
    virtual_mode: SiloMode | None = None


single_process_silo_mode_state = SingleProcessSiloModeState()


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

    def check_virtual_silo_mode(self, original_method: Callable[..., Any]) -> None:
        virtual_mode = SiloMode.get_virtual_mode()
        if virtual_mode == SiloMode.MONOLITH:
            return
        if virtual_mode not in self.modes:
            message = f"{original_method.__name__} called in virtual silo mode: {virtual_mode}. Expected silo modes: {self.modes}"
            sentry_sdk.capture_exception(self.AvailabilityError(message))

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
            self.check_virtual_silo_mode(original_method)

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

    def create_override_with_virtual_mode(self, original_func: Callable[..., Any]) -> None:
        if len(self.modes) == 1:
            virtual_silo_mode = next(iter(self.modes))

            def wrapper(*args: Any, **kwargs: Any):
                with SiloMode.enter_virtual_single_process_silo_context(virtual_silo_mode):
                    return original_func(*args, **kwargs)

            functools.update_wrapper(wrapper, original_func)
            return wrapper
        return original_func
