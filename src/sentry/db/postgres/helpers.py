import psycopg2
from django.db import connections, router
from django.db.utils import DatabaseError, InterfaceError


def bulk_insert_on_conflict_do_nothing(Model, rows):
    """
    Bulk insert, ignoring conflicts. Does not trigger pre/post save signals.

    `rows` should be supplied as list of mappings, with collumn names as keys.
    """
    if not rows:
        return
    cols = rows[0].keys()
    with connections[router.db_for_write(Model)].cursor() as cursor:
        cursor.execute(
            f"""
            INSERT INTO {Model._meta.db_table}
                (','.join(cols))
            VALUES
                {','.join(['(%s, %s, %s, %s)'] * len(rows))}
            ON CONFLICT DO NOTHING;
            """,
            [row[col] for row in rows for col in cols],
        )


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
