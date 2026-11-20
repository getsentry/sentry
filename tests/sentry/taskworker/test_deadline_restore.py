import contextlib
from collections.abc import Iterator
from unittest import mock

from sentry.taskworker import deadline_restore
from sentry.taskworker.adapters import DeadlineRestoreModeHook
from sentry.taskworker.runtime import app
from sentry.testutils.helpers.options import override_options


@contextlib.contextmanager
def task(mode: str) -> Iterator[None]:
    with override_options({"taskworker.deadline_restore.mode": mode}):
        with DeadlineRestoreModeHook().on_execute({}):
            yield


class TestDeadlineRestoreMode:
    def test_a_task_runs_in_the_mode_the_option_holds(self) -> None:
        modes_seen_by_the_task: list[str] = []

        for option_value in ("off", "report", "enforce", "not-a-mode"):
            with task(option_value):
                modes_seen_by_the_task.append(deadline_restore.current_mode())

        assert modes_seen_by_the_task == ["off", "report", "enforce", "off"]

    def test_the_mode_is_off_again_once_the_task_ends(self) -> None:
        with task("enforce"):
            pass

        assert deadline_restore.current_mode() == "off"

    def test_a_task_still_runs_with_the_mode_off_when_the_option_cannot_be_read(self) -> None:
        with mock.patch.object(deadline_restore, "options") as options:
            options.get.side_effect = RuntimeError("options are down")

            with DeadlineRestoreModeHook().on_execute({}):
                mode_seen_by_the_task = deadline_restore.current_mode()

        assert mode_seen_by_the_task == "off"

    def test_the_sentry_task_app_uses_the_hook(self) -> None:
        assert any(isinstance(hook, DeadlineRestoreModeHook) for hook in app.context_hooks)
