from types import SimpleNamespace
from unittest import mock

import pytest

from sentry.taskworker.adapters import TaskErrorCaptureHook


@pytest.fixture
def task_meta():
    """Return a representative task metadata object used by the hook."""
    return SimpleNamespace(
        id="abc-123",
        taskname="sentry.tasks.store.save_event",
        namespace="ingest.errors",
    )


class RootCauseError(Exception):
    """A helper exception used to test chained root-cause logging."""


class FakeOperationalError(Exception):
    """A fake DB error with a Django-like module path for shape testing."""


FakeOperationalError.__module__ = "django.db.utils"


def test_envelope_uses_fully_qualified_type(task_meta):
    """The returned TaskError envelope should use a fully qualified exception type."""
    hook = TaskErrorCaptureHook()
    try:
        raise ValueError("boom")
    except ValueError as exc:
        env = hook.on_exception(task_meta, exc)

    assert env is not None
    assert env.exception_type == "builtins.ValueError"
    assert env.exception_message == "boom"
    assert "ValueError: boom" in env.traceback


def test_summary_log_contains_task_context_and_exception_fields(task_meta, caplog):
    """The main ERROR log should be a single-line summary with task and exception fields."""
    hook = TaskErrorCaptureHook()

    with caplog.at_level("ERROR", logger="sentry.taskworker.adapters"):
        try:
            raise ValueError("boom")
        except ValueError as exc:
            env = hook.on_exception(task_meta, exc)

    assert env is not None
    rec = next(r for r in caplog.records if r.message.startswith("taskworker.task_failed "))
    assert 'task_id="abc-123"' in rec.message
    assert 'taskname="sentry.tasks.store.save_event"' in rec.message
    assert 'namespace="ingest.errors"' in rec.message
    assert 'exception_type="builtins.ValueError"' in rec.message
    assert 'exception_message="boom"' in rec.message
    assert 'root_cause_type="builtins.ValueError"' in rec.message
    assert 'root_cause_message="boom"' in rec.message
    assert "Traceback (most recent call last)" not in rec.message
    assert "\n" not in rec.message


def test_log_works_outside_active_except_and_envelope_still_has_traceback(task_meta, caplog):
    """The hook should work outside an active except block and still include traceback in the envelope."""
    try:
        raise RuntimeError("boom")
    except RuntimeError as e:
        captured = e

    hook = TaskErrorCaptureHook()
    with caplog.at_level("ERROR", logger="sentry.taskworker.adapters"):
        env = hook.on_exception(task_meta, captured)

    assert env is not None
    assert "RuntimeError: boom" in env.traceback
    rec = next(r for r in caplog.records if r.message.startswith("taskworker.task_failed "))
    assert 'exception_type="builtins.RuntimeError"' in rec.message
    assert "Traceback (most recent call last)" not in rec.message


def test_summary_log_contains_root_cause_for_chained_exception(task_meta, caplog):
    """The summary log should include both the top-level exception and the deepest root cause."""
    hook = TaskErrorCaptureHook()

    try:
        try:
            raise RootCauseError("inner boom")
        except RootCauseError as inner:
            raise RuntimeError("outer boom") from inner
    except RuntimeError as exc:
        with caplog.at_level("ERROR", logger="sentry.taskworker.adapters"):
            env = hook.on_exception(task_meta, exc)

    assert env is not None
    rec = next(r for r in caplog.records if r.message.startswith("taskworker.task_failed "))
    assert 'exception_type="builtins.RuntimeError"' in rec.message
    assert 'exception_message="outer boom"' in rec.message
    assert (
        f'root_cause_type="{RootCauseError.__module__}.{RootCauseError.__qualname__}"'
        in rec.message
    )
    assert 'root_cause_message="inner boom"' in rec.message


def test_root_cause_respects_raise_from_none(task_meta, caplog):
    """Suppressed context from 'raise ... from None' must not appear as the root cause."""
    hook = TaskErrorCaptureHook()

    try:
        try:
            raise ValueError("hidden inner")
        except ValueError:
            raise RuntimeError("outer only") from None
    except RuntimeError as exc:
        with caplog.at_level("ERROR", logger="sentry.taskworker.adapters"):
            env = hook.on_exception(task_meta, exc)

    assert env is not None
    rec = next(r for r in caplog.records if r.message.startswith("taskworker.task_failed "))
    assert 'exception_type="builtins.RuntimeError"' in rec.message
    assert 'root_cause_type="builtins.RuntimeError"' in rec.message
    assert 'root_cause_message="outer only"' in rec.message
    assert "hidden inner" not in rec.message


