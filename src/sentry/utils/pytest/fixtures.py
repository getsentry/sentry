# Backwards compat shim for getsentry
from sentry.testutils.pytest.fixtures import django_db_all

__all__ = ("django_db_all",)
