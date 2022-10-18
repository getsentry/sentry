import contextlib
from unittest.mock import patch

from sentry.testutils.silo import exempt_from_silo_limits


@contextlib.contextmanager
def flush_audit_logs():
    with patch("sentry.region_to_control.producer.produce_audit_log_entry") as produce:
        yield
        for entry in produce.call_args[0]:
            with exempt_from_silo_limits():
                entry.save()
