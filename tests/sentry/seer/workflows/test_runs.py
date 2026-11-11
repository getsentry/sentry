from unittest.mock import patch

import pytest
from django.test import override_settings
from pydantic import BaseModel

from sentry.seer.models.workflow import (
    SeerWorkflowConfig,
    SeerWorkflowExecutionExtras,
    SeerWorkflowExecutionStatus,
    SeerWorkflowRun,
    SeerWorkflowRunExecution,
    SeerWorkflowRunStatus,
    SeerWorkflowStrategy,
    WorkflowRunError,
)
from sentry.seer.workflows.base import AdmittedRun, SelectedProjects, lock_config
from sentry.seer.workflows.definitions import get_definition
from sentry.seer.workflows.runs import (
    InvalidWorkflowTransition,
    SeerWorkflowRunLifecycle,
)
from sentry.seer.workflows.workflow import SeerWorkflow
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories


class RunInputs(BaseModel):
    issue_limit: int


@override_settings(SENTRY_SELF_HOSTED=False)
def admit(workflow: SeerWorkflow, *, trigger_key: str, inputs: BaseModel) -> AdmittedRun:
    with lock_config(workflow.organization_id, workflow.config_id) as config:
        return get_definition(config.strategy).admit_run(
            config, trigger_key=trigger_key, inputs=inputs
        )


class SeerWorkflowRunLifecycleTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        config = Factories.create_seer_workflow_config(
            self.organization,
            strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,
            filters={"all_projects": True},
        )
        self.workflow = SeerWorkflow(config_id=config.id, organization_id=self.organization.id)

    def test_config_changes_only_apply_to_new_runs(self) -> None:
        original_project = self.create_project()
        original_result = admit(
            self.workflow, trigger_key="manual:first", inputs=RunInputs(issue_limit=10)
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
        other = SeerWorkflow(
            config_id=self.workflow.config_id, organization_id=self.organization.id
        )
        with other.update_config() as update:
            update.set_scope(SelectedProjects(project_ids=(new_project.id,)))
        retry_result = admit(
            self.workflow, trigger_key="manual:first", inputs=RunInputs(issue_limit=20)
        )
        retried_run = retry_result.lifecycle
        assert retry_result.created is False
        assert retried_run.run_id == original_run.run_id
        assert retried_run.extras.snapshot == snapshot

        new_result = admit(
            self.workflow, trigger_key="manual:next", inputs=RunInputs(issue_limit=20)
        )
        new_run = new_result.lifecycle
        assert new_result.created is True
        assert new_run.run_id != original_run.run_id
        assert new_run.extras.snapshot.config_version == 2
        assert new_run.extras.snapshot.project_ids == (new_project.id,)
        assert new_run.extras.snapshot.inputs == {"issue_limit": 20}

    def test_request_identity_and_history_are_scoped_to_config_and_organization(self) -> None:
        other_config = Factories.create_seer_workflow_config(
            self.organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2
        )
        other_workflow = SeerWorkflow(
            config_id=other_config.id, organization_id=self.organization.id
        )
        first_result = admit(
            self.workflow, trigger_key="event:occurrence", inputs=RunInputs(issue_limit=10)
        )
        first = first_result.lifecycle
        second_result = admit(
            other_workflow, trigger_key="event:occurrence", inputs=RunInputs(issue_limit=10)
        )
        second = second_result.lifecycle
        assert second_result.created is True
        assert first.run_id != second.run_id
        legacy = Factories.create_seer_workflow_run(
            self.organization, workflow_config=self.workflow.get_config()
        )
        assert list(self.workflow.get_runs()) == [legacy, first.get_run()]
        assert list(other_workflow.get_runs()) == [second.get_run()]

        other_org = self.create_organization()
        wrong_org_workflow = SeerWorkflow(
            config_id=self.workflow.config_id, organization_id=other_org.id
        )
        assert not wrong_org_workflow.get_runs().exists()
        with pytest.raises(SeerWorkflowConfig.DoesNotExist):
            admit(
                wrong_org_workflow, trigger_key="event:occurrence", inputs=RunInputs(issue_limit=10)
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
        result = admit(self.workflow, trigger_key=trigger_key, inputs=RunInputs(issue_limit=10))
        return result.lifecycle

    def create_executions(
        self, run: SeerWorkflowRunLifecycle, *, count: int = 1
    ) -> list[SeerWorkflowRunExecution]:
        return run.create_executions([SeerWorkflowExecutionExtras() for _ in range(count)])
