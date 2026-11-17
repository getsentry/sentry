import asyncio
import contextlib
import signal
from collections.abc import Callable, Iterator
from types import FrameType
from unittest import mock

import pytest
from django.db import OperationalError, ProgrammingError, connections, transaction
from taskbroker_client.state import CurrentTaskState
from taskbroker_client.worker.workerchild import ProcessingDeadlineExceeded

from sentry.models.options.option import Option
from sentry.taskworker import deadline_restore
from sentry.taskworker.adapters import DeadlineRestoreModeHook, reset_database_connection
from sentry.taskworker.runtime import app
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.helpers.options import override_options
from sentry.utils.db import atomic_transaction


class WalkNeverEnded(BaseException):
    pass


def write_in_a_block(key: str) -> None:
    with transaction.atomic(using="default"):
        Option.objects.create(key=key, value="1")


def write_in_a_nested_block(key: str) -> None:
    with transaction.atomic(using="default"):
        with transaction.atomic(using="default"):
            Option.objects.create(key=key, value="1")


def write_in_an_atomic_transaction(key: str) -> None:
    with atomic_transaction(using=["default"]):
        Option.objects.create(key=key, value="1")


def write_in_a_block_with_a_commit_hook(key: str) -> None:
    with transaction.atomic(using="default"):
        Option.objects.create(key=key, value="1")

        transaction.on_commit(mock.Mock(), using="default")


def reset_connections() -> None:
    for connection in connections.all(initialized_only=True):
        reset_database_connection(connection)


