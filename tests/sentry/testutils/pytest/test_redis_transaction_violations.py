from __future__ import annotations

from collections.abc import Generator

import pytest

from sentry.testutils.pytest.sentry import (
    _format_redis_transaction_violations,
    pytest_runtest_teardown_redis_transaction_violations,
)
from sentry.utils.redis import _redis_transaction_violations, pop_redis_transaction_violations

MESSAGE = "Redis commands must run outside database transactions"
PLAIN_CALL = ("sentry.new_code.unexpected_redis_call", "sentry.new_code.endpoint")
LOCK_CALL = (
    "sentry.utils.locking.backends.redis.BaseRedisLockBackend.acquire",
    "sentry.utils.locking.lock.Lock.acquire",
    "sentry.new_code.locked_update",
)


@pytest.fixture
def teardown_hook(request: pytest.FixtureRequest) -> Generator[Generator[None, object, object]]:
    # Runs the hook up to its yield, as pytest does before the other teardown hooks run.
    hook = pytest_runtest_teardown_redis_transaction_violations(request.node)
    next(hook)
    yield hook
    # Do not let a violation from this test fail this test's own teardown.
    pop_redis_transaction_violations()


def test_fails_when_a_violation_was_recorded(
    teardown_hook: Generator[None, object, object],
) -> None:
    _redis_transaction_violations.append((MESSAGE, PLAIN_CALL))

    with pytest.raises(pytest.fail.Exception) as excinfo:
        teardown_hook.send(None)

    assert f"plain call (_REDIS_TRANSACTION_CALLSTACK_ALLOWLIST_RATCHET): {MESSAGE}" in str(
        excinfo.value
    )
    assert pop_redis_transaction_violations() == []


def test_passes_without_violations(teardown_hook: Generator[None, object, object]) -> None:
    with pytest.raises(StopIteration):
        teardown_hook.send(None)


def test_adds_violations_to_an_earlier_teardown_error(
    teardown_hook: Generator[None, object, object],
) -> None:
    _redis_transaction_violations.append((MESSAGE, PLAIN_CALL))
    error = RuntimeError("fixture teardown failed")

    with pytest.raises(RuntimeError) as excinfo:
        teardown_hook.throw(error)

    assert excinfo.value is error
    [note] = error.__notes__
    assert f"plain call (_REDIS_TRANSACTION_CALLSTACK_ALLOWLIST_RATCHET): {MESSAGE}" in note
    assert pop_redis_transaction_violations() == []


def test_message_shows_each_stack_once_with_its_allowlist() -> None:
    # A retry loop makes the same lock call many times.
    message = _format_redis_transaction_violations(
        [(MESSAGE, PLAIN_CALL), (MESSAGE, LOCK_CALL), (MESSAGE, LOCK_CALL), (MESSAGE, ())]
    )

    assert (
        f"plain call (_REDIS_TRANSACTION_CALLSTACK_ALLOWLIST_RATCHET): {MESSAGE}\n"
        "    sentry.new_code.unexpected_redis_call\n"
        "    sentry.new_code.endpoint\n"
    ) in message
    assert (
        f"lock call (_REDIS_TRANSACTION_LOCK_ALLOWLIST_RATCHET): {MESSAGE}\n"
        "    sentry.utils.locking.backends.redis.BaseRedisLockBackend.acquire\n"
        "    sentry.utils.locking.lock.Lock.acquire\n"
        "    sentry.new_code.locked_update\n"
    ) in message
    assert message.count("lock call") == 1
    assert (
        f"plain call (_REDIS_TRANSACTION_CALLSTACK_ALLOWLIST_RATCHET): {MESSAGE}\n    unknown\n"
        in message
    )
    assert "pop_redis_transaction_violations()" in message


def test_hook_is_registered_as_a_teardown_wrapper(pytestconfig: pytest.Config) -> None:
    # If the hook is not registered, caught violations pass without an error.
    [hookimpl] = [
        hookimpl
        for hookimpl in pytestconfig.pluginmanager.hook.pytest_runtest_teardown.get_hookimpls()
        if hookimpl.function is pytest_runtest_teardown_redis_transaction_violations
    ]
    assert hookimpl.wrapper
