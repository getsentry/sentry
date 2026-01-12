import psycopg2
from django.db.utils import DatabaseError, InterfaceError, OperationalError


def can_reconnect(exc):
    # Check if it's an InterfaceError (either psycopg2 or Django)
    if isinstance(exc, (psycopg2.InterfaceError, InterfaceError)):
        return True
    
    # Check if it's an OperationalError (either psycopg2 or Django)
    if isinstance(exc, (psycopg2.OperationalError, OperationalError)):
        exc_msg = str(exc)
        # Common connection-related errors that should trigger reconnection
        reconnect_messages = [
            "connection already closed",
            "server closed the connection unexpectedly",
            "client_idle_timeout",
            "terminating connection",
            "connection to server",  # covers "connection to server was lost", etc.
            "could not connect to server",
            "connection timed out",
            "server closed the connection",
            "SSL connection has been closed unexpectedly",
            "no connection to the server",
            "can't fetch default_isolation_level",
            "can't set datestyle to ISO",
        ]
        if any(msg in exc_msg for msg in reconnect_messages):
            return True
        
        # If the message is empty or doesn't match, check the __cause__ 
        # (Django wraps psycopg2 exceptions, so we need to check the underlying cause)
        if hasattr(exc, "__cause__") and exc.__cause__:
            cause_msg = str(exc.__cause__)
            if any(msg in cause_msg for msg in reconnect_messages):
                return True
        
        return False
    
    # Fallback check for generic DatabaseError
    if isinstance(exc, DatabaseError):
        exc_msg = str(exc)
        if "server closed the connection unexpectedly" in exc_msg:
            return True
        elif "client_idle_timeout" in exc_msg:
            return True
        
        # Check __cause__ for DatabaseError as well
        if hasattr(exc, "__cause__") and exc.__cause__:
            cause_msg = str(exc.__cause__)
            if "server closed the connection unexpectedly" in cause_msg:
                return True
            elif "client_idle_timeout" in cause_msg:
                return True
    
    return False
