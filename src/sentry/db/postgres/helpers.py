from __future__ import absolute_import

import psycopg2
import six

from django.db.utils import DatabaseError, InterfaceError


def can_reconnect(exc):
    if isinstance(exc, (psycopg2.InterfaceError, InterfaceError)):
        return True
    # elif isinstance(exc, psycopg2.OperationalError):
    #     exc_msg = six.text_type(exc)
    #     if "can't fetch default_isolation_level" in exc_msg:
    #         return True
    #     elif "can't set datestyle to ISO" in exc_msg:
    #         return True
    #     return True
    elif isinstance(exc, DatabaseError):
        exc_msg = six.text_type(exc)
        if "server closed the connection unexpectedly" in exc_msg:
            return True
        elif "client_idle_timeout" in exc_msg:
            return True
    return False
