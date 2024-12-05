from __future__ import annotations

from multiprocessing.context import TimeoutError

from sentry.taskworker.retry import LastAction, Retry, RetryError


class RuntimeChildError(RuntimeError):
    """Dummy exception for instanceof tests"""


def test_initial_state__discard() -> None:
    retry = Retry(times=1, times_exceeded=LastAction.Discard)
    proto = retry.initial_state()

    assert proto.attempts == 0
    assert proto.kind == "sentry.taskworker.retry.Retry"
    assert proto.discard_after_attempt == 1
    assert proto.deadletter_after_attempt == 0


def test_initial_state__deadletter() -> None:
    retry = Retry(times=5, times_exceeded=LastAction.Deadletter)
    proto = retry.initial_state()

    assert proto.attempts == 0
    assert proto.kind == "sentry.taskworker.retry.Retry"
    assert proto.discard_after_attempt == 0
    assert proto.deadletter_after_attempt == 5


def test_should_retry_no_matching_error() -> None:
    retry = Retry(times=5)
    state = retry.initial_state()

    err = Exception("something bad")
    assert not retry.should_retry(state, err)

    state.attempts = 5
    assert not retry.should_retry(state, err)


def test_should_retry_retryerror() -> None:
    retry = Retry(times=5)
    state = retry.initial_state()

    err = RetryError("something bad")
    assert retry.should_retry(state, err)

    state.attempts = 4
    assert not retry.should_retry(state, err)


def test_should_retry_multiprocessing_timeout() -> None:
    retry = Retry(times=3)
    state = retry.initial_state()

    timeout = TimeoutError("timeouts should retry if there are attempts left")
    assert retry.should_retry(state, timeout)

    state.attempts = 1
    assert retry.should_retry(state, timeout)

    # attempt = 2 is actually the third attempt.
    state.attempts = 2
    assert not retry.should_retry(state, timeout)

    state.attempts = 3
    assert not retry.should_retry(state, timeout)


def test_should_retry_error_allow_list() -> None:
    retry = Retry(times=3, on=(RuntimeError, KeyError))
    state = retry.initial_state()

    err = RuntimeError("should retry")
    assert retry.should_retry(state, err)

    key_err = KeyError("should retry")
    assert retry.should_retry(state, key_err)

    err_child = RuntimeChildError("subclasses are retried")
    assert retry.should_retry(state, err_child)

    value_err = ValueError("no retry")
    assert not retry.should_retry(state, value_err)


def test_should_retry_allow_list_ignore_parent() -> None:
    retry = Retry(times=3, on=(Exception,), ignore=(RuntimeError,))
    state = retry.initial_state()

    runtime_err = RuntimeError("no retry for ignored")
    assert not retry.should_retry(state, runtime_err)

    runtime_child = RuntimeChildError("no retry for subclasses of ignored")
    assert not retry.should_retry(state, runtime_child)

    val_err = ValueError("other exceptions are retried")
    assert retry.should_retry(state, val_err)
