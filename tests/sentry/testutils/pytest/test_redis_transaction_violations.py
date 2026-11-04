from __future__ import annotations

import os
import subprocess
import sys
import textwrap
from typing import Any

import pytest

from sentry.utils import json

# The inner module is not in the `tests.` package, so the transaction check does not exempt it.
# The tests run in this order.
INNER_TESTS = textwrap.dedent(
    """
    import pytest
    from django.db import transaction

    from sentry.locks import locks
    from sentry.tasks.assemble import delete_assemble_status
    from sentry.testutils.hybrid_cloud import simulate_on_commit
    from sentry.utils.locking import UnableToAcquireLock
    from sentry.utils.redis import pop_redis_transaction_violations, redis_clusters

    pytestmark = pytest.mark.django_db

    KEY = "test:redis-transaction-violations"


    # The sentry and getsentry conftest files both have this fixture. It makes the transaction
    # of the test itself not count for the transaction check.
    @pytest.fixture(autouse=True)
    def setup_simulate_on_commit(request):
        with simulate_on_commit(request):
            yield


    def unexpected_redis_call():
        redis_clusters.get("default").get(KEY)


    def test_caught_plain_call():
        with transaction.atomic(using="default"):
            try:
                unexpected_redis_call()
            except AssertionError:
                pass


    def test_clean_after_plain_call():
        unexpected_redis_call()


    def test_caught_lock_call():
        with transaction.atomic(using="default"):
            with pytest.raises(UnableToAcquireLock):
                locks.get(KEY, duration=5, name="test").acquire()


    def test_clean_after_lock_call():
        with locks.get(KEY, duration=5, name="test").acquire():
            pass


    def test_violation_cleared_by_test():
        with transaction.atomic(using="default"):
            with pytest.raises(AssertionError):
                unexpected_redis_call()

        [(message, callers)] = pop_redis_transaction_violations()
        assert message == "Redis commands must run outside database transactions"
        assert callers == ("test_inner.unexpected_redis_call", "test_inner.test_violation_cleared_by_test")


    def test_allowlisted_and_exempt_calls():
        # A function whose module name starts with "sentry.testutils." is exempt.
        namespace = {"__name__": "sentry.testutils.redis_transaction_helper", "KEY": KEY, "redis_clusters": redis_clusters}
        exec("def exempt_redis_call():\\n    redis_clusters.get('default').get(KEY)\\n", namespace)

        with transaction.atomic(using="default"):
            # In _REDIS_TRANSACTION_CALLSTACK_ALLOWLIST_RATCHET
            delete_assemble_status("test", 1, "0" * 40)
            namespace["exempt_redis_call"]()
    """
)


@pytest.fixture(scope="module")
def inner_tests(tmp_path_factory: pytest.TempPathFactory) -> dict[str, dict[str, Any]]:
    tmp_path = tmp_path_factory.mktemp("redis_transaction_violations")
    (tmp_path / "pytest.ini").write_text("[pytest]\n")
    (tmp_path / "test_inner.py").write_text(INNER_TESTS)
    # Keep the outer run's options, test selection and shuffle out. Load only the shared plugin
    # package, not tests/conftest.py, as the getsentry suite does.
    env = {
        k: v
        for k, v in os.environ.items()
        if not k.startswith(
            ("PYTEST_", "DJANGO_", "TEST_GROUP", "TOTAL_TEST_GROUPS", "SENTRY_SHUFFLE_TESTS")
        )
        and k != "SELECTED_TESTS_FILE"
    }
    env["PYTEST_DISABLE_PLUGIN_AUTOLOAD"] = "1"
    # Use the Redis DB and key prefix of this xdist worker, so the inner run does not flush the
    # Redis data of other workers.
    if worker := os.environ.get("PYTEST_XDIST_WORKER"):
        env["PYTEST_XDIST_WORKER"] = worker
    # pytest-django adds this suffix to the test database names, so the inner run does not use
    # the databases of this run or of other runs.
    env["TOX_PARALLEL_ENV"] = f"redis_txn_{os.getpid()}"
    # The shared plugin package has hooks for xdist, so pytest needs the xdist plugin too.
    plugins = (
        "xdist.plugin",
        "pytest_django.plugin",
        "pytest_jsonreport.plugin",
        "sentry.testutils.pytest",
    )
    proc = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "-p",
            "no:cacheprovider",
            *(arg for plugin in plugins for arg in ("-p", plugin)),
            "--nomigrations",
            "--json-report",
            "--json-report-file=report.json",
            "test_inner.py",
        ],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
        timeout=600,
    )
    assert proc.returncode == 1, proc.stdout + proc.stderr
    report = json.loads((tmp_path / "report.json").read_text())
    return {test["nodeid"].split("::")[1]: test for test in report["tests"]}


def _outcomes(test: dict[str, Any]) -> tuple[str, str, str]:
    return (test["setup"]["outcome"], test["call"]["outcome"], test["teardown"]["outcome"])


def test_caught_plain_call_fails_at_teardown(inner_tests: dict[str, dict[str, Any]]) -> None:
    test = inner_tests["test_caught_plain_call"]
    assert _outcomes(test) == ("passed", "passed", "failed")
    error = test["teardown"]["longrepr"]
    assert (
        "plain call (_REDIS_TRANSACTION_CALLSTACK_ALLOWLIST_RATCHET): "
        "Redis commands must run outside database transactions"
    ) in error
    assert "    test_inner.unexpected_redis_call\n    test_inner.test_caught_plain_call" in error
    assert "pop_redis_transaction_violations()" in error


def test_caught_lock_call_fails_at_teardown(inner_tests: dict[str, dict[str, Any]]) -> None:
    test = inner_tests["test_caught_lock_call"]
    assert _outcomes(test) == ("passed", "passed", "failed")
    error = test["teardown"]["longrepr"]
    assert "lock call (_REDIS_TRANSACTION_LOCK_ALLOWLIST_RATCHET): " in error
    assert "    sentry.utils.locking.backends.redis.BaseRedisLockBackend.acquire\n" in error
    assert "    test_inner.test_caught_lock_call" in error
    assert error.count("lock call") == 1


@pytest.mark.parametrize(
    "name",
    [
        "test_clean_after_plain_call",
        "test_clean_after_lock_call",
        "test_violation_cleared_by_test",
        "test_allowlisted_and_exempt_calls",
    ],
)
def test_passes_without_teardown_error(inner_tests: dict[str, dict[str, Any]], name: str) -> None:
    assert _outcomes(inner_tests[name]) == ("passed", "passed", "passed")


def test_inner_tests_ran_in_order(inner_tests: dict[str, dict[str, Any]]) -> None:
    assert list(inner_tests) == [
        "test_caught_plain_call",
        "test_clean_after_plain_call",
        "test_caught_lock_call",
        "test_clean_after_lock_call",
        "test_violation_cleared_by_test",
        "test_allowlisted_and_exempt_calls",
    ]
