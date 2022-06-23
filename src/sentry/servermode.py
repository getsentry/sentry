from __future__ import annotations

import abc
import itertools
from enum import Enum
from typing import Any, Callable, Iterable

from django.conf import settings


class ServerComponentMode(Enum):
    """Defines the component mode of the application to be acting as."""

    MONOLITH = "MONOLITH"
    CONTROL = "CONTROL"
    CUSTOMER = "CUSTOMER"
    FRONTEND = "FRONTEND"

    @classmethod
    def resolve(cls, mode: str | ServerComponentMode | None) -> ServerComponentMode:
        if not mode:
            return cls.MONOLITH
        if isinstance(mode, ServerComponentMode):
            return mode

        try:
            obj = getattr(cls, mode)
            if isinstance(obj, cls):
                return obj
        except AttributeError:
            pass

        raise ValueError(f"Not a {cls.__name__} name: {mode!r}")

    def __str__(self) -> str:
        return self.value

    @classmethod
    def get_current_mode(cls) -> ServerComponentMode:
        return cls.resolve(settings.SERVER_COMPONENT_MODE)


class ModeLimited(abc.ABC):
    """Decorator for classes or methods that are limited to certain modes."""

    def __init__(self, *modes: ServerComponentMode) -> None:
        self.modes = frozenset(modes)

    @abc.abstractmethod
    def __call__(self, decorated_object: Any) -> Any:
        """Modify the decorated object with appropriate overrides."""
        raise NotImplementedError

    @abc.abstractmethod
    def handle_when_unavailable(
        self,
        original_method: Callable[..., Any],
        current_mode: ServerComponentMode,
        available_modes: Iterable[ServerComponentMode],
    ) -> Callable[..., Any]:
        """Handle an attempt to access an unavailable element.

        Return a callback that accepts the same varargs as the original call to
        the method. (We jump through this extra hoop so that the handler can
        access both that and the arguments to this method.)
        """
        raise NotImplementedError

    def create_override(
        self,
        original_method: Callable[..., Any],
        extra_modes: Iterable[ServerComponentMode] = (),
    ) -> Callable[..., Any]:
        """Create a method that conditionally overrides another method.

        The returned method passes through to the original only if this server
        component is in one of the allowed modes.

        :param original_method: the method being conditionally overridden
        :param fail_callback: function to call and return if not in an allowed
            mode; if None, raise ServerComponentAvailabilityError instead
        :param extra_modes: modes to allow in addition to self.modes
        :return: the conditional method object
        """

        available_modes = frozenset(
            itertools.chain([ServerComponentMode.MONOLITH], self.modes, extra_modes)
        )

        def override(*args: Any, **kwargs: Any) -> Any:
            # It's important to do this check inside the override, so that tests
            # using `override_settings` or a similar context can change the value of
            # settings.SERVER_COMPONENT_MODE effectively. Otherwise, availability
            # would be immutably determined when the decorator is first evaluated.
            current_mode = ServerComponentMode.get_current_mode()
            is_available = current_mode in available_modes

            if is_available:
                return original_method(*args, **kwargs)
            else:
                handler = self.handle_when_unavailable(
                    original_method, current_mode, available_modes
                )
                return handler(*args, **kwargs)

        override.__name__ = original_method.__name__
        override.__doc__ = original_method.__doc__
        return override
