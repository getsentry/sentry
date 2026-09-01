from __future__ import annotations

from datetime import timedelta
from types import SimpleNamespace
from typing import Any
from unittest import mock
from uuid import uuid4

import pytest
from django.utils import timezone

from sentry.investigations.models import (
    InvestigationBlock,
    InvestigationBlockExecution,
    InvestigationBlockExecutionStatus,
    InvestigationBlockKind,
    InvestigationOrchestrationCommandStatus,
)
from sentry.investigations.services.auto_run import schedule_eligible_auto_run_blocks
from sentry.investigations.services.orchestration import accept_orchestration_command
from sentry.seer.models import SeerApiError
from sentry.tasks.seer.investigation import (
    _mark_command_dispatch_failed,
    dispatch_investigation_execution,
    dispatch_investigation_orchestration_commands,
    dispatch_investigation_orchestration_create,
)
from sentry.testutils.cases import TestCase


class InvestigationAutoRunTest(TestCase):
    def setUp(self) -> None:
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.investigation = self.create_investigation(
            organization=self.organization,
            created_by=self.user,
        )
        self.create_investigation_project(investigation=self.investigation, project=self.project)
        self.root = self.create_investigation_block(
            investigation=self.investigation,
            position=0,
            kind=InvestigationBlockKind.QUERY,
            prompt="Chart the breach",
            config={"autoRun": True},
        )
        self.dependent = self.create_investigation_block(
            investigation=self.investigation,
            position=1,
            kind=InvestigationBlockKind.TEXT,
            prompt="Explain the chart",
            config={"autoRun": True},
        )
        self.create_investigation_block_dependency(block=self.dependent, depends_on=self.root)

    @mock.patch("sentry.tasks.seer.investigation.dispatch_investigation_execution")
    def test_dispatches_in_dependency_order(self, dispatch: mock.Mock) -> None:
        with self.captureOnCommitCallbacks(execute=True):
            schedule_eligible_auto_run_blocks(
                investigation_id=self.investigation.id,
                user_id=self.user.id,
            )

        self.root.refresh_from_db()
        self.dependent.refresh_from_db()
        assert self.root.current_execution is not None
        assert self.root.current_execution.status == InvestigationBlockExecutionStatus.PENDING
        assert self.dependent.current_execution is None
        dispatch.delay.assert_called_once_with(self.root.current_execution.id)

        self.root.current_execution.update(
            status=InvestigationBlockExecutionStatus.COMPLETED,
            result={
                "schemaVersion": 1,
                "tableMarkdown": "| count |\n| --- |\n| 1 |",
                "chart": None,
                "preferredView": "table",
                "isEmpty": False,
                "chartUnavailableReason": None,
                "queryLinks": [],
            },
        )
        self.root.result_execution = self.root.current_execution
        self.root.save(update_fields=["result_execution", "date_updated"])
        self.root.refresh_from_db()
        assert self.root.stale_at is None
        assert self.root.result_execution is not None
        assert self.root.result_execution.status == InvestigationBlockExecutionStatus.COMPLETED
        dispatch.delay.reset_mock()

        with self.captureOnCommitCallbacks(execute=True):
            schedule_eligible_auto_run_blocks(
                investigation_id=self.investigation.id,
                user_id=self.user.id,
            )

        dependent = InvestigationBlock.objects.get(id=self.dependent.id)
        assert dependent.current_execution is not None
        assert dependent.current_execution.status == InvestigationBlockExecutionStatus.PENDING
        dispatch.delay.assert_called_once_with(dependent.current_execution.id)

    @mock.patch("sentry.tasks.seer.investigation.dispatch_investigation_execution")
    def test_redispatches_an_existing_pending_execution(self, dispatch: mock.Mock) -> None:
        with self.captureOnCommitCallbacks(execute=True):
            schedule_eligible_auto_run_blocks(
                investigation_id=self.investigation.id,
                user_id=self.user.id,
            )
        self.root.refresh_from_db()
        execution_id = self.root.current_execution_id
        assert execution_id is not None
        dispatch.delay.reset_mock()

        with self.captureOnCommitCallbacks(execute=True):
            schedule_eligible_auto_run_blocks(
                investigation_id=self.investigation.id,
                user_id=self.user.id,
            )

        self.root.refresh_from_db()
        assert self.root.current_execution_id == execution_id
        assert InvestigationBlockExecution.objects.filter(block=self.root).count() == 1
        dispatch.delay.assert_called_once_with(execution_id)

    @mock.patch("sentry.tasks.seer.investigation.start_execution_run")
    def test_duplicate_dispatches_only_start_one_run(self, start_execution_run: mock.Mock) -> None:
        with self.captureOnCommitCallbacks(execute=False):
            schedule_eligible_auto_run_blocks(
                investigation_id=self.investigation.id,
                user_id=self.user.id,
            )
        self.root.refresh_from_db()
        execution_id = self.root.current_execution_id
        assert execution_id is not None

        dispatch_investigation_execution(execution_id)
        dispatch_investigation_execution(execution_id)

        start_execution_run.assert_called_once()

    @mock.patch("sentry.tasks.seer.investigation.start_execution_run")
    def test_stale_dispatch_claim_can_be_reclaimed(self, start_execution_run: mock.Mock) -> None:
        with self.captureOnCommitCallbacks(execute=False):
            schedule_eligible_auto_run_blocks(
                investigation_id=self.investigation.id,
                user_id=self.user.id,
            )
        self.root.refresh_from_db()
        execution = self.root.current_execution
        assert execution is not None

        dispatch_investigation_execution(execution.id)
        execution.update(started_at=timezone.now() - timedelta(minutes=6))
        dispatch_investigation_execution(execution.id)

        assert start_execution_run.call_count == 2

    @mock.patch("sentry.tasks.seer.investigation.dispatch_investigation_execution")
    def test_redispatches_a_stale_dispatch_claim(self, dispatch: mock.Mock) -> None:
        with self.captureOnCommitCallbacks(execute=False):
            schedule_eligible_auto_run_blocks(
                investigation_id=self.investigation.id,
                user_id=self.user.id,
            )
        self.root.refresh_from_db()
        execution = self.root.current_execution
        assert execution is not None
        execution.update(
            status=InvestigationBlockExecutionStatus.RUNNING,
            started_at=timezone.now() - timedelta(minutes=6),
        )
        dispatch.delay.reset_mock()

        with self.captureOnCommitCallbacks(execute=True):
            schedule_eligible_auto_run_blocks(
                investigation_id=self.investigation.id,
                user_id=self.user.id,
            )

        dispatch.delay.assert_called_once_with(execution.id)

    @mock.patch("sentry.tasks.seer.investigation.dispatch_investigation_execution")
    def test_does_not_start_more_cells_after_a_current_execution_fails(
        self, dispatch: mock.Mock
    ) -> None:
        failed_execution = self.create_investigation_block_execution(
            block=self.root,
            executor="code_mode",
            status=InvestigationBlockExecutionStatus.FAILED,
            block_version=self.root.version,
        )
        self.root.current_execution = failed_execution
        self.root.save(update_fields=["current_execution"])
        independent = self.create_investigation_block(
            investigation=self.investigation,
            position=2,
            kind=InvestigationBlockKind.QUERY,
            prompt="Compare releases",
            config={"autoRun": True},
        )

        with self.captureOnCommitCallbacks(execute=True):
            schedule_eligible_auto_run_blocks(
                investigation_id=self.investigation.id,
                user_id=self.user.id,
            )

        independent.refresh_from_db()
        assert independent.current_execution is None
        dispatch.delay.assert_not_called()

    @mock.patch(
        "sentry.tasks.seer.investigation.start_execution_run",
        side_effect=RuntimeError("Seer unavailable"),
    )
    @mock.patch("sentry.tasks.seer.investigation.record_execution_failed")
    def test_dispatch_failure_cancels_other_active_cells(
        self, record_failed: mock.Mock, start_run: mock.Mock
    ) -> None:
        failed_execution = self.create_investigation_block_execution(
            block=self.root,
            executor="code_mode",
            status=InvestigationBlockExecutionStatus.PENDING,
            block_version=self.root.version,
        )
        self.root.current_execution = failed_execution
        self.root.save(update_fields=["current_execution"])
        sibling_execution = self.create_investigation_block_execution(
            block=self.dependent,
            executor="text_generation",
            status=InvestigationBlockExecutionStatus.RUNNING,
            block_version=self.dependent.version,
        )
        self.dependent.current_execution = sibling_execution
        self.dependent.save(update_fields=["current_execution"])

        dispatch_investigation_execution(failed_execution.id)

        failed_execution.refresh_from_db()
        sibling_execution.refresh_from_db()
        assert failed_execution.status == InvestigationBlockExecutionStatus.FAILED
        assert sibling_execution.status == InvestigationBlockExecutionStatus.CANCELLED
        assert sibling_execution.error == {
            "code": "investigation_execution_failed",
            "message": "Cancelled because another cell in this investigation failed.",
        }
        record_failed.assert_called_once_with(
            failed_execution, reason="dispatch_failed", seer_run_id=None
        )
        start_run.assert_called_once()


