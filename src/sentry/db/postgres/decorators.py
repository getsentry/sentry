from __future__ import absolute_import

import six
import sys

from functools import wraps

from sentry.db.exceptions import DuplicateKeyError, TransactionAborted
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
        if 'current transaction is aborted, commands ignored until end of transaction block' in six.text_type(
            exc
        ):
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

    Additionally this replaces duplicate key errors (via IntegrityError) with
    DuplicateKeyError.
    """

    @wraps(func)
    def inner(self, sql, *args, **kwargs):
        try:
            return func(self, sql, *args, **kwargs)
        except Exception as e:
            exc_info = sys.exc_info()
            try:
                if is_duplicate_key_error(e):
                    six.reraise(DuplicateKeyError, DuplicateKeyError(
                        six.text_type(e)), exc_info[2])

                msg = u'{}\nSQL: {}'.format(
                    repr(e),
                    sql,
                )
                six.reraise(exc_info[0], exc_info[0](msg), exc_info[2])
            finally:
                del exc_info

    return inner


def is_duplicate_key_error(exc):
    # each backend uses its own database error classes, and this is far
    # simpler than type checking since they're all named the same
    if type(exc).__name__ != 'IntegrityError':
        return False

    msg = six.text_type(exc)

    # postgres
    if u'duplicate key value violates unique constraint' in msg:
        return True

    # mysql
    if u'Duplicate entry' in msg:
        return True

    # sqlite
    if u'UNIQUE constraint failed' in msg:
        return True

    return False
