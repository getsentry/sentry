import psycopg2
import psycopg2.errors
from django.db.utils import DatabaseError, InterfaceError, OperationalError


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


def is_statement_timeout(exc):
    """
    Check if an exception is due to a PostgreSQL statement timeout.
    
    PostgreSQL can report statement timeouts in different ways:
    1. With pgcode 57014 (QueryCanceled) and message "canceling statement due to statement timeout"
    2. With pgcode 57014 (QueryCanceled) and message "canceling statement due to user request" 
       (this can be ambiguous - could be statement_timeout or explicit cancellation)
    
    Args:
        exc: The exception to check
        
    Returns:
        True if the exception is definitely or likely a statement timeout
    """
    if not isinstance(exc, (OperationalError, psycopg2.OperationalError)):
        return False
    
    exc_msg = str(exc)
    
    # Definite statement timeout
    if "canceling statement due to statement timeout" in exc_msg:
        return True
    
    # Check if it's a QueryCanceled error with "user request" message
    # This could be either statement_timeout or explicit cancellation
    # We treat it as a potential timeout for better error handling
    if isinstance(exc.__cause__, psycopg2.errors.QueryCanceled):
        if "canceling statement due to user request" in exc_msg:
            # This is likely a statement_timeout in most cases
            # Explicit query cancellations are rare in production
            return True
    
    return False
