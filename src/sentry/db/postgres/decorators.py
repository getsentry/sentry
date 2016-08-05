from __future__ import absolute_import

import six
import sys

from functools import wraps

from .exceptions import TransactionAborted
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


def capture_transaction_exceptions(func):
    """
    Catches database errors and reraises them on subsequent errors that throw
    some cruft about transaction aborted.
    """
    def raise_the_exception(conn, exc):
        if 'current transaction is aborted, commands ignored until end of transaction block' in six.text_type(exc):
            exc_info = getattr(conn, '_last_exception', None)
            if exc_info is None:
                raise
            new_exc = TransactionAborted(sys.exc_info(), exc_info)
            six.reraise(new_exc.__class__, new_exc, exc_info[2])

        conn._last_exception = sys.exc_info()
        raise

    @wraps(func)
    def inner(self, *args, **kwargs):
        try:
            return func(self, *args, **kwargs)
        except Exception as e:
            raise_the_exception(self.db, e)

    return inner


def less_shitty_error_messages(func):
    """
    Wraps functions where the first param is a SQL statement and enforces
    any exceptions thrown will also contain the statement in the message.
    """
    @wraps(func)
    def inner(self, sql, *args, **kwargs):
        try:
            return func(self, sql, *args, **kwargs)
        except Exception as e:
            exc_info = sys.exc_info()
            msg = '{}\nSQL: {}'.format(
                getattr(e, 'message', getattr(e, 'args', [None])[0]),
                sql,
            )
            six.reraise(exc_info[0], exc_info[0](msg), exc_info[2])
    return inner
