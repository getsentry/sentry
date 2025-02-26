import os
import sys
from collections.abc import MutableMapping

import psutil
import pytest
import responses
from django.core.cache import cache
from django.db import connections

from sentry.silo.base import SiloMode
from sentry.testutils.pytest.sentry import get_default_silo_mode_for_test_cases

pytest_plugins = ["sentry.testutils.pytest"]


# XXX: The below code is vendored code from https://github.com/utgwkk/pytest-github-actions-annotate-failures
# so that we can add support for pytest_rerunfailures
# retried tests will no longer be annotated in GHA
#
# Reference:
# https://docs.pytest.org/en/latest/writing_plugins.html#hookwrapper-executing-around-other-hooks
# https://docs.pytest.org/en/latest/writing_plugins.html#hook-function-ordering-call-example
# https://docs.pytest.org/en/stable/reference.html#pytest.hookspec.pytest_runtest_makereport
#
# Inspired by:
# https://github.com/pytest-dev/pytest/blob/master/src/_pytest/terminal.py


if sys.platform == "linux":

    def _open_files() -> frozenset[str]:
        ret = []
        pid = os.getpid()
        for fd in os.listdir(f"/proc/{pid}/fd"):
            try:
                path = os.readlink(f"/proc/{pid}/fd/{fd}")
            except FileNotFoundError:
                continue
            else:
                ret.append(path)
        return frozenset(ret)

else:

    def _open_files() -> frozenset[str]:
        return frozenset(f.path for f in psutil.Process().open_files())


@pytest.fixture(autouse=True)
def unclosed_files():
    fds = _open_files()
    yield
    assert _open_files() == fds


@pytest.fixture(autouse=True)
def validate_silo_mode():
    # NOTE!  Hybrid cloud uses many mechanisms to simulate multiple different configurations of the application
    # during tests.  It depends upon `override_settings` using the correct contextmanager behaviors and correct
    # thread handling in acceptance tests.  If you hit one of these, it's possible either that cleanup logic has
    # a bug, or you may be using a contextmanager incorrectly.  Let us know and we can help!
    expected = get_default_silo_mode_for_test_cases()
    message = (
        f"Possible test leak bug!  SiloMode was not reset to {expected} between tests.  "
        "Please read the comment for validate_silo_mode() in tests/conftest.py."
    )

    if SiloMode.get_current_mode() != expected:
        raise Exception(message)
    yield
    if SiloMode.get_current_mode() != expected:
        raise Exception(message)


@pytest.fixture(autouse=True)
def setup_simulate_on_commit(request):
    from sentry.testutils.hybrid_cloud import simulate_on_commit

    with simulate_on_commit(request):
        yield


@pytest.fixture(autouse=True)
def setup_enforce_monotonic_transactions(request):
    from sentry.testutils.hybrid_cloud import enforce_no_cross_transaction_interactions

    with enforce_no_cross_transaction_interactions():
        yield


@pytest.fixture(autouse=True)
def audit_hybrid_cloud_writes_and_deletes(request):
    """
    Ensure that write operations on hybrid cloud foreign keys are recorded
    alongside outboxes or use a context manager to indicate that the
    caller has considered outbox and didn't accidentally forget.

    Generally you can avoid assertion errors from these checks by:

    1. Running deletion/write logic within an `outbox_context`.
    2. Using Model.delete()/save methods that create outbox messages in the
       same transaction as a delete operation.

    Scenarios that are generally always unsafe are  using
    `QuerySet.delete()`, `QuerySet.update()` or raw SQL to perform
    writes.

    The User.delete() method is a good example of how to safely
    delete records and generate outbox messages.
    """
    from sentry.testutils.silo import validate_protected_queries

    debug_cursor_state: MutableMapping[str, bool] = {}
    for conn in connections.all():
        debug_cursor_state[conn.alias] = conn.force_debug_cursor

        conn.queries_log.clear()
        conn.force_debug_cursor = True

    try:
        yield
    finally:
        for conn in connections.all():
            conn.force_debug_cursor = debug_cursor_state[conn.alias]

            validate_protected_queries(conn.queries)


@pytest.fixture(autouse=True)
def clear_caches():
    yield
    cache.clear()


@pytest.fixture(autouse=True)
def check_leaked_responses_mocks():
    yield
    leaked = responses.registered()
    if leaked:
        responses.reset()

        leaked_s = "".join(f"- {item}\n" for item in leaked)
        raise AssertionError(
            f"`responses` were leaked outside of the test context:\n{leaked_s}"
            f"(make sure to use `@responses.activate` or `with responses.mock:`)"
        )
