"""Make pytest-sentry's reports usable alongside pytest-rerunfailures.

On master, CI runs pytest with ``--reruns`` and ``PYTEST_SENTRY_ALWAYS_REPORT=1``
so every failed attempt is reported to Sentry. Out of the box, pytest-sentry
then:

* re-captures the exceptions of all earlier attempts on every retry, so a test
  that fails N times sends 1 + 2 + ... + N events, and
* doesn't say whether a failed attempt is about to be retried or has failed the
  test for good, so a flaky test that passed on retry looks the same as a test
  that is actually broken on master.

This plugin runs inside pytest-sentry's (``tryfirst``) makereport wrapper and
fixes both: each attempt reports only its own exception, and every event is
tagged with ``pytest.attempt`` and ``pytest.final_attempt``. Query
``pytest.result:failed pytest.final_attempt:true`` for tests that failed every
attempt.

See also:
    * https://github.com/getsentry/pytest-sentry
    * https://github.com/pytest-dev/pytest-rerunfailures
"""

from __future__ import annotations

from collections.abc import Generator

import pytest
import pytest_sentry
import sentry_sdk
from pytest_rerunfailures import get_reruns_count


def _is_final_attempt(item: pytest.Item, attempt: int) -> bool:
    reruns = get_reruns_count(item)
    return not reruns or attempt > reruns


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item: pytest.Item, call: pytest.CallInfo[None]) -> Generator[None]:
    scope = pytest_sentry._resolve_scope_marker_value(item.get_closest_marker("sentry_client"))
    integration = scope.client.get_integration(pytest_sentry.PytestIntegration)
    if integration is not None and call.when == "call":
        # pytest-rerunfailures sets this (1-based) before each attempt.
        attempt = getattr(item, "execution_count", None) or 1
        sentry_sdk.set_tag("pytest.attempt", str(attempt))
        sentry_sdk.set_tag(
            "pytest.final_attempt", "true" if _is_final_attempt(item, attempt) else "false"
        )
        if integration.always_report:
            # Earlier attempts were already reported; don't send them again.
            item.pytest_sentry_exc_chain = []  # type: ignore[attr-defined]
    yield