# Use TransactionTestCase so the outermost block really commits and Django runs the commit hooks
class TestDeadlineRestore(TransactionTestCase):
    def tearDown(self) -> None:
        # A forced deadline leaves the connection mid-transaction, which the flush can't run on
        reset_connections()

        super().tearDown()

    def test_enforce_stops_a_loop_that_catches_errors_per_row(self) -> None:
        block_shapes: tuple[Callable[[str], None], ...] = (
            write_in_a_block,
            write_in_a_nested_block,
            write_in_an_atomic_transaction,
            write_in_a_block_with_a_commit_hook,
        )

        for write_row in block_shapes:
            with self.subTest(write_row.__name__):
                rows_attempted: list[int] = []

                with self._task("enforce"), self._deadline_during_commit():
                    with pytest.raises(ProcessingDeadlineExceeded):
                        for row in range(3):
                            rows_attempted.append(row)

                            with contextlib.suppress(Exception):
                                write_row(f"deadline_restore.row.{row}")

                assert rows_attempted == [0]

                reset_connections()

    def test_enforce_keeps_a_deadline_raised_in_the_block_when_the_rollback_fails(self) -> None:
        rollback_failed = RuntimeError("rollback failed")

        with (
            self._task("enforce"),
            mock.patch.object(connections["default"], "rollback", side_effect=rollback_failed),
        ):
            with pytest.raises(ProcessingDeadlineExceeded):
                with transaction.atomic(using="default"):
                    Option.objects.create(key="deadline_restore.in_block", value="1")

                    raise ProcessingDeadlineExceeded()

    def test_enforce_leaves_a_failed_commit_alone_after_the_task_caught_its_deadline(self) -> None:
        commit_failed = OperationalError("commit failed")

        with self._task("enforce"):
            try:
                with self._deadline_during_commit():
                    write_in_a_block("deadline_restore.interrupted")
            except ProcessingDeadlineExceeded:
                reset_connections()

                with mock.patch.object(
                    connections["default"], "_commit", side_effect=commit_failed
                ):
                    with pytest.raises(OperationalError, match="commit failed"):
                        write_in_a_block("deadline_restore.after_the_deadline")

    def test_enforce_leaves_other_interruptions_replaced(self) -> None:
        cancelled = asyncio.CancelledError()

        with (
            self._task("enforce"),
            mock.patch.object(connections["default"], "_commit", side_effect=cancelled),
        ):
            with pytest.raises(ProgrammingError, match="set_session cannot be used"):
                write_in_a_block("deadline_restore.interrupted")

    def test_enforce_leaves_a_commit_hooks_error_alone_after_the_hook_caught_a_deadline(
        self,
    ) -> None:
        def commit_hook() -> None:
            try:
                raise ProcessingDeadlineExceeded()
            except ProcessingDeadlineExceeded:
                raise ValueError("the hook gave up")

        with self._task("enforce"):
            with pytest.raises(ValueError, match="the hook gave up"):
                with transaction.atomic(using="default"):
                    transaction.on_commit(commit_hook, using="default")

    def test_enforce_leaves_an_error_alone_when_its_chain_loops(self) -> None:
        first = KeyError("first")
        second = ValueError("second")
        first.__context__ = second
        second.__cause__ = first

        with self._task("enforce"), self._give_up_after(seconds=3):
            with pytest.raises(KeyError, match="first"):
                with transaction.atomic(using="default"):
                    transaction.on_commit(mock.Mock(side_effect=first), using="default")

    def test_a_commit_hook_gets_its_own_error_while_the_deadline_is_in_flight(self) -> None:
        connection = connections["default"]
        commit = connection.commit
        errors_after_each_commit: Iterator[BaseException] = iter(
            [ProcessingDeadlineExceeded(), OperationalError("commit failed in the hook")]
        )
        errors_seen_by_the_hook: list[type[Exception]] = []

        def commit_then_raise() -> None:
            commit()

            raise next(errors_after_each_commit)

        def commit_hook() -> None:
            try:
                write_in_a_block("deadline_restore.hook")
            except Exception as error:
                errors_seen_by_the_hook.append(type(error))

        with (
            self._task("enforce"),
            mock.patch.object(connection, "commit", side_effect=commit_then_raise),
        ):
            with pytest.raises(ProcessingDeadlineExceeded):
                with transaction.atomic(using="default"):
                    transaction.on_commit(commit_hook, using="default")

        assert errors_seen_by_the_hook == [OperationalError]

    def test_any_other_mode_raises_the_database_error(self) -> None:
        for mode in ("off", "report", "not-a-mode"):
            with self.subTest(mode):
                with self._task(mode), self._deadline_during_commit():
                    with pytest.raises(ProgrammingError, match="set_session cannot be used"):
                        write_in_a_block("deadline_restore.interrupted")

                reset_connections()

    def test_report_and_enforce_count_each_match_by_task_and_database(self) -> None:
        task = CurrentTaskState(
            id="1",
            namespace="tests",
            taskname="tests.write_rows",
            attempt=0,
            processing_deadline_duration=10,
            retries_remaining=False,
        )

        with (
            mock.patch.object(deadline_restore, "metrics") as metrics,
            mock.patch.object(deadline_restore, "current_task", side_effect=[None, task]),
        ):
            with self._task("off"), self._deadline_during_commit():
                with pytest.raises(ProgrammingError):
                    write_in_a_block("deadline_restore.interrupted")

            reset_connections()

            with self._task("report"), self._deadline_during_commit():
                with pytest.raises(ProgrammingError):
                    write_in_a_block("deadline_restore.interrupted")

            reset_connections()

            with self._task("enforce"), self._deadline_during_commit():
                with pytest.raises(ProcessingDeadlineExceeded):
                    write_in_a_block("deadline_restore.interrupted")

        assert metrics.incr.call_args_list == [
            mock.call(
                "taskworker.deadline_restore.matched",
                tags={"taskname": "unknown", "using": "default"},
                sample_rate=1.0,
            ),
            mock.call(
                "taskworker.deadline_restore.matched",
                tags={"taskname": "tests.write_rows", "using": "default"},
                sample_rate=1.0,
            ),
        ]

    def test_enforce_reads_no_option_and_survives_a_failing_metric_as_the_block_ends(self) -> None:
        with self._task("enforce"):
            with (
                mock.patch.object(deadline_restore, "options") as options,
                mock.patch.object(deadline_restore, "metrics") as metrics,
                self._deadline_during_commit(),
            ):
                metrics.incr.side_effect = RuntimeError("metrics are down")

                with pytest.raises(ProcessingDeadlineExceeded):
                    write_in_a_block("deadline_restore.interrupted")

        options.get.assert_not_called()

    def test_a_task_still_runs_with_the_rule_off_when_the_mode_cannot_be_read(self) -> None:
        with mock.patch.object(deadline_restore, "options") as options:
            options.get.side_effect = RuntimeError("options are down")

            with DeadlineRestoreModeHook().on_execute({}), self._deadline_during_commit():
                with pytest.raises(ProgrammingError, match="set_session cannot be used"):
                    write_in_a_block("deadline_restore.interrupted")

    def test_refuses_to_install_over_a_wrapper(self) -> None:
        # The conftest's commit hook fixture has already wrapped the method by now
        with pytest.raises(RuntimeError, match="must be installed first"):
            deadline_restore.patch_atomic_exit_to_restore_deadlines()

    def test_the_sentry_task_app_uses_the_hook(self) -> None:
        assert any(isinstance(hook, DeadlineRestoreModeHook) for hook in app.context_hooks)

    @contextlib.contextmanager
    def _task(self, mode: str) -> Iterator[None]:
        with override_options({"taskworker.deadline_restore.mode": mode}):
            with DeadlineRestoreModeHook().on_execute({}):
                yield

    @contextlib.contextmanager
    def _deadline_during_commit(self) -> Iterator[None]:
        with mock.patch.object(
            connections["default"], "_commit", side_effect=ProcessingDeadlineExceeded()
        ):
            yield

    @contextlib.contextmanager
    def _give_up_after(self, seconds: int) -> Iterator[None]:
        def give_up(signum: int, frame: FrameType | None) -> None:
            raise WalkNeverEnded()

        previous_handler = signal.signal(signal.SIGALRM, give_up)

        signal.setitimer(signal.ITIMER_REAL, seconds)
        try:
            yield
        finally:
            signal.setitimer(signal.ITIMER_REAL, 0)

            signal.signal(signal.SIGALRM, previous_handler)
