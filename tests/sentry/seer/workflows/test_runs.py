from functools import partial
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
    SeerWorkflowExecutionStatus,
    SeerWorkflowRun,
    SeerWorkflowRunExecution,
    SeerWorkflowRunStatus,
    SeerWorkflowStrategy,
)
from sentry.seer.workflows.runs import (
    complete_workflow_execution,
    complete_workflow_run,
    create_workflow_run,
    deliver_workflow_result,
    finish_workflow_run,
    get_or_create_workflow_run,
    get_workflow_run_status,
    get_workflow_runs,
)
from sentry.seer.workflows.schemas import WorkflowResult, WorkflowRunError, WorkflowRunSnapshot
from sentry.seer.workflows.workflow import SeerWorkflow, SelectedProjects
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
        config = self.create_config()
        run, created = get_or_create_workflow_run(
            organization_id=self.organization.id,
            workflow_config_id=config.id,
            trigger_key="manual:first",
            inputs=RunInputs(issue_limit=10),
        )
        assert created is True
        assert run.status == SeerWorkflowRunStatus.RUNNING
        assert not run.executions.exists()
        snapshot = WorkflowRunSnapshot.parse_obj(run.extras["snapshot"])
        assert snapshot.config_version == 1
        assert snapshot.project_ids == (first.id,)
        assert snapshot.inputs == {"issue_limit": 10}

        later = self.create_project()
        SeerWorkflow(config).set_project_selection(SelectedProjects(project_ids=(later.id,)))
        retry, created = get_or_create_workflow_run(
            organization_id=self.organization.id,
            workflow_config_id=config.id,
            trigger_key="manual:first",
            inputs=RunInputs(issue_limit=20),
        )
        assert created is False
        assert retry.id == run.id
        assert retry.extras["snapshot"] == run.extras["snapshot"]

        next_run, created = get_or_create_workflow_run(
            organization_id=self.organization.id,
            workflow_config_id=config.id,
            trigger_key="manual:next",
            inputs=RunInputs(issue_limit=20),
        )
        assert created is True
        assert next_run.id != run.id
        snapshot = WorkflowRunSnapshot.parse_obj(next_run.extras["snapshot"])
        assert snapshot.config_version == 2
        assert snapshot.project_ids == (later.id,)
        assert snapshot.inputs == {"issue_limit": 20}

    def test_request_identity_is_scoped_to_organization_and_config(self) -> None:
        config, other_config = self.create_config(), self.create_config()
        other_org = self.create_organization()
        first, _ = get_or_create_workflow_run(
            organization_id=self.organization.id,
            workflow_config_id=config.id,
            trigger_key="event:occurrence",
            inputs=RunInputs(issue_limit=10),
        )
        second, created = get_or_create_workflow_run(
            organization_id=self.organization.id,
            workflow_config_id=other_config.id,
            trigger_key="event:occurrence",
            inputs=RunInputs(issue_limit=10),
        )
        assert created is True
        assert first.id != second.id
        legacy = Factories.create_seer_workflow_run(self.organization, workflow_config=config)
        assert list(get_workflow_runs(organization_id=self.organization.id)) == [
            legacy,
            second,
            first,
        ]
        assert list(
            get_workflow_runs(organization_id=self.organization.id, workflow_config_id=config.id)
        ) == [legacy, first]
        assert not get_workflow_runs(
            organization_id=other_org.id, workflow_config_id=config.id
        ).exists()
        with pytest.raises(SeerWorkflowConfig.DoesNotExist):
            get_or_create_workflow_run(
                organization_id=other_org.id,
                workflow_config_id=config.id,
                trigger_key="event:occurrence",
                inputs=RunInputs(issue_limit=10),
            )
        with pytest.raises(SeerWorkflowRun.DoesNotExist):
            complete_workflow_run(organization_id=other_org.id, workflow_run_id=first.id)
        first.refresh_from_db()
        assert first.date_completed is None

    def test_deleted_config_cannot_be_retried(self) -> None:
        config = self.create_config()
        config_id = config.id
        run, _ = get_or_create_workflow_run(
            organization_id=self.organization.id,
            workflow_config_id=config_id,
            trigger_key="manual:first",
            inputs=RunInputs(issue_limit=10),
        )
        config.delete()

        with pytest.raises(SeerWorkflowConfig.DoesNotExist):
            get_or_create_workflow_run(
                organization_id=self.organization.id,
                workflow_config_id=config_id,
                trigger_key="manual:first",
                inputs=RunInputs(issue_limit=10),
            )
        with pytest.raises(SeerWorkflowRun.DoesNotExist):
            complete_workflow_run(organization_id=self.organization.id, workflow_run_id=run.id)
        assert not get_workflow_runs(
            organization_id=self.organization.id, workflow_config_id=config_id
        ).exists()

    def test_no_work_completion_is_independent_of_executions_and_idempotent(self) -> None:
        run = self.create_run()
        complete = complete_workflow_run(
            organization_id=self.organization.id, workflow_run_id=run.id
        )
        assert complete.status == SeerWorkflowRunStatus.COMPLETE
        assert complete.extras["error"] is None
        assert complete.date_completed is not None
        assert not complete.executions.exists()
        assert complete.extras["snapshot"] == run.extras["snapshot"]

        repeated = complete_workflow_run(
            organization_id=self.organization.id,
            workflow_run_id=run.id,
            error=WorkflowRunError(code="late_error", message="Late failure"),
        )
        assert repeated.status == SeerWorkflowRunStatus.COMPLETE
        assert repeated.extras["error"] is None
        assert repeated.date_completed == complete.date_completed

    def test_failed_work_preserves_snapshot_and_records_error(self) -> None:
        run = self.create_run()
        complete = complete_workflow_run(
            organization_id=self.organization.id,
            workflow_run_id=run.id,
            error=WorkflowRunError(code="selection_failed", message="Work selection failed"),
        )
        assert complete.status == SeerWorkflowRunStatus.FAILED
        assert complete.extras["error"] == {
            "code": "selection_failed",
            "message": "Work selection failed",
        }
        assert complete.date_completed is not None
        assert complete.extras["snapshot"] == run.extras["snapshot"]

    def test_execution_completion_is_scoped_to_organization(self) -> None:
        run = self.create_run()
        execution = Factories.create_seer_workflow_run_execution(
            run, status=SeerWorkflowExecutionStatus.RUNNING
        )
        other_org = self.create_organization()
        with pytest.raises(SeerWorkflowRunExecution.DoesNotExist):
            complete_workflow_execution(
                organization_id=other_org.id, workflow_execution_id=execution.id
            )
        run.refresh_from_db()
        execution.refresh_from_db()
        assert run.status == SeerWorkflowRunStatus.RUNNING
        assert execution.status == SeerWorkflowExecutionStatus.RUNNING

    def create_run(self) -> SeerWorkflowRun:
        config = self.create_config()
        run, _ = get_or_create_workflow_run(
            organization_id=self.organization.id,
            workflow_config_id=config.id,
            trigger_key="manual:first",
            inputs=RunInputs(issue_limit=10),
        )
        return run

    def create_config(self) -> SeerWorkflowConfig:
        return Factories.create_seer_workflow_config(
            self.organization,
            strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,
            filters={"all_projects": True},
        )


