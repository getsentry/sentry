from collections.abc import Callable
from functools import wraps
from typing import Any, Concatenate, ParamSpec, TypeVar, cast

from .helpers import can_reconnect

P = ParamSpec("P")
R = TypeVar("R")


def auto_reconnect_cursor(
    func: Callable[Concatenate[Any, P], R],
) -> Callable[Concatenate[Any, P], R]:
    """
    Attempt to safely reconnect when an error is hit that resembles the
    bouncer disconnecting the client due to a timeout/etc during a cursor
    execution.
    """

    @wraps(func)
    def inner(self: Any, *args: P.args, **kwargs: P.kwargs) -> R:
        try:
            return func(self, *args, **kwargs)
        except Exception as e:
            if not can_reconnect(e):
                raise

            self.db.close(reconnect=True)
            self.cursor = self.db._cursor()

            return func(self, *args, **kwargs)

    return cast("Callable[Concatenate[Any, P], R]", inner)


def auto_reconnect_connection(
    func: Callable[Concatenate[Any, P], R],
) -> Callable[Concatenate[Any, P], R]:
    """
    Attempt to safely reconnect when an error is hit that resembles the
    bouncer disconnecting the client due to a timeout/etc.
    """

    @wraps(func)
    def inner(self: Any, *args: P.args, **kwargs: P.kwargs) -> R:
        try:
            return func(self, *args, **kwargs)
        except Exception as e:
            if not can_reconnect(e):
                raise

            self.close(reconnect=True)

            return func(self, *args, **kwargs)

    return cast("Callable[Concatenate[Any, P], R]", inner)
