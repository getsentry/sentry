from copy import copy
from datetime import datetime
from functools import partial
from typing import Any
from unittest.mock import Mock, patch

import pytest
from django.test import override_settings
from pydantic import BaseModel

from sentry.hybridcloud.models.outbox import CellOutbox
from sentry.hybridcloud.outbox.category import OutboxCategory
from sentry.seer.agent.client import SeerAgentClient
from sentry.seer.models.run import SeerAgentRun, SeerRun, SeerRunMirrorStatus
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
from sentry.seer.workflows import state as workflow_state
from sentry.seer.workflows.runs import (
    SeerWorkflowRunLifecycle,
    create_workflow_run,
    deliver_workflow_result,
    finish_workflow_run,
    get_workflow_run_status,
)
from sentry.seer.workflows.schemas import WorkflowResult
from sentry.seer.workflows.workflow import SeerWorkflow, SelectedProjects
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories
from sentry.testutils.helpers.datetime import before_now


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
                "sentry.seer.workflows.runs.SeerWorkflowRunExecution.objects.create",
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


class ConfiguredWorkflowRunTest(TestCase):
    def test_retries_keep_original_snapshot_and_new_invocations_capture_edits(self) -> None:
        first = self.create_project()
        workflow = self.create_configured_workflow()
        run, created = workflow.get_or_create_run(
            trigger_key="manual:first", inputs=RunInputs(issue_limit=10)
        )
        assert created is True
        assert run.run.status == SeerWorkflowRunStatus.QUEUED
        assert not run.run.executions.exists()
        snapshot = run.extras.snapshot
        assert snapshot.config_version == 1
        assert snapshot.project_ids == (first.id,)
        assert snapshot.inputs == {"issue_limit": 10}

        later = self.create_project()
        workflow.set_project_selection(SelectedProjects(project_ids=(later.id,)))
        retry, created = workflow.get_or_create_run(
            trigger_key="manual:first", inputs=RunInputs(issue_limit=20)
        )
        assert created is False
        assert retry.run.id == run.run.id
        assert retry.extras.snapshot == snapshot

        next_run, created = workflow.get_or_create_run(
            trigger_key="manual:next", inputs=RunInputs(issue_limit=20)
        )
        assert created is True
        assert next_run.run.id != run.run.id
        assert next_run.extras.snapshot.config_version == 2
        assert next_run.extras.snapshot.project_ids == (later.id,)
        assert next_run.extras.snapshot.inputs == {"issue_limit": 20}

    def test_request_identity_and_history_are_scoped_to_config_and_organization(self) -> None:
        workflow, other_workflow = (
            self.create_configured_workflow(),
            self.create_configured_workflow(),
        )
        first, _ = workflow.get_or_create_run(
            trigger_key="event:occurrence", inputs=RunInputs(issue_limit=10)
        )
        second, created = other_workflow.get_or_create_run(
            trigger_key="event:occurrence", inputs=RunInputs(issue_limit=10)
        )
        assert created is True
        assert first.run.id != second.run.id
        legacy = Factories.create_seer_workflow_run(
            self.organization, workflow_config=workflow.config
        )
        assert list(workflow.get_runs()) == [legacy, first.run]
        assert list(other_workflow.get_runs()) == [second.run]

        other_org = self.create_organization()
        wrong_org_config = copy(workflow.config)
        wrong_org_config.organization_id = other_org.id
        wrong_org_workflow = SeerWorkflow(wrong_org_config)
        assert not wrong_org_workflow.get_runs().exists()
        with pytest.raises(SeerWorkflowConfig.DoesNotExist):
            wrong_org_workflow.get_or_create_run(
                trigger_key="event:occurrence", inputs=RunInputs(issue_limit=10)
            )
        with pytest.raises(SeerWorkflowRun.DoesNotExist):
            SeerWorkflowRunLifecycle.get(organization_id=other_org.id, run_id=first.run.id)
        first.run.refresh_from_db()
        assert first.run.date_completed is None

    def test_deleted_config_cannot_be_retried(self) -> None:
        workflow = self.create_configured_workflow()
        run, _ = workflow.get_or_create_run(
            trigger_key="manual:first", inputs=RunInputs(issue_limit=10)
        )
        SeerWorkflowConfig.objects.filter(id=workflow.config.id).delete()
        with pytest.raises(SeerWorkflowConfig.DoesNotExist):
            workflow.get_or_create_run(trigger_key="manual:first", inputs=RunInputs(issue_limit=10))
        with pytest.raises(SeerWorkflowRun.DoesNotExist):
            run.complete()
        assert not workflow.get_runs().exists()

    def test_invalid_trigger_key(self) -> None:
        workflow = self.create_configured_workflow()
        with pytest.raises(ValueError, match="between 1 and 256"):
            workflow.get_or_create_run(trigger_key="", inputs=RunInputs(issue_limit=10))
        with pytest.raises(ValueError, match="between 1 and 256"):
            workflow.get_or_create_run(trigger_key="x" * 257, inputs=RunInputs(issue_limit=10))

    def test_starts_reject_repeats_and_terminal_states(self) -> None:
        run = self.create_run()
        assert run.run.status == SeerWorkflowRunStatus.QUEUED
        assert run.start().status == SeerWorkflowRunStatus.RUNNING
        with pytest.raises(workflow_state.InvalidWorkflowTransition, match="Only queued"):
            run.start()
        execution = run.create_execution()
        assert execution.status == SeerWorkflowExecutionStatus.QUEUED
        assert run.start_execution(execution.id).status == SeerWorkflowExecutionStatus.RUNNING
        with pytest.raises(workflow_state.InvalidWorkflowTransition, match="Only queued"):
            run.start_execution(execution.id)
        run.complete_execution(execution.id)
        completed_at = run.run.date_completed

        with pytest.raises(workflow_state.InvalidWorkflowTransition):
            run.start_execution(execution.id)
        with pytest.raises(workflow_state.InvalidWorkflowTransition):
            run.start()
        assert run.run.date_completed == completed_at
        with pytest.raises(ValueError, match="running workflow"):
            run.create_execution()

    def test_no_work_completion_is_independent_of_executions_and_idempotent(self) -> None:
        run = self.create_run()
        snapshot = run.extras.snapshot
        complete = run.complete()
        assert complete.status == SeerWorkflowRunStatus.COMPLETE
        assert complete.extras["error"] is None
        assert complete.date_completed is not None
        assert not complete.executions.exists()
        assert run.extras.snapshot == snapshot
        completed_at = complete.date_completed

        with pytest.raises(workflow_state.InvalidWorkflowTransition, match="conflicts"):
            run.complete(error=WorkflowRunError(code="late_error", message="Late failure"))
        repeated = run.complete()
        assert repeated.status == SeerWorkflowRunStatus.COMPLETE
        assert repeated.extras["error"] is None
        assert repeated.date_completed == completed_at

    def test_failed_work_preserves_snapshot_and_records_error(self) -> None:
        run = self.create_run()
        snapshot = run.extras.snapshot
        complete = run.complete(
            error=WorkflowRunError(code="selection_failed", message="Work selection failed")
        )
        assert complete.status == SeerWorkflowRunStatus.FAILED
        assert complete.extras["error"] == {
            "code": "selection_failed",
            "message": "Work selection failed",
        }
        assert complete.date_completed is not None
        assert run.extras.snapshot == snapshot

    def test_rejection_is_terminal_and_has_no_executions(self) -> None:
        run = self.create_run()
        failure = WorkflowRunError(code="quota_exceeded", message="Automation quota exceeded.")
        rejected = run.reject(error=failure)
        assert rejected.status == SeerWorkflowRunStatus.REJECTED
        assert rejected.date_completed is not None
        assert rejected.extras["error"] == failure.dict()
        assert not rejected.executions.exists()
        completed_at = rejected.date_completed
        with pytest.raises(workflow_state.InvalidWorkflowTransition):
            run.start()
        with pytest.raises(workflow_state.InvalidWorkflowTransition):
            run.complete()
        assert run.reject(error=failure).date_completed == completed_at
        with pytest.raises(ValueError, match="running workflow"):
            run.create_execution()

    def test_active_run_cannot_be_rejected_or_completed_with_executions(self) -> None:
        run = self.create_run()
        with pytest.raises(ValueError, match="running workflow"):
            run.create_execution()
        run.start()
        run.create_execution()
        with pytest.raises(ValueError, match="complete_execution"):
            run.complete()
        with pytest.raises(ValueError, match="Only queued runs"):
            run.reject(error=WorkflowRunError(code="rejected", message="Rejected"))
        assert run.run.status == SeerWorkflowRunStatus.RUNNING
        assert run.run.date_completed is None

    def test_execution_transitions_are_scoped_to_run(self) -> None:
        run = self.create_run()
        run.start()
        execution = run.create_execution()
        other = self.create_run()
        other.start()
        with pytest.raises(SeerWorkflowRunExecution.DoesNotExist):
            other.start_execution(execution.id)
        with pytest.raises(SeerWorkflowRunExecution.DoesNotExist):
            other.complete_execution(execution.id)
        execution.refresh_from_db()
        assert execution.status == SeerWorkflowExecutionStatus.QUEUED
        assert run.run.date_completed is None
        assert other.run.date_completed is None

    def test_queued_execution_keeps_parent_running(self) -> None:
        run = self.create_run()
        run.start()
        first = run.create_execution()
        queued = run.create_execution()
        run.start_execution(first.id)
        run.complete_execution(first.id)
        assert run.run.status == SeerWorkflowRunStatus.RUNNING
        assert run.run.date_completed is None
        queued.refresh_from_db()
        assert queued.status == SeerWorkflowExecutionStatus.QUEUED

        failure = WorkflowRunError(code="dispatch_failed", message="Could not start execution")
        failed = run.complete_execution(queued.id, error=failure)
        assert run.run.status == SeerWorkflowRunStatus.FAILED
        assert SeerWorkflowExecutionExtras.parse_obj(failed.extras).error == failure
        assert run.extras.error is None
        assert run.run.date_completed is not None

    def test_execution_plan_is_sealed_when_work_starts(self) -> None:
        run = self.create_run()
        run.start()
        execution = run.create_execution()
        run.start_execution(execution.id)
        with pytest.raises(workflow_state.InvalidWorkflowTransition, match="plan cannot change"):
            run.create_execution()
        assert run.run.executions.count() == 1

    def test_failed_run_completion_requires_the_same_error_on_retry(self) -> None:
        run = self.create_run()
        failure = WorkflowRunError(code="selection_failed", message="Selection failed")
        complete = run.complete(error=failure)
        completed_at = complete.date_completed
        assert run.complete(error=failure).date_completed == completed_at
        with pytest.raises(workflow_state.InvalidWorkflowTransition, match="conflicts"):
            run.complete()
        with pytest.raises(workflow_state.InvalidWorkflowTransition):
            run.reject(error=failure)
        run.run.refresh_from_db()
        assert run.extras.error == failure
        assert run.run.date_completed == completed_at

    def test_creation_cannot_commit_a_queued_run_with_an_error(self) -> None:
        workflow = self.create_configured_workflow()
        error = WorkflowRunError(code="failed", message="Failed")
        with pytest.raises(workflow_state.InvalidWorkflowState):
            workflow.get_or_create_run(
                trigger_key="manual:first",
                inputs=RunInputs(issue_limit=10),
                extras={"error": error.dict()},
            )
        assert not workflow.get_runs().exists()

    def test_creation_cannot_commit_a_queued_execution_with_an_error(self) -> None:
        run = self.create_run()
        run.start()
        with pytest.raises(workflow_state.InvalidWorkflowState):
            run.create_execution(
                extras=SeerWorkflowExecutionExtras(
                    error=WorkflowRunError(code="failed", message="Failed")
                )
            )
        assert not run.run.executions.exists()
        run.run.refresh_from_db()
        assert run.run.status == SeerWorkflowRunStatus.RUNNING

    def create_run(self) -> SeerWorkflowRunLifecycle:
        run, _ = self.create_configured_workflow().get_or_create_run(
            trigger_key="manual:first", inputs=RunInputs(issue_limit=10)
        )
        return run

    def create_configured_workflow(self) -> SeerWorkflow:
        return SeerWorkflow(
            Factories.create_seer_workflow_config(
                self.organization,
                strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,
                filters={"all_projects": True},
            )
        )