class InvestigationOrchestrationDispatchTest(TestCase):
    seer_run_id = 8128

    def setUp(self) -> None:
        super().setUp()
        self.investigation = self.create_investigation(
            organization=self.organization,
            created_by=self.user,
            source={"type": "manual"},
        )
        self.orchestration_run = self.create_investigation_orchestration_run(
            investigation=self.investigation,
            source={
                "type": "manual",
                "prompt": "Investigate checkout latency",
                "timeRange": {
                    "start": "2025-01-01T00:00:00+00:00",
                    "end": "2025-01-01T01:00:00+00:00",
                },
            },
            projection=self.projection(workflow_version=1),
        )

    def projection(
        self,
        *,
        workflow_version: int,
        generation: int = 1,
        phase: str = "broad_scan",
        status: str = "processing",
    ) -> dict[str, Any]:
        return {
            "runId": self.seer_run_id,
            "investigationId": str(self.investigation.id),
            "sourceType": "manual",
            "workflowVersion": workflow_version,
            "generation": generation,
            "phase": phase,
            "status": status,
            "broadScan": {"status": "running"},
            "hypotheses": [],
            "report": {
                "revision": 0,
                "status": "not_started",
                "notebookRevision": 0,
                "metadata": {
                    "status": "not_started",
                    "title": None,
                    "summary": None,
                    "summaryDescription": None,
                    "error": None,
                },
            },
            "pendingInput": None,
            "errors": [],
            "heartbeatAt": "2025-01-01T00:00:00+00:00",
        }

    @mock.patch(
        "sentry.tasks.seer.investigation.dispatch_investigation_orchestration_commands.delay"
    )
    @mock.patch("sentry.tasks.seer.investigation.create_investigation_orchestration_run")
    def test_create_dispatch_persists_projection_and_starts_commands(
        self,
        create_run: mock.Mock,
        dispatch_commands: mock.Mock,
    ) -> None:
        create_run.return_value = {
            "runId": self.seer_run_id,
            "projection": self.projection(workflow_version=1),
        }

        dispatch_investigation_orchestration_create(self.orchestration_run.id)

        self.orchestration_run.refresh_from_db()
        assert self.orchestration_run.seer_run_id == self.seer_run_id
        assert self.orchestration_run.phase == "broad_scan"
        assert self.orchestration_run.status == "processing"
        assert create_run.call_args.kwargs["viewer_context"] == {
            "organization_id": self.organization.id,
            "user_id": self.user.id,
        }
        dispatch_commands.assert_called_once_with(self.orchestration_run.id)

    @mock.patch("sentry.tasks.seer.investigation.current_task")
    @mock.patch("sentry.tasks.seer.investigation.create_investigation_orchestration_run")
    def test_create_dispatch_retries_then_persists_retryable_failure(
        self,
        create_run: mock.Mock,
        current_task: mock.Mock,
    ) -> None:
        create_run.side_effect = SeerApiError("unavailable: secret=do-not-expose", 503)
        current_task.return_value = SimpleNamespace(retries_remaining=True)

        with pytest.raises(SeerApiError):
            dispatch_investigation_orchestration_create(self.orchestration_run.id)
        self.orchestration_run.refresh_from_db()
        assert self.orchestration_run.status == "pending"

        current_task.return_value = SimpleNamespace(retries_remaining=False)
        dispatch_investigation_orchestration_create(self.orchestration_run.id)
        self.orchestration_run.refresh_from_db()
        assert self.orchestration_run.status == "failed"
        assert self.orchestration_run.error == {
            "code": "seer_dispatch_failed",
            "message": "Unable to start this investigation. Try again.",
            "retryable": True,
        }
        assert "do-not-expose" not in str(self.orchestration_run.projection)

    @mock.patch("sentry.tasks.seer.investigation.dispatch_investigation_orchestration_command")
    def test_command_dispatch_acknowledges_in_order(self, dispatch: mock.Mock) -> None:
        self.orchestration_run.seer_run_id = self.seer_run_id
        self.orchestration_run.workflow_version = 3
        self.orchestration_run.projection = self.projection(workflow_version=3)
        self.orchestration_run.save()
        first = self.create_investigation_orchestration_command(
            orchestration_run=self.orchestration_run,
            request_id=uuid4(),
            actor_id=self.user.id,
            expected_workflow_version=1,
            resulting_workflow_version=2,
            type="add_hypothesis",
            payload={"statement": "A release caused this"},
        )
        second = self.create_investigation_orchestration_command(
            orchestration_run=self.orchestration_run,
            request_id=uuid4(),
            actor_id=self.user.id,
            expected_workflow_version=2,
            resulting_workflow_version=3,
            type="cancel",
            payload={},
        )
        dispatch.side_effect = [
            {
                "runId": self.seer_run_id,
                "requestId": str(first.request_id),
                "projection": self.projection(workflow_version=2),
            },
            {
                "runId": self.seer_run_id,
                "requestId": str(second.request_id),
                "projection": self.projection(workflow_version=3),
            },
        ]

        dispatch_investigation_orchestration_commands(self.orchestration_run.id)

        first.refresh_from_db()
        second.refresh_from_db()
        assert first.status == InvestigationOrchestrationCommandStatus.ACKNOWLEDGED
        assert second.status == InvestigationOrchestrationCommandStatus.ACKNOWLEDGED
        assert [call.args[0].id for call in dispatch.call_args_list] == [first.id, second.id]
        assert dispatch.call_args.kwargs["viewer_context"] == {
            "organization_id": self.organization.id,
            "user_id": self.user.id,
        }

    @mock.patch("sentry.tasks.seer.investigation.dispatch_investigation_orchestration_create.delay")
    def test_command_dispatch_repairs_a_missing_parent_run(
        self, dispatch_create: mock.Mock
    ) -> None:
        command = self.create_investigation_orchestration_command(
            orchestration_run=self.orchestration_run,
            request_id=uuid4(),
            actor_id=self.user.id,
            expected_workflow_version=1,
            resulting_workflow_version=2,
            type="provide_input",
            payload={"prompt": "Investigate checkout latency"},
        )

        dispatch_investigation_orchestration_commands(self.orchestration_run.id)

        command.refresh_from_db()
        assert command.status == InvestigationOrchestrationCommandStatus.ACCEPTED
        dispatch_create.assert_called_once_with(self.orchestration_run.id)

    @mock.patch("sentry.tasks.seer.investigation.current_task")
    @mock.patch("sentry.tasks.seer.investigation.dispatch_investigation_orchestration_command")
    def test_failed_command_can_redeliver_the_same_idempotent_request(
        self,
        dispatch: mock.Mock,
        current_task: mock.Mock,
    ) -> None:
        self.orchestration_run.seer_run_id = self.seer_run_id
        self.orchestration_run.workflow_version = 2
        self.orchestration_run.projection = self.projection(workflow_version=2)
        self.orchestration_run.save()
        request_id = uuid4()
        command = self.create_investigation_orchestration_command(
            orchestration_run=self.orchestration_run,
            request_id=request_id,
            actor_id=self.user.id,
            expected_workflow_version=1,
            resulting_workflow_version=2,
            type="add_hypothesis",
            payload={"statement": "A release caused this"},
        )
        current_task.return_value = SimpleNamespace(retries_remaining=False)
        dispatch.side_effect = SeerApiError("unavailable: token=do-not-expose", 503)

        dispatch_investigation_orchestration_commands(self.orchestration_run.id)

        command.refresh_from_db()
        self.orchestration_run.refresh_from_db()
        assert command.status == InvestigationOrchestrationCommandStatus.FAILED
        assert self.orchestration_run.error == {
            "code": "seer_command_dispatch_failed",
            "message": "Unable to deliver this investigation command. Try again.",
            "requestId": str(request_id),
            "commandType": "add_hypothesis",
            "retryable": True,
        }
        assert "do-not-expose" not in str(self.orchestration_run.projection)

        with mock.patch(
            "sentry.investigations.services.orchestration.transaction.on_commit"
        ) as schedule:
            accepted = accept_orchestration_command(
                investigation=self.investigation,
                request_id=request_id,
                expected_workflow_version=1,
                command_type="add_hypothesis",
                payload={"statement": "A release caused this"},
                actor_id=self.user.id,
            )
        assert accepted.duplicate is True
        assert accepted.status == InvestigationOrchestrationCommandStatus.ACCEPTED
        assert accepted.error is None
        command.refresh_from_db()
        assert command.status == InvestigationOrchestrationCommandStatus.ACCEPTED
        schedule.assert_called_once()

        dispatch.side_effect = None
        dispatch.return_value = {
            "runId": self.seer_run_id,
            "requestId": str(request_id),
            "projection": self.projection(workflow_version=2),
        }
        dispatch_investigation_orchestration_commands(self.orchestration_run.id)
        command.refresh_from_db()
        self.orchestration_run.refresh_from_db()
        assert command.status == InvestigationOrchestrationCommandStatus.ACKNOWLEDGED
        assert self.orchestration_run.error is None
        assert self.orchestration_run.projection["errors"] == []

    @mock.patch("sentry.tasks.seer.investigation.dispatch_investigation_orchestration_command")
    def test_late_success_recovers_commands_blocked_by_a_dispatch_failure(
        self,
        dispatch: mock.Mock,
    ) -> None:
        self.orchestration_run.seer_run_id = self.seer_run_id
        self.orchestration_run.workflow_version = 3
        self.orchestration_run.projection = self.projection(workflow_version=3)
        self.orchestration_run.save()
        first = self.create_investigation_orchestration_command(
            orchestration_run=self.orchestration_run,
            request_id=uuid4(),
            actor_id=self.user.id,
            expected_workflow_version=1,
            resulting_workflow_version=2,
            type="add_hypothesis",
            payload={"statement": "A release caused this"},
        )
        second = self.create_investigation_orchestration_command(
            orchestration_run=self.orchestration_run,
            request_id=uuid4(),
            actor_id=self.user.id,
            expected_workflow_version=2,
            resulting_workflow_version=3,
            type="cancel",
            payload={},
        )

        def dispatch_with_racing_failure(command: Any, **kwargs: Any) -> dict[str, Any]:
            if command.id == first.id:
                _mark_command_dispatch_failed(first.id)
            return {
                "runId": self.seer_run_id,
                "requestId": str(command.request_id),
                "projection": self.projection(workflow_version=command.resulting_workflow_version),
            }

        dispatch.side_effect = dispatch_with_racing_failure
        dispatch_investigation_orchestration_commands(self.orchestration_run.id)

        first.refresh_from_db()
        second.refresh_from_db()
        assert first.status == InvestigationOrchestrationCommandStatus.ACKNOWLEDGED
        assert second.status == InvestigationOrchestrationCommandStatus.ACKNOWLEDGED
        assert second.error is None
        assert [call.args[0].id for call in dispatch.call_args_list] == [first.id, second.id]

    @mock.patch("sentry.tasks.seer.investigation.current_task")
    @mock.patch("sentry.tasks.seer.investigation.get_investigation_orchestration_run")
    @mock.patch("sentry.tasks.seer.investigation.dispatch_investigation_orchestration_command")
    def test_command_conflict_reconciliation_retries_then_persists_failure(
        self,
        dispatch: mock.Mock,
        get_run: mock.Mock,
        current_task: mock.Mock,
    ) -> None:
        self.orchestration_run.seer_run_id = self.seer_run_id
        self.orchestration_run.workflow_version = 2
        self.orchestration_run.projection = self.projection(workflow_version=2)
        self.orchestration_run.save()
        command = self.create_investigation_orchestration_command(
            orchestration_run=self.orchestration_run,
            request_id=uuid4(),
            actor_id=self.user.id,
            expected_workflow_version=1,
            resulting_workflow_version=2,
            type="add_hypothesis",
            payload={"statement": "A release caused this"},
        )
        dispatch.side_effect = SeerApiError("conflict", 409)
        get_run.side_effect = SeerApiError("unavailable", 503)
        current_task.return_value = SimpleNamespace(retries_remaining=True)

        with pytest.raises(SeerApiError):
            dispatch_investigation_orchestration_commands(self.orchestration_run.id)
        command.refresh_from_db()
        assert command.status == InvestigationOrchestrationCommandStatus.DISPATCHED

        current_task.return_value = SimpleNamespace(retries_remaining=False)
        dispatch_investigation_orchestration_commands(self.orchestration_run.id)

        command.refresh_from_db()
        assert command.status == InvestigationOrchestrationCommandStatus.FAILED
        assert command.error["code"] == "seer_command_dispatch_failed"
        assert command.error["retryable"] is True

    @mock.patch("sentry.tasks.seer.investigation.get_investigation_orchestration_run")
    @mock.patch("sentry.tasks.seer.investigation.dispatch_investigation_orchestration_command")
    def test_command_version_conflict_reconciles_and_fails_stale_queue(
        self,
        dispatch: mock.Mock,
        get_run: mock.Mock,
    ) -> None:
        self.orchestration_run.seer_run_id = self.seer_run_id
        self.orchestration_run.workflow_version = 12
        self.orchestration_run.generation = 3
        self.orchestration_run.projection = self.projection(
            workflow_version=12,
            generation=3,
            phase="intake",
            status="awaiting_input",
        )
        self.orchestration_run.save()
        request_id = uuid4()
        command = self.create_investigation_orchestration_command(
            orchestration_run=self.orchestration_run,
            request_id=request_id,
            actor_id=self.user.id,
            expected_workflow_version=2,
            resulting_workflow_version=3,
            type="provide_input",
            payload={"prompt": "Investigate checkout latency"},
        )
        later_command = self.create_investigation_orchestration_command(
            orchestration_run=self.orchestration_run,
            request_id=uuid4(),
            actor_id=self.user.id,
            expected_workflow_version=3,
            resulting_workflow_version=4,
            type="add_hypothesis",
            payload={"statement": "A release caused this"},
        )
        dispatch.side_effect = SeerApiError("conflict", 409)
        authoritative_error = {
            "code": "broad_scan_failed",
            "message": "The broad investigation failed.",
            "retryable": True,
        }
        authoritative_projection = {
            **self.projection(
                workflow_version=7,
                generation=2,
                phase="failed",
                status="failed",
            ),
            "broadScan": {"status": "failed", "error": authoritative_error},
            "errors": [authoritative_error],
            "error": authoritative_error,
        }
        get_run.return_value = {
            "runId": self.seer_run_id,
            "created": False,
            "projection": authoritative_projection,
        }

        dispatch_investigation_orchestration_commands(self.orchestration_run.id)

        self.orchestration_run.refresh_from_db()
        command.refresh_from_db()
        later_command.refresh_from_db()
        assert self.orchestration_run.workflow_version == 7
        assert self.orchestration_run.generation == 2
        assert self.orchestration_run.phase == "failed"
        assert self.orchestration_run.status == "failed"
        assert self.orchestration_run.error == authoritative_error
        assert command.status == InvestigationOrchestrationCommandStatus.FAILED
        assert command.error == {
            "code": "seer_command_dispatch_failed",
            "message": (
                "The investigation changed before this update could be applied. "
                "Progress was refreshed; try again."
            ),
            "requestId": str(request_id),
            "commandType": "provide_input",
            "reason": "workflow_version_conflict",
            "retryable": False,
        }
        assert later_command.status == InvestigationOrchestrationCommandStatus.FAILED
        assert later_command.error["code"] == "earlier_command_conflicted"

        with mock.patch(
            "sentry.investigations.services.orchestration.transaction.on_commit"
        ) as schedule:
            accepted = accept_orchestration_command(
                investigation=self.investigation,
                request_id=request_id,
                expected_workflow_version=2,
                command_type="provide_input",
                payload={"prompt": "Investigate checkout latency"},
                actor_id=self.user.id,
            )
        assert accepted.duplicate is True
        assert accepted.status == InvestigationOrchestrationCommandStatus.FAILED
        assert accepted.error == command.error
        command.refresh_from_db()
        assert command.status == InvestigationOrchestrationCommandStatus.FAILED
        schedule.assert_not_called()

    @mock.patch("sentry.tasks.seer.investigation.current_task")
    @mock.patch("sentry.tasks.seer.investigation.create_investigation_orchestration_run")
    def test_retry_run_recovers_an_initial_create_failure_without_version_drift(
        self,
        create_run: mock.Mock,
        current_task: mock.Mock,
    ) -> None:
        create_run.side_effect = SeerApiError("unavailable", 503)
        current_task.return_value = SimpleNamespace(retries_remaining=False)
        dispatch_investigation_orchestration_create(self.orchestration_run.id)
        self.orchestration_run.refresh_from_db()
        assert self.orchestration_run.status == "failed"

        request_id = uuid4()
        with mock.patch(
            "sentry.investigations.services.orchestration.transaction.on_commit"
        ) as schedule:
            accepted = accept_orchestration_command(
                investigation=self.investigation,
                request_id=request_id,
                expected_workflow_version=1,
                command_type="retry",
                payload={"target": "run"},
                actor_id=self.user.id,
            )

        assert accepted.workflow_version == 1
        self.orchestration_run.refresh_from_db()
        assert self.orchestration_run.workflow_version == 1
        assert self.orchestration_run.phase == "broad_scan"
        assert self.orchestration_run.status == "pending"
        assert self.orchestration_run.error is None
        command = self.orchestration_run.commands.get(request_id=request_id)
        assert command.status == InvestigationOrchestrationCommandStatus.ACKNOWLEDGED
        assert command.resulting_workflow_version == 1
        schedule.assert_called_once()
