import logging
from functools import wraps

import psycopg2
from django.db import router, transaction
from django.db.utils import DatabaseError, InterfaceError, OperationalError, ProgrammingError


def handle_db_failure(func, model, wrap_in_transaction: bool = True):
    @wraps(func)
    def wrapped(*args, **kwargs):
        try:
            if wrap_in_transaction:
                with transaction.atomic(router.db_for_write(model)):
                    return func(*args, **kwargs)
            else:
                return func(*args, **kwargs)
        except (ProgrammingError, OperationalError):
            logging.exception("Failed processing signal %s", func.__name__)
            return

    return wrapped


def can_reconnect(exc):
    if isinstance(exc, (psycopg2.InterfaceError, InterfaceError)):
        return True
    # elif isinstance(exc, psycopg2.OperationalError):
    #     exc_msg = str(exc)
    #     if "can't fetch default_isolation_level" in exc_msg:
    #         return True
    #     elif "can't set datestyle to ISO" in exc_msg:
    #         return True
    #     return True
    elif isinstance(exc, DatabaseError):
        exc_msg = str(exc)
        if "server closed the connection unexpectedly" in exc_msg:
            return True
        elif "client_idle_timeout" in exc_msg:
            return True
    return False