@pytest.mark.django_db(databases="__all__")
@pytest.mark.parametrize(
    "first_error,second_error,expected_status",
    [
        (None, None, SeerWorkflowRunStatus.COMPLETE),
        (
            WorkflowRunError(code="investigation_failed", message="Investigation failed"),
            None,
            SeerWorkflowRunStatus.FAILED,
        ),
        (
            None,
            WorkflowRunError(code="investigation_failed", message="Investigation failed"),
            SeerWorkflowRunStatus.FAILED,
        ),
        (
            WorkflowRunError(code="dispatch_failed", message="Could not start execution"),
            WorkflowRunError(code="investigation_failed", message="Investigation failed"),
            SeerWorkflowRunStatus.FAILED,
        ),
    ],
)
def test_run_finishes_after_all_executions(
    first_error: WorkflowRunError | None,
    second_error: WorkflowRunError | None,
    expected_status: SeerWorkflowRunStatus,
) -> None:
    organization = Factories.create_organization()
    config = Factories.create_seer_workflow_config(
        organization,
        strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,
        filters={"all_projects": True},
    )
    run, _ = SeerWorkflow(config).get_or_create_run(
        trigger_key="manual:first", inputs=RunInputs(issue_limit=10)
    )
    run.start()
    first = run.create_execution()
    second = run.create_execution()
    run.start_execution(first.id)
    run.start_execution(second.id)
    original_extras = run.run.extras.copy()

    run.complete_execution(first.id, error=first_error)
    assert run.run.status == SeerWorkflowRunStatus.RUNNING
    assert run.run.date_completed is None
    assert run.run.extras == original_extras

    finished = run.complete_execution(second.id, error=second_error)
    first.refresh_from_db()
    assert SeerWorkflowExecutionExtras.parse_obj(first.extras).error == first_error
    assert SeerWorkflowExecutionExtras.parse_obj(finished.extras).error == second_error
    completed_run = SeerWorkflowRunLifecycle.get(organization_id=organization.id, run_id=run.run.id)
    assert completed_run.run.status == expected_status
    assert completed_run.extras.error is None
    assert completed_run.run.extras == original_extras
    assert completed_run.run.date_completed is not None
    completed_at = completed_run.run.date_completed

    run.complete_execution(second.id, error=second_error)
    with pytest.raises(workflow_state.InvalidWorkflowTransition, match="conflicts"):
        run.complete_execution(
            second.id, error=WorkflowRunError(code="late_callback", message="Late failure")
        )
    second.refresh_from_db()
    assert second.status == finished.status
    assert SeerWorkflowExecutionExtras.parse_obj(second.extras).error == second_error
    assert run.run.extras == original_extras
    assert run.run.date_completed == completed_at


