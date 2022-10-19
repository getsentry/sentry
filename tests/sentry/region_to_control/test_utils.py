import contextlib
from unittest.mock import patch

from sentry.testutils.silo import exempt_from_silo_limits

# TODO:  Can a service abstraction that allows default stubs + opt-out ability replace this?


@contextlib.contextmanager
def flush_audit_logs():
    """
    In region silo mode, audit logs are not saved to the database but written to an async kafka queue.
    Some tests are written with test expectations on the eventually stored audit log entries, however,
    so to make it easier to support these tests, this helper will mock out the audit log entry logic
    and flush those entries to the database after the given context is complete.
    :return:
    """
    with patch("sentry.region_to_control.producer.produce_audit_log_entry") as produce:
        yield
        with exempt_from_silo_limits():
            for entry in produce.call_args[0]:
                entry.save()
