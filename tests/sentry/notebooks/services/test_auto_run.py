from __future__ import annotations

from datetime import timedelta
from unittest import mock

from django.utils import timezone

from sentry.notebooks.models import (
    NotebookBlockExecution,
    NotebookBlockExecutionStatus,
    NotebookBlockKind,
)
from sentry.notebooks.services.auto_run import schedule_eligible_auto_run_blocks
from sentry.notebooks.tasks import dispatch_notebook_execution
from sentry.testutils.cases import TestCase


class NotebookAutoRunTest(TestCase):
    def setUp(self) -> None:
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.notebook = self.create_notebook(
            organization=self.organization,
            created_by=self.user,
        )
        self.create_notebook_project(notebook=self.notebook, project=self.project)
        self.root = self.create_notebook_block(
            notebook=self.notebook,
            position=0,
            kind=NotebookBlockKind.QUERY,
            prompt="Chart the breach",
            config={"autoRun": True},
        )
        self.sibling = self.create_notebook_block(
            notebook=self.notebook,
            position=1,
            kind=NotebookBlockKind.TEXT,
            prompt="Explain the chart",
        )

    @mock.patch("sentry.notebooks.tasks.dispatch_notebook_execution")
    def test_dispatches_each_auto_run_block(self, dispatch: mock.Mock) -> None:
        self.sibling.update(config={"autoRun": True})

        with self.captureOnCommitCallbacks(execute=True):
            schedule_eligible_auto_run_blocks(
                notebook_id=self.notebook.id,
                user_id=self.user.id,
            )

        self.root.refresh_from_db()
        self.sibling.refresh_from_db()
        assert self.root.current_execution is not None
        assert self.sibling.current_execution is not None
        assert {call.args[0] for call in dispatch.delay.call_args_list} == {
            self.root.current_execution.id,
            self.sibling.current_execution.id,
        }

    @mock.patch("sentry.notebooks.tasks.dispatch_notebook_execution")
    def test_redispatches_an_existing_pending_execution(self, dispatch: mock.Mock) -> None:
        with self.captureOnCommitCallbacks(execute=True):
            schedule_eligible_auto_run_blocks(
                notebook_id=self.notebook.id,
                user_id=self.user.id,
            )
        self.root.refresh_from_db()
        execution_id = self.root.current_execution_id
        assert execution_id is not None
        dispatch.delay.reset_mock()

        with self.captureOnCommitCallbacks(execute=True):
            schedule_eligible_auto_run_blocks(
                notebook_id=self.notebook.id,
                user_id=self.user.id,
            )

        self.root.refresh_from_db()
        assert self.root.current_execution_id == execution_id
        assert NotebookBlockExecution.objects.filter(block=self.root).count() == 1
        dispatch.delay.assert_called_once_with(execution_id)

    @mock.patch("sentry.notebooks.tasks.start_execution_run")
    def test_duplicate_dispatches_only_start_one_run(self, start_execution_run: mock.Mock) -> None:
        with self.captureOnCommitCallbacks(execute=False):
            schedule_eligible_auto_run_blocks(
                notebook_id=self.notebook.id,
                user_id=self.user.id,
            )
        self.root.refresh_from_db()
        execution_id = self.root.current_execution_id
        assert execution_id is not None

        dispatch_notebook_execution(execution_id)
        dispatch_notebook_execution(execution_id)

        start_execution_run.assert_called_once()

    @mock.patch("sentry.notebooks.tasks.start_execution_run")
    def test_stale_dispatch_claim_can_be_reclaimed(self, start_execution_run: mock.Mock) -> None:
        with self.captureOnCommitCallbacks(execute=False):
            schedule_eligible_auto_run_blocks(
                notebook_id=self.notebook.id,
                user_id=self.user.id,
            )
        self.root.refresh_from_db()
        execution = self.root.current_execution
        assert execution is not None

        dispatch_notebook_execution(execution.id)
        execution.update(started_at=timezone.now() - timedelta(minutes=6))
        dispatch_notebook_execution(execution.id)

        assert start_execution_run.call_count == 2

    @mock.patch("sentry.notebooks.tasks.dispatch_notebook_execution")
    def test_redispatches_a_stale_dispatch_claim(self, dispatch: mock.Mock) -> None:
        with self.captureOnCommitCallbacks(execute=False):
            schedule_eligible_auto_run_blocks(
                notebook_id=self.notebook.id,
                user_id=self.user.id,
            )
        self.root.refresh_from_db()
        execution = self.root.current_execution
        assert execution is not None
        execution.update(
            status=NotebookBlockExecutionStatus.RUNNING,
            started_at=timezone.now() - timedelta(minutes=6),
        )
        dispatch.delay.reset_mock()

        with self.captureOnCommitCallbacks(execute=True):
            schedule_eligible_auto_run_blocks(
                notebook_id=self.notebook.id,
                user_id=self.user.id,
            )

        dispatch.delay.assert_called_once_with(execution.id)

    @mock.patch("sentry.notebooks.tasks.dispatch_notebook_execution")
    def test_does_not_start_more_cells_after_a_current_execution_fails(
        self, dispatch: mock.Mock
    ) -> None:
        failed_execution = self.create_notebook_block_execution(
            block=self.root,
            executor="code_mode",
            status=NotebookBlockExecutionStatus.FAILED,
            block_version=self.root.version,
        )
        self.root.current_execution = failed_execution
        self.root.save(update_fields=["current_execution"])
        independent = self.create_notebook_block(
            notebook=self.notebook,
            position=2,
            kind=NotebookBlockKind.QUERY,
            prompt="Compare releases",
            config={"autoRun": True},
        )

        with self.captureOnCommitCallbacks(execute=True):
            schedule_eligible_auto_run_blocks(
                notebook_id=self.notebook.id,
                user_id=self.user.id,
            )

        independent.refresh_from_db()
        assert independent.current_execution is None
        dispatch.delay.assert_not_called()

    @mock.patch(
        "sentry.notebooks.tasks.start_execution_run",
        side_effect=RuntimeError("Seer unavailable"),
    )
    @mock.patch("sentry.notebooks.tasks.record_execution_failed")
    def test_dispatch_failure_cancels_other_active_cells(
        self, record_failed: mock.Mock, start_run: mock.Mock
    ) -> None:
        failed_execution = self.create_notebook_block_execution(
            block=self.root,
            executor="code_mode",
            status=NotebookBlockExecutionStatus.PENDING,
            block_version=self.root.version,
        )
        self.root.current_execution = failed_execution
        self.root.save(update_fields=["current_execution"])
        sibling_execution = self.create_notebook_block_execution(
            block=self.sibling,
            executor="text_generation",
            status=NotebookBlockExecutionStatus.RUNNING,
            block_version=self.sibling.version,
        )
        self.sibling.current_execution = sibling_execution
        self.sibling.save(update_fields=["current_execution"])

        dispatch_notebook_execution(failed_execution.id)

        failed_execution.refresh_from_db()
        sibling_execution.refresh_from_db()
        assert failed_execution.status == NotebookBlockExecutionStatus.FAILED
        assert sibling_execution.status == NotebookBlockExecutionStatus.CANCELLED
        assert sibling_execution.error == {
            "code": "investigation_execution_failed",
            "message": "Cancelled because another cell in this investigation failed.",
        }
        record_failed.assert_called_once_with(
            failed_execution, reason="dispatch_failed", seer_run_id=None
        )
        start_run.assert_called_once()