@pytest.mark.django_db(databases="__all__")
@pytest.mark.parametrize(
    "fields,error",
    [
        ({"status": "unknown"}, None),
        ({"status": "running", "date_completed": before_now()}, None),
        ({"status": "queued", "date_completed": before_now()}, None),
        ({"status": "complete", "date_completed": None}, None),
        ({"status": "failed", "date_completed": None}, None),
        ({"status": "rejected", "date_completed": before_now()}, None),
        ({"status": "running"}, {"code": "failed", "message": "Failed"}),
        (
            {"status": "complete", "date_completed": before_now()},
            {"code": "failed", "message": "Failed"},
        ),
    ],
)
def test_invalid_run_state_is_rejected(
    configured_workflow_run: SeerWorkflowRunLifecycle,
    fields: dict[str, Any],
    error: dict[str, str] | None,
) -> None:
    run = configured_workflow_run
    run.run.update(extras=run.run.extras | {"error": error}, **fields)
    with pytest.raises(workflow_state.InvalidWorkflowState):
        SeerWorkflowRunLifecycle.get(organization_id=run.run.organization_id, run_id=run.run.id)
    with pytest.raises(workflow_state.InvalidWorkflowState):
        run.start()
    run.run.refresh_from_db()
    assert run.run.status == fields["status"]


