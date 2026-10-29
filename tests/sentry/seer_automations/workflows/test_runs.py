from copy import copy
from functools import partial
from unittest.mock import Mock, patch

import pytest
from django.test import override_settings
from pydantic import BaseModel

from sentry.hybridcloud.models.outbox import CellOutbox
from sentry.hybridcloud.outbox.category import OutboxCategory
from sentry.seer.agent.client import SeerAgentClient
from sentry.seer.models.run import SeerAgentRun, SeerRun, SeerRunMirrorStatus
from sentry.seer_automations.models.workflow import (
    SeerWorkflowConfig,
    SeerWorkflowExecutionExtras,
    SeerWorkflowExecutionStatus,
    SeerWorkflowRun,
    SeerWorkflowRunExecution,
    SeerWorkflowRunStatus,
    SeerWorkflowStrategy,
    WorkflowRunError,
)
from sentry.seer_automations.workflows.runs import (
    InvalidWorkflowTransition,
    SeerWorkflowRunLifecycle,
    create_workflow_run,
    deliver_workflow_result,
    finish_workflow_run,
    get_workflow_run_status,
)
from sentry.seer_automations.workflows.schemas import WorkflowResult
from sentry.seer_automations.workflows.workflow import SeerWorkflow, SelectedProjects
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories


class RunInputs(BaseModel):
    issue_limit: int


@override_settings(SENTRY_SELF_HOSTED=False)
class WorkflowRunTest(TestCase):
    def test_creation_links_execution_and_defers_dispatch(self) -> None:
        with patch("sentry.receivers.outbox.cell.make_feature_run_request") as dispatch:
            run = self.create_run()
        dispatch.assert_not_called()
        workflow = run.workflow_execution.run
        assert workflow.organization_id == self.organization.id
        assert workflow.date_completed is None
        assert workflow.workflow_config is not None
        assert workflow.workflow_config.strategy == SeerWorkflowStrategy.AGENTIC_TRIAGE
        assert run.agent.extras == {
            "status": "running",
            "error": None,
            "summary": None,
        }
        outbox = CellOutbox.objects.get(
            category=OutboxCategory.SEER_RUN_CREATE, object_identifier=run.id
        )
        assert outbox.payload is not None
        assert outbox.payload["body"]["feature_id"] == "test_workflow"
        assert outbox.payload["viewer_context"]["user_id"] == self.user.id

    def test_creation_rolls_back_if_execution_creation_fails(self) -> None:
        with (
            patch(
                "sentry.seer_automations.workflows.runs.SeerWorkflowRunExecution.objects.create",
                side_effect=RuntimeError("Cannot create execution"),
            ),
            pytest.raises(RuntimeError, match="Cannot create execution"),
        ):
            self.create_run()
        assert not SeerWorkflowRun.objects.filter(organization=self.organization).exists()
        assert not SeerRun.objects.filter(organization=self.organization).exists()
        assert not SeerAgentRun.objects.filter(run__organization=self.organization).exists()
        assert not CellOutbox.objects.filter(category=OutboxCategory.SEER_RUN_CREATE).exists()

    def test_delivery_stores_feature_results_and_ignores_duplicates(self) -> None:
        run = self.create_run()
        parser = Mock(return_value=WorkflowResult(extras={"summary": "Finished"}, status="partial"))
        deliver = partial(
            deliver_workflow_result,
            feature_id="test_workflow",
            organization_id=self.organization.id,
            run_uuid=run.uuid,
            parse_result=parser,
        )
        deliver(status="completed", result={"raw": "output"}, error=None)
        run.agent.refresh_from_db()
        assert run.agent.extras["status"] == "partial"
        assert run.agent.extras["summary"] == "Finished"
        workflow = run.workflow_execution.run
        workflow.refresh_from_db()
        assert workflow.date_completed is not None
        assert "date_completed" not in run.agent.extras
        parser.assert_called_once_with({"raw": "output"}, run.agent)
        completed_extras = run.agent.extras.copy()
        completed_at = workflow.date_completed

        deliver(status="error", result=None, error="Late failure")
        finish_workflow_run(
            run.id,
            organization_id=self.organization.id,
            feature_id="test_workflow",
            error="Late failure",
        )
        run.agent.refresh_from_db()
        assert run.agent.extras == completed_extras
        workflow.refresh_from_db()
        assert workflow.date_completed == completed_at

    def test_delivery_and_finish_are_scoped_to_organization_and_feature(self) -> None:
        run = self.create_run()
        parser = Mock()
        deliver = partial(
            deliver_workflow_result,
            run_uuid=run.uuid,
            status="completed",
            result={},
            error=None,
            parse_result=parser,
        )
        other_org = self.create_organization()
        deliver(organization_id=other_org.id, feature_id="test_workflow")
        deliver(organization_id=self.organization.id, feature_id="another_workflow")
        finish_workflow_run(
            run.id, organization_id=other_org.id, feature_id="test_workflow", error="Wrong org"
        )
        finish_workflow_run(
            run.id,
            organization_id=self.organization.id,
            feature_id="another_workflow",
            error="Wrong workflow",
        )
        parser.assert_not_called()
        run.agent.refresh_from_db()
        assert run.agent.extras["status"] == "running"
        assert SeerWorkflowRun.objects.get(executions__seer_run=run).date_completed is None

    def test_failed_delivery_records_safe_error_without_parsing(self) -> None:
        run = self.create_run()
        parser = Mock()
        deliver_workflow_result(
            feature_id="test_workflow",
            organization_id=self.organization.id,
            run_uuid=run.uuid,
            status="error",
            result=None,
            error="Internal error details",
            parse_result=parser,
        )
        parser.assert_not_called()
        run.agent.refresh_from_db()
        assert run.agent.extras["status"] == "failed"
        assert SeerWorkflowRun.objects.get(executions__seer_run=run).date_completed is not None
        assert run.agent.extras["error"] == "Seer could not complete this workflow."

    def test_dispatch_failure_is_reported_without_overwriting_a_completed_result(self) -> None:
        run = self.create_run()
        run.update(mirror_status=SeerRunMirrorStatus.FAILED)
        assert get_workflow_run_status(run.agent) == {
            "status": "failed",
            "error": "Seer could not start this workflow.",
        }
        finish_workflow_run(
            run.id,
            organization_id=self.organization.id,
            feature_id="test_workflow",
            result=WorkflowResult(extras={"summary": "Finished"}),
        )
        run.agent.refresh_from_db()
        status = get_workflow_run_status(run.agent)
        assert status["status"] == "complete"
        assert SeerWorkflowRun.objects.get(executions__seer_run=run).date_completed is not None
        assert status["error"] is None

    def create_run(self) -> SeerRun:
        workflow = create_workflow_run(
            SeerAgentClient(self.organization, self.user),
            strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE,
            feature_id="test_workflow",
            title="Test workflow",
            payload={},
            extras={"summary": None},
        )
        run = workflow.executions.get().seer_run
        assert run is not None
        return run


class SeerWorkflowRunLifecycleTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.workflow = SeerWorkflow(
            Factories.create_seer_workflow_config(
                self.organization,
                strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,
                filters={"all_projects": True},
            )
        )

    def test_config_changes_only_apply_to_new_runs(self) -> None:
        original_project = self.create_project()
        original_result = self.workflow.get_or_create_run(
            trigger_key="manual:first", inputs=RunInputs(issue_limit=10)
        )
        original_run = original_result.lifecycle
        assert original_result.created is True
        assert original_run.get_run().status == SeerWorkflowRunStatus.QUEUED
        assert not original_run.get_run().executions.exists()
        snapshot = original_run.extras.snapshot
        assert snapshot.config_version == 1
        assert snapshot.project_ids == (original_project.id,)
        assert snapshot.inputs == {"issue_limit": 10}

        new_project = self.create_project()
        self.workflow.set_project_selection(SelectedProjects(project_ids=(new_project.id,)))
        retry_result = self.workflow.get_or_create_run(
            trigger_key="manual:first", inputs=RunInputs(issue_limit=20)
        )
        retried_run = retry_result.lifecycle
        assert retry_result.created is False
        assert retried_run.run_id == original_run.run_id
        assert retried_run.extras.snapshot == snapshot

        new_result = self.workflow.get_or_create_run(
            trigger_key="manual:next", inputs=RunInputs(issue_limit=20)
        )
        new_run = new_result.lifecycle
        assert new_result.created is True
        assert new_run.run_id != original_run.run_id
        assert new_run.extras.snapshot.config_version == 2
        assert new_run.extras.snapshot.project_ids == (new_project.id,)
        assert new_run.extras.snapshot.inputs == {"issue_limit": 20}

    def test_request_identity_and_history_are_scoped_to_config_and_organization(self) -> None:
        other_workflow = SeerWorkflow(
            Factories.create_seer_workflow_config(
                self.organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2
            )
        )
        first_result = self.workflow.get_or_create_run(
            trigger_key="event:occurrence", inputs=RunInputs(issue_limit=10)
        )
        first = first_result.lifecycle
        second_result = other_workflow.get_or_create_run(
            trigger_key="event:occurrence", inputs=RunInputs(issue_limit=10)
        )
        second = second_result.lifecycle
        assert second_result.created is True
        assert first.run_id != second.run_id
        legacy = Factories.create_seer_workflow_run(
            self.organization, workflow_config=self.workflow.config
        )
        assert list(self.workflow.get_runs()) == [legacy, first.get_run()]
        assert list(other_workflow.get_runs()) == [second.get_run()]

        other_org = self.create_organization()
        wrong_org_config = copy(self.workflow.config)
        wrong_org_config.organization_id = other_org.id
        wrong_org_workflow = SeerWorkflow(wrong_org_config)
        assert not wrong_org_workflow.get_runs().exists()
        with pytest.raises(SeerWorkflowConfig.DoesNotExist):
            wrong_org_workflow.get_or_create_run(
                trigger_key="event:occurrence", inputs=RunInputs(issue_limit=10)
            )
        wrong_org_run = SeerWorkflowRunLifecycle(organization_id=other_org.id, run_id=first.run_id)
        with pytest.raises(SeerWorkflowRun.DoesNotExist):
            wrong_org_run.get_run()
        with pytest.raises(SeerWorkflowRun.DoesNotExist):
            wrong_org_run.start()
        assert first.get_run().status == SeerWorkflowRunStatus.QUEUED
        assert first.get_run().date_completed is None

    def test_lifecycle_reads_updates_from_another_instance(self) -> None:
        run = self.create_run()
        other = SeerWorkflowRunLifecycle(organization_id=self.organization.id, run_id=run.run_id)
        other.start()
        assert run.get_run().status == SeerWorkflowRunStatus.RUNNING

        failure = WorkflowRunError(code="selection_failed", message="Work selection failed")
        other.fail(error=failure)
        assert run.get_run().status == SeerWorkflowRunStatus.FAILED
        assert run.extras.error == failure

    def test_started_work_cannot_be_restarted(self) -> None:
        run = self.create_run()
        run.start()
        with pytest.raises(InvalidWorkflowTransition):
            run.start()
        (execution,) = self.create_executions(run)
        run.start_execution(execution.id)
        with pytest.raises(InvalidWorkflowTransition):
            run.start_execution(execution.id)

    def test_empty_plan_completes_the_run_and_allows_exact_retries(self) -> None:
        run = self.create_running_run()
        assert run.create_executions([]) == []
        assert run.get_run().status == SeerWorkflowRunStatus.COMPLETE
        assert run.get_run().date_completed is not None
        assert not run.get_run().executions.exists()
        completed_at = run.get_run().date_completed

        assert run.create_executions([]) == []
        assert run.get_run().date_completed == completed_at

    def test_orchestration_failure_preserves_snapshot_and_allows_exact_retries(self) -> None:
        run = self.create_run()
        snapshot = run.extras.snapshot
        failure = WorkflowRunError(code="selection_failed", message="Work selection failed")
        failed = run.fail(error=failure)
        assert failed.status == SeerWorkflowRunStatus.FAILED
        assert run.extras.error == failure
        assert failed.date_completed is not None
        assert run.extras.snapshot == snapshot
        assert not failed.executions.exists()
        completed_at = failed.date_completed

        assert run.fail(error=failure).date_completed == completed_at
        with pytest.raises(InvalidWorkflowTransition):
            run.fail(WorkflowRunError(code="different_error", message="Different failure"))
        assert run.extras.error == failure
        assert run.get_run().date_completed == completed_at

    def test_run_failure_cannot_replace_execution_results(self) -> None:
        run = self.create_running_run()
        self.create_executions(run)
        with pytest.raises(InvalidWorkflowTransition):
            run.fail(WorkflowRunError(code="selection_failed", message="Selection failed"))
        assert run.get_run().status == SeerWorkflowRunStatus.RUNNING
        assert run.get_run().date_completed is None

    def test_execution_transitions_are_scoped_to_run(self) -> None:
        run = self.create_running_run()
        (execution,) = self.create_executions(run)
        other = self.create_running_run(trigger_key="manual:other")
        with pytest.raises(SeerWorkflowRunExecution.DoesNotExist):
            other.start_execution(execution.id)
        with pytest.raises(SeerWorkflowRunExecution.DoesNotExist):
            other.complete_execution(execution.id)
        execution.refresh_from_db()
        assert execution.status == SeerWorkflowExecutionStatus.QUEUED
        assert run.get_run().date_completed is None
        assert other.get_run().date_completed is None

    def test_queued_execution_keeps_parent_running(self) -> None:
        run = self.create_running_run()
        first, queued = self.create_executions(run, count=2)
        run.start_execution(first.id)
        run.complete_execution(first.id)
        assert run.get_run().status == SeerWorkflowRunStatus.RUNNING
        assert run.get_run().date_completed is None
        queued.refresh_from_db()
        assert queued.status == SeerWorkflowExecutionStatus.QUEUED

        failure = WorkflowRunError(code="dispatch_failed", message="Could not start execution")
        failed = run.complete_execution(queued.id, error=failure)
        assert run.get_run().status == SeerWorkflowRunStatus.FAILED
        assert SeerWorkflowExecutionExtras.parse_obj(failed.extras).error == failure
        assert run.extras.error is None
        assert run.get_run().date_completed is not None

    def test_execution_plan_creates_queued_work_once(self) -> None:
        run = self.create_running_run()
        first, second = run.create_executions(
            [SeerWorkflowExecutionExtras(project_id=1), SeerWorkflowExecutionExtras(project_id=2)]
        )
        assert first.extras["project_id"] == 1
        assert second.extras["project_id"] == 2
        assert first.status == second.status == SeerWorkflowExecutionStatus.QUEUED
        with pytest.raises(InvalidWorkflowTransition):
            run.create_executions([SeerWorkflowExecutionExtras()])
        run.start_execution(first.id)
        with pytest.raises(InvalidWorkflowTransition):
            run.create_executions([SeerWorkflowExecutionExtras()])
        assert run.get_run().executions.count() == 2

    def test_run_completes_when_all_executions_succeed(self) -> None:
        run = self.create_running_run()
        first, second = self.create_executions(run, count=2)
        run.start_execution(first.id)
        run.start_execution(second.id)

        run.complete_execution(first.id)
        assert run.get_run().status == SeerWorkflowRunStatus.RUNNING
        assert run.get_run().date_completed is None

        run.complete_execution(second.id)
        completed_run = SeerWorkflowRun.objects.get(id=run.run_id)
        assert completed_run.status == SeerWorkflowRunStatus.COMPLETE
        assert completed_run.date_completed is not None
        completed_at = completed_run.date_completed

        run.complete_execution(second.id)
        with pytest.raises(InvalidWorkflowTransition):
            run.complete_execution(
                second.id, error=WorkflowRunError(code="late_callback", message="Late failure")
            )
        second.refresh_from_db()
        assert second.status == SeerWorkflowExecutionStatus.COMPLETE
        assert SeerWorkflowExecutionExtras.parse_obj(second.extras).error is None
        completed_run.refresh_from_db()
        assert completed_run.status == SeerWorkflowRunStatus.COMPLETE
        assert completed_run.date_completed == completed_at

    def test_run_waits_for_remaining_executions_before_failing(self) -> None:
        run = self.create_running_run()
        first, second = self.create_executions(run, count=2)
        run.start_execution(first.id)
        run.start_execution(second.id)
        original_extras = run.get_run().extras.copy()
        failure = WorkflowRunError(code="investigation_failed", message="Investigation failed")

        run.complete_execution(first.id, error=failure)
        assert run.get_run().status == SeerWorkflowRunStatus.RUNNING
        assert run.get_run().date_completed is None

        run.complete_execution(second.id)
        failed_run = SeerWorkflowRun.objects.get(id=run.run_id)
        assert failed_run.status == SeerWorkflowRunStatus.FAILED
        assert failed_run.date_completed is not None
        assert failed_run.extras == original_extras
        assert run.extras.error is None
        first.refresh_from_db()
        assert first.status == SeerWorkflowExecutionStatus.FAILED
        assert SeerWorkflowExecutionExtras.parse_obj(first.extras).error == failure

    def test_run_and_execution_completion_roll_back_together(self) -> None:
        run = self.create_running_run()
        (execution,) = self.create_executions(run)
        with (
            patch.object(SeerWorkflowRun, "save", side_effect=RuntimeError("Cannot finish run")),
            pytest.raises(RuntimeError, match="Cannot finish run"),
        ):
            run.complete_execution(execution.id)

        execution.refresh_from_db()
        assert execution.status == SeerWorkflowExecutionStatus.QUEUED
        assert execution.date_completed is None
        assert run.get_run().status == SeerWorkflowRunStatus.RUNNING
        assert run.get_run().date_completed is None

        run.complete_execution(execution.id)
        execution.refresh_from_db()
        assert execution.status == SeerWorkflowExecutionStatus.COMPLETE
        assert run.get_run().status == SeerWorkflowRunStatus.COMPLETE

    def create_running_run(self, *, trigger_key: str = "manual:first") -> SeerWorkflowRunLifecycle:
        run = self.create_run(trigger_key=trigger_key)
        run.start()
        return run

    def create_run(self, *, trigger_key: str = "manual:first") -> SeerWorkflowRunLifecycle:
        result = self.workflow.get_or_create_run(
            trigger_key=trigger_key, inputs=RunInputs(issue_limit=10)
        )
        return result.lifecycle

    def create_executions(
        self, run: SeerWorkflowRunLifecycle, *, count: int = 1
    ) -> list[SeerWorkflowRunExecution]:
        return run.create_executions([SeerWorkflowExecutionExtras() for _ in range(count)])
