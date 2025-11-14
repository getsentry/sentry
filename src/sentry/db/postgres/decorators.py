from typing import int
from functools import wraps

from .helpers import can_reconnect


def auto_reconnect_cursor(func):
    """
    Attempt to safely reconnect when an error is hit that resembles the
    bouncer disconnecting the client due to a timeout/etc during a cursor
    execution.
    """

    @wraps(func)
    def inner(self, *args, **kwargs):
        try:
            return func(self, *args, **kwargs)
        except Exception as e:
            if not can_reconnect(e):
                raise

            self.db.close(reconnect=True)
            self.cursor = self.db._cursor()

            return func(self, *args, **kwargs)

    return inner


def auto_reconnect_connection(func):
    """
    Attempt to safely reconnect when an error is hit that resembles the
    bouncer disconnecting the client due to a timeout/etc.
    """

    @wraps(func)
    def inner(self, *args, **kwargs):
        try:
            return func(self, *args, **kwargs)
        except Exception as e:
            if not can_reconnect(e):
                raise

            self.close(reconnect=True)

            return func(self, *args, **kwargs)

    return inner