@pytest.mark.django_db(databases="__all__")
@pytest.mark.parametrize(
    "status,completed_at,error",
    [
        (None, None, None),
        ("unknown", None, None),
        ("rejected", before_now(), {"code": "failed", "message": "Failed"}),
        ("queued", before_now(), None),
        ("running", before_now(), None),
        ("complete", None, None),
        ("failed", None, {"code": "failed", "message": "Failed"}),
        ("failed", before_now(), None),
        ("running", None, {"code": "failed", "message": "Failed"}),
        ("complete", before_now(), {"code": "failed", "message": "Failed"}),
    ],
)
def test_invalid_execution_state_is_rejected(
    configured_workflow_run: SeerWorkflowRunLifecycle,
    status: str | None,
    completed_at: datetime | None,
    error: dict[str, str] | None,
) -> None:
    run = configured_workflow_run
    run.start()
    execution = run.create_execution()
    execution.update(status=status, date_completed=completed_at, extras={"error": error})
    with pytest.raises(workflow_state.InvalidWorkflowState):
        run.start_execution(execution.id)
    with pytest.raises(workflow_state.InvalidWorkflowState):
        run.complete_execution(execution.id)
    run.run.refresh_from_db()
    execution.refresh_from_db()
    assert run.run.status == SeerWorkflowRunStatus.RUNNING
    assert run.run.date_completed is None
    assert execution.status == status
    assert execution.date_completed == completed_at