def test_reproduces_btree_gist_shape(task_meta):
    """A Django-style database error should preserve a useful type and message in the envelope."""
    hook = TaskErrorCaptureHook()

    try:
        raise FakeOperationalError(
            'could not access file "$libdir/btree_gist": No such file or directory'
        )
    except FakeOperationalError as exc:
        env = hook.on_exception(task_meta, exc)

    assert env is not None
    assert env.exception_type == "django.db.utils.FakeOperationalError"
    assert "btree_gist" in env.exception_message


def test_capture_exception_called_with_tags(task_meta):
    """The hook should tag task context on the Sentry isolation scope before capturing."""
    hook = TaskErrorCaptureHook()
    with mock.patch("sentry.taskworker.adapters.sentry_sdk") as sdk:
        scope = sdk.isolation_scope.return_value.__enter__.return_value
        try:
            raise RuntimeError("x")
        except RuntimeError as exc:
            hook.on_exception(task_meta, exc)

    sdk.capture_exception.assert_called_once()
    scope.set_tag.assert_any_call("taskname", "sentry.tasks.store.save_event")
    scope.set_tag.assert_any_call("namespace", "ingest.errors")
    scope.set_tag.assert_any_call("task_id", "abc-123")


def test_message_is_truncated_to_char_limit(task_meta):
    """The exception message in the envelope should respect the configured character limit."""
    hook = TaskErrorCaptureHook()
    big = "x" * 50_000
    try:
        raise ValueError(big)
    except ValueError as exc:
        env = hook.on_exception(task_meta, exc)

    assert env is not None
    assert len(env.exception_message) == hook.MAX_MESSAGE_CHARS


def test_traceback_is_truncated_to_char_limit(task_meta):
    """The traceback in the envelope should be truncated to the configured maximum length."""
    hook = TaskErrorCaptureHook()

    def deep(n):
        if n == 0:
            raise RuntimeError("deep")
        deep(n - 1)

    try:
        deep(500)
    except RuntimeError as exc:
        env = hook.on_exception(task_meta, exc)

    assert env is not None
    assert len(env.traceback) <= hook.MAX_TRACEBACK_CHARS


def test_hook_never_raises_even_if_capture_fails(task_meta):
    """A Sentry capture failure must not mask the original task exception."""
    hook = TaskErrorCaptureHook()
    with mock.patch("sentry.taskworker.adapters.sentry_sdk") as sdk:
        sdk.capture_exception.side_effect = Exception("sdk broken")
        try:
            raise ValueError("original")
        except ValueError as exc:
            env = hook.on_exception(task_meta, exc)

    assert env is not None
    assert env.exception_message == "original"


def test_hook_never_raises_even_if_envelope_build_fails(task_meta):
    """If traceback formatting fails, the hook should return None rather than raise."""
    hook = TaskErrorCaptureHook()
    with mock.patch("sentry.taskworker.adapters._traceback.format_exception") as fmt:
        fmt.side_effect = Exception("traceback broken")
        try:
            raise ValueError("original")
        except ValueError as exc:
            env = hook.on_exception(task_meta, exc)

    assert env is None


def test_hook_never_raises_when_exception_str_is_broken(task_meta):
    """A broken exception __str__ implementation must not cause the hook to raise."""

    class BrokenStrError(Exception):
        def __str__(self) -> str:
            raise RuntimeError("broken __str__")

    hook = TaskErrorCaptureHook()
    env = hook.on_exception(task_meta, BrokenStrError())

    assert env is None


def test_hook_tolerates_missing_task_meta_fields():
    """The hook should still produce an envelope when task metadata fields are absent."""
    hook = TaskErrorCaptureHook()
    minimal = SimpleNamespace()
    try:
        raise RuntimeError("x")
    except RuntimeError as exc:
        env = hook.on_exception(minimal, exc)

    assert env is not None