@pytest.mark.django_db(databases="__all__")
@pytest.mark.parametrize("failed_execution", [None, 0, 1])
def test_run_finishes_after_all_executions(failed_execution: int | None) -> None:
    organization = Factories.create_organization()
    config = Factories.create_seer_workflow_config(
        organization,
        strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,
        filters={"all_projects": True},
    )
    run, _ = get_or_create_workflow_run(
        organization_id=organization.id,
        workflow_config_id=config.id,
        trigger_key="manual:first",
        inputs=RunInputs(issue_limit=10),
    )
    first = Factories.create_seer_workflow_run_execution(
        run, status=SeerWorkflowExecutionStatus.RUNNING
    )
    second = Factories.create_seer_workflow_run_execution(
        run, status=SeerWorkflowExecutionStatus.RUNNING
    )
    failure = WorkflowRunError(code="investigation_failed", message="Investigation failed")

    complete_workflow_execution(
        organization_id=organization.id,
        workflow_execution_id=first.id,
        error=failure if failed_execution == 0 else None,
    )
    run.refresh_from_db()
    assert run.status == SeerWorkflowRunStatus.RUNNING
    assert run.date_completed is None

    finished = complete_workflow_execution(
        organization_id=organization.id,
        workflow_execution_id=second.id,
        error=failure if failed_execution == 1 else None,
    )
    first.refresh_from_db()
    assert first.status == (
        SeerWorkflowExecutionStatus.FAILED
        if failed_execution == 0
        else SeerWorkflowExecutionStatus.COMPLETE
    )
    assert finished.status == (
        SeerWorkflowExecutionStatus.FAILED
        if failed_execution == 1
        else SeerWorkflowExecutionStatus.COMPLETE
    )
    run = SeerWorkflowRun.objects.get(id=run.id, organization_id=organization.id)
    assert run.status == (
        SeerWorkflowRunStatus.FAILED
        if failed_execution is not None
        else SeerWorkflowRunStatus.COMPLETE
    )
    assert run.extras["error"] == (failure.dict() if failed_execution is not None else None)
    assert run.date_completed is not None
    completed_at = run.date_completed

    complete_workflow_execution(
        organization_id=organization.id,
        workflow_execution_id=second.id,
        error=WorkflowRunError(code="late_callback", message="Late failure"),
    )
    second.refresh_from_db()
    assert second.status == finished.status
    run.refresh_from_db()
    assert run.date_completed == completed_at