@pytest.mark.django_db(databases="__all__")
def test_invalid_sibling_prevents_partial_completion(
    configured_workflow_run: SeerWorkflowRunLifecycle,
) -> None:
    run = configured_workflow_run
    run.start()
    first = run.create_execution()
    sibling = run.create_execution()
    sibling.update(status="unknown")
    with pytest.raises(workflow_state.InvalidWorkflowState):
        run.complete_execution(first.id)
    first.refresh_from_db()
    assert first.status == SeerWorkflowExecutionStatus.QUEUED
    assert first.date_completed is None


@pytest.mark.django_db(databases="__all__")
def test_unfinished_execution_cannot_complete_under_terminal_run(
    configured_workflow_run: SeerWorkflowRunLifecycle,
) -> None:
    run = configured_workflow_run
    run.start()
    execution = run.create_execution()
    run.run.update(status=SeerWorkflowRunStatus.COMPLETE, date_completed=before_now())
    with pytest.raises(workflow_state.InvalidWorkflowState):
        run.start_execution(execution.id)
    with pytest.raises(workflow_state.InvalidWorkflowState):
        run.complete_execution(execution.id)
    execution.refresh_from_db()
    assert execution.status == SeerWorkflowExecutionStatus.QUEUED
    assert execution.date_completed is None


@pytest.mark.django_db(databases="__all__")
@pytest.mark.parametrize(
    "fields",
    [
        {"status": "queued", "date_completed": None},
        {"status": "running", "date_completed": None},
        {"status": "failed", "date_completed": before_now()},
    ],
)
def test_completion_retry_rejects_inconsistent_parent(
    configured_workflow_run: SeerWorkflowRunLifecycle, fields: dict[str, Any]
) -> None:
    run = configured_workflow_run
    run.start()
    execution = run.create_execution()
    run.complete_execution(execution.id)
    run.run.update(**fields)
    with pytest.raises(workflow_state.InvalidWorkflowState):
        run.complete_execution(execution.id)
    run.run.refresh_from_db()
    assert run.run.status == fields["status"]


@pytest.fixture
def configured_workflow_run() -> SeerWorkflowRunLifecycle:
    organization = Factories.create_organization()
    config = Factories.create_seer_workflow_config(
        organization,
        strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,
        filters={"all_projects": True},
    )
    run, _ = SeerWorkflow(config).get_or_create_run(
        trigger_key="manual:first", inputs=RunInputs(issue_limit=10)
    )
    return run
