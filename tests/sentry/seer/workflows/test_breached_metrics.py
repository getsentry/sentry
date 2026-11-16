from __future__ import annotations

from collections.abc import Sequence
from copy import deepcopy
from dataclasses import replace
from datetime import timedelta
from typing import Any
from unittest import mock
from uuid import uuid4

import pytest
from django.db import connections, router
from django.test.utils import CaptureQueriesContext
from pydantic import ValidationError

from sentry.constants import ObjectStatus
from sentry.eventstream.base import GroupState
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
from sentry.investigations.models import InvestigationOrchestrationStatus
from sentry.models.groupopenperiod import get_latest_open_period
from sentry.models.project import Project
from sentry.notebooks.models import Notebook, NotebookSourceType
from sentry.seer.models.workflow import (
    SeerWorkflowConfig,
    SeerWorkflowConfigExtras,
    SeerWorkflowExecutionStatus,
    SeerWorkflowRun,
    SeerWorkflowRunExecution,
    SeerWorkflowRunStatus,
    SeerWorkflowSchedule,
    SeerWorkflowStrategy,
    SeerWorkflowTriggerBinding,
)
from sentry.seer.workflows.base import (
    AdmittedRunExtras,
    AllProjects,
    SeerServiceAccountGrant,
    SelectedMonitors,
    SelectedProjects,
)
from sentry.seer.workflows.breached_metrics import (
    AcceptedMetricBreach,
    IgnoredMetricBreach,
    MetricBreachInputs,
    SeerMetricAlertActionHandler,
    get_config_monitors_bulk,
)
from sentry.seer.workflows.workflow import SeerWorkflow
from sentry.seer_workflow_outputs.models import SeerWorkflowOutputLink
from sentry.seer_workflow_outputs.tasks import finish_investigation_executions
from sentry.service_accounts.models import ServiceAccountReplica
from sentry.services.eventstore.models import GroupEvent
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.outbox import outbox_runner
from sentry.viewer_context import ActorId, ActorType
from sentry.workflow_engine.buffer.batch_client import DelayedWorkflowClient
from sentry.workflow_engine.models import (
    Action,
    Detector,
    DetectorWorkflow,
    Workflow,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.processors.action import is_action_permitted
from sentry.workflow_engine.processors.evaluations import ProcessWorkflowsResult
from sentry.workflow_engine.processors.workflow import process_workflows
from sentry.workflow_engine.types import DetectorPriorityLevel, WorkflowEventData
from tests.sentry.issues.test_utils import OccurrenceTestMixin

GRANT = SeerServiceAccountGrant(scopes=["event:read"])


def create_metric_workflow(
    organization_id: int, *, monitor_ids: Sequence[int] = (), **kwargs: Any
) -> SeerWorkflow:
    return SeerWorkflow.create(
        organization_id=organization_id,
        strategy=SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION,
        scope=SelectedMonitors(tuple(monitor_ids)),
        **kwargs,
    )


class BreachedMetricWorkflowTestCase(OccurrenceTestMixin, TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.environment = self.create_environment(project=self.project, name="production")
        self.group = self.create_group(
            project=self.project,
            type=MetricIssue.type_id,
            message="Example error spike",
        )
        self.action = self.create_action(type=Action.Type.SEER_WORKFLOW)
        self.config = self.create_metric_config(trigger_actions=[self.action])

    def create_metric_config(self, **kwargs: Any) -> SeerWorkflowConfig:
        return Factories.create_seer_workflow_config(
            self.organization,
            strategy=SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION,
            enabled=True,
            monitors=[self.create_detector(project=self.project, type=MetricIssue.slug)],
            **kwargs,
        )

    def breach_event(self, *, detector_id: int, value: int = 180) -> GroupEvent:
        event_id = uuid4().hex
        occurrence = self.build_occurrence(
            event_id=event_id,
            project_id=self.project.id,
            type=MetricIssue.type_id,
            evidence_data={
                "detector_id": detector_id,
                "value": value,
                "conditions": [
                    {
                        "type": Condition.GREATER,
                        "comparison": 100,
                        "condition_result": DetectorPriorityLevel.HIGH,
                    }
                ],
            },
        )
        occurrence.save()
        event = self.store_event(
            data={"event_id": event_id, "environment": self.environment.name},
            project_id=self.project.id,
        ).for_group(self.group)
        event.occurrence = occurrence
        return event


@with_feature("organizations:seer-automations")
class BreachedMetricWorkflowAdmissionTest(BreachedMetricWorkflowTestCase):
    def test_creates_config_without_projects_preserving_environment_filter(self) -> None:
        workflow = create_metric_workflow(
            self.organization.id, environments=["production"], service_account_grant=GRANT
        )

        config = workflow.get_config()
        assert config.strategy == SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION
        assert config.enabled is False
        assert config.filters == {"all_projects": False, "environments": ["production"]}
        assert config.backing_workflow is not None
        assert not config.backing_workflow.detectorworkflow_set.exists()
        assert workflow.get_project_ids() == []

    def test_project_selection_is_managed_by_connected_monitors(self) -> None:
        workflow = SeerWorkflow(
            config_id=self.config.id, organization_id=self.config.organization_id
        )
        for selection in (SelectedProjects(project_ids=(self.project.id,)), AllProjects()):
            with (
                pytest.raises(ValueError, match="selected by connecting monitors"),
                workflow.update_config() as update,
            ):
                update.set_scope(selection)

        assert workflow.get_config().version == self.config.version

    def test_replaying_old_metadata_logs_validation_error_without_replacing_run(self) -> None:
        event = self.breach_event(detector_id=1)
        result = SeerMetricAlertActionHandler.accept(
            self.group, event, binding=self.action.seer_workflow_binding, workflow_id=1
        )
        assert isinstance(result, AcceptedMetricBreach)
        run = result.run
        old_extras = {
            "status": "complete",
            "config_version": run.extras["snapshot"]["config_version"],
            "trigger": run.extras["snapshot"]["inputs"],
            "admission": run.extras["admission"],
        }
        run.update(extras=old_extras, status=None)

        with (
            mock.patch("sentry.seer.workflows.runs.logger.exception") as capture_error,
            pytest.raises(ValidationError, match="snapshot"),
        ):
            SeerMetricAlertActionHandler.accept(
                self.group, event, binding=self.action.seer_workflow_binding, workflow_id=1
            )

        capture_error.assert_called_once_with(
            "seer.workflow.invalid_run_extras",
            extra={"run_id": run.id, "organization_id": self.organization.id},
        )
        run.refresh_from_db()
        assert run.extras == old_extras
        assert SeerWorkflowRun.objects.count() == 1

    def test_failed_execution_creation_rolls_back_admission(self) -> None:
        event = self.breach_event(detector_id=1)
        with (
            mock.patch(
                "sentry.seer.workflows.runs.SeerWorkflowRunExecution.objects.bulk_create",
                side_effect=RuntimeError("Cannot create execution"),
            ),
            pytest.raises(RuntimeError, match="Cannot create execution"),
        ):
            SeerMetricAlertActionHandler.accept(
                self.group, event, binding=self.action.seer_workflow_binding, workflow_id=1
            )
        assert not SeerWorkflowRun.objects.exists()
        assert not SeerWorkflowRunExecution.objects.exists()

    def test_accept_uses_latest_scope_from_the_locked_config(self) -> None:
        SeerWorkflowConfig.objects.filter(id=self.config.id).update(
            filters={"all_projects": True, "environments": ["staging"]}
        )

        result = SeerMetricAlertActionHandler.accept(
            self.group,
            self.breach_event(detector_id=1),
            binding=self.action.seer_workflow_binding,
            workflow_id=1,
        )

        assert result == IgnoredMetricBreach("out_of_scope")
        assert not SeerWorkflowRun.objects.exists()

    def test_admission_and_run_creation_lock_current_config(self) -> None:
        event = self.breach_event(detector_id=1)
        binding = self.action.seer_workflow_binding
        SeerWorkflowConfig.objects.filter(id=self.config.id).update(
            version=3,
            filters={"all_projects": True, "environments": ["production"]},
            output_policy={"review_required": True},
        )

        with CaptureQueriesContext(connections[router.db_for_write(SeerWorkflowConfig)]) as queries:
            result = SeerMetricAlertActionHandler.accept(
                self.group, event, binding=binding, workflow_id=1
            )

        assert isinstance(result, AcceptedMetricBreach)
        assert result.created is True
        snapshot = AdmittedRunExtras.parse_obj(result.run.extras).snapshot
        assert snapshot.config_version == 3
        assert snapshot.filters == {"all_projects": True, "environments": ["production"]}
        assert snapshot.output_policy == {"review_required": True}
        config_reads = [
            query["sql"] for query in queries if 'FROM "seer_workflowconfig"' in query["sql"]
        ]
        assert len(config_reads) == 1
        assert all("FOR UPDATE" in query for query in config_reads)

    def test_ignored_configuration_reports_reason_without_starting_work(self) -> None:
        self.config.update(enabled=False)

        rejected = SeerMetricAlertActionHandler.accept(
            self.group,
            self.breach_event(detector_id=1),
            binding=self.action.seer_workflow_binding,
            workflow_id=1,
        )

        assert rejected == IgnoredMetricBreach("config_disabled")
        assert not SeerWorkflowRun.objects.exists()
        assert not SeerWorkflowRunExecution.objects.exists()

    def test_ignored_malformed_source_reports_reason(self) -> None:
        event = self.breach_event(detector_id=1)
        assert event.occurrence is not None
        event.occurrence = replace(event.occurrence, evidence_data={})

        rejected = SeerMetricAlertActionHandler.accept(
            self.group,
            event,
            binding=self.action.seer_workflow_binding,
            workflow_id=1,
        )

        assert rejected == IgnoredMetricBreach("invalid_source")
        assert not SeerWorkflowRun.objects.exists()

    def test_other_organization_configuration_does_not_accept_the_breach(self) -> None:
        other_action = self.create_action(type=Action.Type.SEER_WORKFLOW)
        Factories.create_seer_workflow_config(
            self.create_organization(),
            strategy=SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION,
            enabled=True,
            filters={"all_projects": True},
            trigger_actions=[other_action],
        )

        result = SeerMetricAlertActionHandler.accept(
            self.group,
            self.breach_event(detector_id=1),
            binding=other_action.seer_workflow_binding,
            workflow_id=1,
        )

        assert result == IgnoredMetricBreach("configuration_unavailable")
        assert not SeerWorkflowRun.objects.exists()


@with_feature("organizations:seer-automations")
class BreachedMetricWorkflowWFEIntegrationTest(BreachedMetricWorkflowTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.query = create_snuba_query(
            query_type=SnubaQuery.Type.ERROR,
            dataset=Dataset.Events,
            query="transaction:example",
            aggregate="count()",
            time_window=timedelta(minutes=5),
            resolution=timedelta(minutes=1),
            environment=self.environment,
        )
        subscription = create_snuba_subscription(
            project=self.project, subscription_type="incidents", snuba_query=self.query
        )
        data_source = self.create_data_source(
            organization=self.organization,
            source_id=str(subscription.id),
            type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
        )
        condition_group = self.create_data_condition_group(organization=self.organization)
        self.condition = self.create_data_condition(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=100,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        self.detector = self.create_detector(
            project=self.project,
            type=MetricIssue.slug,
            config={"detection_type": AlertRuleDetectionType.STATIC.value},
            workflow_condition_group=condition_group,
            name="Example error monitor",
        )
        self.create_data_source_detector(data_source=data_source, detector=self.detector)
        self.create_detector_group(detector=self.detector, group=self.group)
        triggers = self.create_data_condition_group(organization=self.organization)
        self.create_data_condition(
            condition_group=triggers,
            type=Condition.FIRST_SEEN_EVENT,
            comparison=True,
            condition_result=True,
        )
        self.workflow = self.create_workflow(
            organization=self.organization, when_condition_group=triggers
        )
        self.create_detector_workflow(detector=self.detector, workflow=self.workflow)
        self.action_conditions = self.create_data_condition_group(organization=self.organization)
        self.create_workflow_data_condition_group(
            workflow=self.workflow, condition_group=self.action_conditions
        )
        self.create_data_condition_group_action(
            action=self.action, condition_group=self.action_conditions
        )
        self.create_data_condition(
            condition_group=self.action_conditions,
            type=Condition.ISSUE_TYPE,
            comparison={"value": MetricIssue.slug},
            condition_result=True,
        )
        self.config.update(backing_workflow=self.workflow)

    def test_matching_breach_runs_once_and_preserves_original_trigger(self) -> None:
        self.config.update(filters={"all_projects": True, "environments": ["production"]})
        event = self.breach_event(detector_id=self.detector.id)
        with (
            mock.patch("sentry.seer.workflows.breached_metrics.metrics.incr") as incr,
            mock.patch("sentry.seer.workflows.breached_metrics.logger") as logger,
        ):
            self.process_breach_workflow(event)
            run = SeerWorkflowRun.objects.get(workflow_config=self.config)
            trigger = deepcopy(run.extras["snapshot"]["inputs"])
            self.detector.update(name="Edited after breach")
            self.condition.update(comparison=200)
            snapshot = deepcopy(run.extras["snapshot"])
            self.config.update(
                version=self.config.version + 1, output_policy={"review_required": True}
            )

            self.process_breach_workflow(event)
            self.process_breach_workflow(self.breach_event(detector_id=self.detector.id, value=240))

        assert list(SeerWorkflowRun.objects.values_list("id", flat=True)) == [run.id]
        run.refresh_from_db()
        assert run.trigger_key == f"issue_created:{self.group.id}"
        assert run.extras["snapshot"]["inputs"] == trigger
        assert trigger["evidence"]["value"] == 180
        assert trigger["event_id"] == event.event_id
        assert trigger["workflow_id"] == self.workflow.id
        assert trigger["action_id"] == self.action.id
        assert trigger["group_short_id"] == self.group.qualified_short_id
        assert run.extras["snapshot"] == snapshot
        assert run.extras["snapshot"]["config_version"] == self.config.version - 1
        assert run.status == SeerWorkflowRunStatus.FAILED
        assert run.date_completed is not None
        execution = SeerWorkflowRunExecution.objects.get(run=run)
        assert execution.status == SeerWorkflowExecutionStatus.FAILED
        assert execution.date_completed is not None
        assert execution.extras == {
            "error": {
                "code": "service_account_unavailable",
                "message": "The automation has no service account.",
            }
        }
        stored = AdmittedRunExtras.parse_obj(run.extras)
        assert event.occurrence is not None
        stored_trigger = MetricBreachInputs.parse_obj(stored.snapshot.inputs)
        assert stored_trigger.observed_at == event.occurrence.detection_time
        assert stored_trigger.binding_id == self.action.seer_workflow_binding.id
        assert stored.admission.status == "accepted"
        assert stored.admission.reason is None
        assert stored.admission.decided_at <= run.date_completed
        incr.assert_any_call(
            "seer.workflow.trigger",
            tags={"outcome": "accepted", "reason": "none", "deduplicated": "false"},
            sample_rate=1.0,
        )
        incr.assert_any_call(
            "seer.workflow.trigger",
            tags={"outcome": "accepted", "reason": "none", "deduplicated": "true"},
            sample_rate=1.0,
        )
        assert logger.info.call_count == 3
        initial, replayed, later = logger.info.call_args_list
        assert initial.kwargs["extra"]["deduplicated"] is False
        assert replayed.kwargs["extra"]["deduplicated"] is True
        assert later.kwargs["extra"]["deduplicated"] is True

    def test_distinct_actions_dispatch_but_shared_config_creates_one_run(self) -> None:
        shared_action = self.create_action(type=Action.Type.SEER_WORKFLOW)
        Factories.create_seer_workflow_trigger_binding(self.config, shared_action)
        other_action = self.create_action(type=Action.Type.SEER_WORKFLOW)
        other_config = self.create_metric_config(trigger_actions=[other_action])
        self.create_data_condition_group_action(
            action=shared_action, condition_group=self.action_conditions
        )
        self.create_data_condition_group_action(
            action=other_action, condition_group=self.action_conditions
        )

        with mock.patch("sentry.seer.workflows.breached_metrics.logger") as logger:
            self.process_breach_workflow(self.breach_event(detector_id=self.detector.id))

        assert set(SeerWorkflowRun.objects.values_list("workflow_config_id", flat=True)) == {
            self.config.id,
            other_config.id,
        }
        assert SeerWorkflowRun.objects.count() == 2
        assert SeerWorkflowRunExecution.objects.count() == 2
        assert logger.info.call_count == 3
        assert {
            (call.kwargs["extra"]["action_id"], call.kwargs["extra"]["workflow_config_id"])
            for call in logger.info.call_args_list
        } == {
            (self.action.id, self.config.id),
            (shared_action.id, self.config.id),
            (other_action.id, other_config.id),
        }
        assert sorted(
            call.kwargs["extra"]["deduplicated"] for call in logger.info.call_args_list
        ) == [False, False, True]

    def test_backing_workflow_ignores_existing_issue(self) -> None:
        event = self.breach_event(detector_id=self.detector.id)

        result = self.process_breach_workflow(event, is_new=False)

        assert not result.has_triggered_actions()
        assert not SeerWorkflowRun.objects.exists()
        assert not SeerWorkflowRunExecution.objects.exists()

        self.process_breach_workflow(event)

        assert SeerWorkflowRun.objects.get().trigger_key == f"issue_created:{self.group.id}"
        assert SeerWorkflowRunExecution.objects.count() == 1

    def test_registered_action_requires_feature_and_ignores_disabled_breaches(self) -> None:
        event = self.breach_event(detector_id=self.detector.id)
        with (
            self.feature({"organizations:seer-automations": False}),
            mock.patch("sentry.seer.workflows.breached_metrics.metrics.incr") as incr,
        ):
            assert not is_action_permitted(Action.Type.SEER_WORKFLOW, self.organization)
            self.process_breach_workflow(event)

        assert not SeerWorkflowRun.objects.exists()
        incr.assert_any_call(
            "seer.workflow.trigger",
            tags={"outcome": "ignored", "reason": "feature_disabled", "deduplicated": "false"},
            sample_rate=1.0,
        )
        assert is_action_permitted(Action.Type.SEER_WORKFLOW, self.organization)
        self.process_breach_workflow(event)
        assert SeerWorkflowRun.objects.get().workflow_config_id == self.config.id

    def test_cross_organization_binding_is_ignored_before_admission(self) -> None:
        self.config.update(organization=self.create_organization())

        with mock.patch("sentry.seer.workflows.breached_metrics.metrics.incr") as incr:
            self.process_breach_workflow(self.breach_event(detector_id=self.detector.id))

        assert not SeerWorkflowRun.objects.exists()
        assert not SeerWorkflowRunExecution.objects.exists()
        incr.assert_any_call(
            "seer.workflow.trigger",
            tags={"outcome": "ignored", "reason": "missing_binding", "deduplicated": "false"},
            sample_rate=1.0,
        )

    def test_connected_monitors_in_different_projects_feed_the_same_automation(self) -> None:
        project = self.create_project(organization=self.organization)
        event, detector = self.breach_in_project(project)
        self.create_detector_workflow(workflow=self.workflow, detector=detector)
        self.process_breach_workflow(self.breach_event(detector_id=self.detector.id))
        self.process_breach_workflow(event)
        assert set(
            SeerWorkflowRun.objects.filter(workflow_config=self.config).values_list(
                "trigger_key", flat=True
            )
        ) == {f"issue_created:{self.group.id}", f"issue_created:{event.group_id}"}
        assert SeerWorkflowRunExecution.objects.count() == 2

    def test_disconnected_monitor_does_not_start_a_run(self) -> None:
        DetectorWorkflow.objects.filter(detector=self.detector, workflow=self.workflow).delete()
        self.process_breach_workflow(self.breach_event(detector_id=self.detector.id))
        assert not SeerWorkflowRun.objects.exists()

    @mock.patch("sentry.seer.workflows.base.AutomationDefinition.has_quota_available")
    def test_wfe_action_ignores_environment_mismatch_without_history(
        self, admission: mock.MagicMock
    ) -> None:
        self.config.update(filters={"all_projects": True, "environments": ["staging"]})

        with mock.patch("sentry.seer.workflows.breached_metrics.metrics.incr") as incr:
            self.process_breach_workflow(self.breach_event(detector_id=self.detector.id))

        assert not SeerWorkflowRun.objects.exists()
        assert not SeerWorkflowRunExecution.objects.exists()
        admission.assert_not_called()
        incr.assert_any_call(
            "seer.workflow.trigger",
            tags={"outcome": "ignored", "reason": "out_of_scope", "deduplicated": "false"},
            sample_rate=1.0,
        )

    def test_rejected_breach_is_not_readmitted_after_quota_recovers(self) -> None:
        event = self.breach_event(detector_id=self.detector.id)
        with (
            mock.patch(
                "sentry.seer.workflows.base.AutomationDefinition.has_quota_available",
                return_value=False,
            ) as quota,
            mock.patch("sentry.seer.workflows.breached_metrics.metrics.incr") as incr,
        ):
            self.process_breach_workflow(event)
            quota.assert_called_once()
            run = SeerWorkflowRun.objects.get(workflow_config=self.config)
            extras = deepcopy(run.extras)

            quota.reset_mock()
            quota.return_value = True
            self.process_breach_workflow(event)
            self.process_breach_workflow(self.breach_event(detector_id=self.detector.id))

        quota.assert_not_called()
        assert list(SeerWorkflowRun.objects.values_list("id", flat=True)) == [run.id]
        run.refresh_from_db()
        assert run.extras == extras
        assert run.status == SeerWorkflowRunStatus.REJECTED
        assert run.date_completed is not None
        assert run.extras["error"]["code"] == "quota_exceeded"
        stored = AdmittedRunExtras.parse_obj(run.extras)
        assert stored.admission.status == "rejected"
        assert stored.admission.reason == "quota_exceeded"
        assert stored.admission.decided_at <= run.date_completed
        assert not SeerWorkflowRunExecution.objects.exists()
        incr.assert_any_call(
            "seer.workflow.trigger",
            tags={"outcome": "rejected", "reason": "quota_exceeded", "deduplicated": "false"},
            sample_rate=1.0,
        )
        incr.assert_any_call(
            "seer.workflow.trigger",
            tags={"outcome": "rejected", "reason": "quota_exceeded", "deduplicated": "true"},
            sample_rate=1.0,
        )

    @with_feature(["organizations:investigations", "organizations:service-accounts"])
    def test_inactive_service_account_fails_the_run(self) -> None:
        self.attach_service_account()
        assert self.config.service_account_id is not None
        ServiceAccountReplica.objects.filter(
            organization_id=self.organization.id, service_account_id=self.config.service_account_id
        ).update(is_active=False)

        self.process_breach_workflow(self.breach_event(detector_id=self.detector.id))

        run = SeerWorkflowRun.objects.get(workflow_config=self.config)
        assert run.status == SeerWorkflowRunStatus.FAILED
        execution = SeerWorkflowRunExecution.objects.get(run=run)
        assert execution.status == SeerWorkflowExecutionStatus.FAILED
        assert execution.extras == {
            "error": {"code": "dispatch_failed", "message": "Could not start the investigation."}
        }
        assert not Notebook.objects.exists()
        assert not SeerWorkflowOutputLink.objects.exists()

    @with_feature(["organizations:investigations", "organizations:service-accounts"])
    @mock.patch("sentry.tasks.seer.investigation.dispatch_investigation_orchestration_create.delay")
    def test_breach_runs_an_investigation_to_completion(self, dispatch: mock.Mock) -> None:
        self.attach_service_account()
        event = self.breach_event(detector_id=self.detector.id)

        self.process_breach_workflow(event)
        # A redelivered breach must not start a second investigation or dispatch.
        self.process_breach_workflow(event)

        notebook = Notebook.objects.get()
        assert notebook.creator_actor == ActorId(
            ActorType.SERVICE_ACCOUNT, self.config.service_account_id
        )
        assert notebook.created_by_id is None
        dispatch.assert_called_once_with(notebook.orchestration_run.id)
        run = SeerWorkflowRun.objects.get(workflow_config=self.config)
        assert run.status == SeerWorkflowRunStatus.RUNNING
        execution = SeerWorkflowRunExecution.objects.get(run=run)
        assert execution.status == SeerWorkflowExecutionStatus.RUNNING
        assert list(SeerWorkflowOutputLink.objects.values_list("execution_id", "notebook_id")) == [
            (execution.id, notebook.id)
        ]

        notebook.orchestration_run.update(status=InvestigationOrchestrationStatus.COMPLETED)
        finish_investigation_executions(investigation_id=notebook.id)

        run.refresh_from_db()
        execution.refresh_from_db()
        assert run.status == SeerWorkflowRunStatus.COMPLETE
        assert execution.status == SeerWorkflowExecutionStatus.COMPLETE

    @with_feature(["organizations:investigations", "organizations:service-accounts"])
    def test_breach_completes_at_once_when_the_linked_investigation_already_finished(
        self,
    ) -> None:
        self.attach_service_account()
        notebook = self.create_active_investigation(InvestigationOrchestrationStatus.COMPLETED)

        self.process_breach_workflow(self.breach_event(detector_id=self.detector.id))

        run = SeerWorkflowRun.objects.get(workflow_config=self.config)
        assert run.status == SeerWorkflowRunStatus.COMPLETE
        execution = SeerWorkflowRunExecution.objects.get(run=run)
        assert execution.extras == {"error": None}
        assert SeerWorkflowOutputLink.objects.filter(
            execution=execution, notebook=notebook
        ).exists()

    def create_active_investigation(self, status: InvestigationOrchestrationStatus) -> Notebook:
        open_period = get_latest_open_period(self.group)
        assert open_period is not None
        notebook = self.create_notebook(
            self.organization,
            title="Example error spike",
            source_type=NotebookSourceType.METRIC_OPEN_PERIOD,
            source_key=f"metric_open_period:{self.group.id}:{open_period.id}",
            source_revision=1,
        )
        Factories.create_investigation_orchestration_run(notebook, status=status)
        return notebook

    def attach_service_account(self) -> None:
        self.organization.flags.allow_joinleave = True
        self.organization.save()
        with outbox_runner():
            account = self.create_service_account(
                organization=self.organization, project_ids=[self.project.id]
            )
        self.config.update(service_account_id=account.id)

    def process_breach_workflow(
        self, event: GroupEvent, *, is_new: bool = True
    ) -> ProcessWorkflowsResult:
        with self.tasks():
            return process_workflows(
                DelayedWorkflowClient(),
                WorkflowEventData(
                    event=event,
                    group=event.group,
                    group_state=GroupState(
                        id=event.group.id,
                        is_new=is_new,
                        is_regression=False,
                        is_new_group_environment=is_new,
                    ),
                ),
                event.datetime,
            )

    def breach_in_project(self, project: Project) -> tuple[GroupEvent, Detector]:
        conditions = self.create_data_condition_group(organization=self.organization)
        self.create_data_condition(
            condition_group=conditions,
            type=Condition.GREATER,
            comparison=100,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        detector = self.create_detector(
            project=project,
            type=MetricIssue.slug,
            config={"detection_type": AlertRuleDetectionType.STATIC.value},
            workflow_condition_group=conditions,
        )
        subscription = create_snuba_subscription(
            project=project, subscription_type="incidents", snuba_query=self.query
        )
        source = self.create_data_source(
            organization=self.organization,
            source_id=str(subscription.id),
            type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
        )
        self.create_data_source_detector(data_source=source, detector=detector)
        group = self.create_group(
            project=project, type=MetricIssue.type_id, create_open_period=False
        )
        self.create_detector_group(detector=detector, group=group)
        event = self.breach_event(detector_id=self.detector.id)
        assert event.occurrence is not None
        occurrence = self.build_occurrence(
            event_id=event.event_id,
            project_id=project.id,
            type=MetricIssue.type_id,
            evidence_data={**event.occurrence.evidence_data, "detector_id": detector.id},
        )
        stored = self.store_event(
            data={"event_id": event.event_id, "environment": self.environment.name},
            project_id=project.id,
        )
        occurrence.save()
        group_event = stored.for_group(group)
        group_event.occurrence = occurrence
        return group_event, detector


class GetConfigMonitorsBulkTest(TestCase):
    def test_returns_monitors_and_projects_for_metric_configs(self) -> None:
        first_project, second_project, hidden_project = (self.create_project() for _ in range(3))
        monitors = [
            self.create_detector(project=first_project, type=MetricIssue.slug),
            self.create_detector(project=first_project, type=MetricIssue.slug),
            self.create_detector(project=second_project, type=MetricIssue.slug),
        ]
        hidden = self.create_detector(project=hidden_project, type=MetricIssue.slug)
        connected = create_metric_workflow(
            self.organization.id,
            monitor_ids=[*(m.id for m in monitors), hidden.id],
            service_account_grant=GRANT,
        ).get_config()
        unconnected = create_metric_workflow(
            self.organization.id, service_account_grant=GRANT
        ).get_config()
        triage = Factories.create_seer_workflow_config(
            self.organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2
        )

        result = get_config_monitors_bulk(
            [connected, unconnected, triage],
            project_filter=[first_project.id, second_project.id],
        )

        assert result == {connected.id: sorted((m.id, m.project_id) for m in monitors)}


@with_feature("organizations:seer-automations")
class MetricMonitorSelectionTest(OccurrenceTestMixin, TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.monitors = [
            self.create_detector(project=self.create_project(), type=MetricIssue.slug)
            for _ in range(3)
        ]
        self.monitor_ids = [monitor.id for monitor in self.monitors]
        self.config = Factories.create_seer_workflow_config(
            self.organization,
            strategy=SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION,
            enabled=True,
            filters={"all_projects": False, "environments": ["production"]},
        )

    def test_connects_selected_monitors(self) -> None:
        updated = self.select_monitors([*self.monitor_ids, self.monitor_ids[0]])

        workflow = updated.backing_workflow
        assert workflow is not None
        assert workflow.name == "Seer automation"
        assert list(
            workflow.detectorworkflow_set.order_by("detector_id").values_list(
                "detector_id", flat=True
            )
        ) == sorted(self.monitor_ids)
        assert self.project_ids() == {monitor.project_id for monitor in self.monitors}
        assert updated.version == 2

    def test_replaces_selection_idempotently_preserving_other_alerts(self) -> None:
        self.select_monitors(self.monitor_ids[:2])
        backing = Workflow.objects.get(organization=self.organization)
        binding = SeerWorkflowTriggerBinding.objects.get(workflow_config=self.config)
        unrelated = self.create_detector_workflow(
            detector=self.monitors[0], workflow=self.create_workflow(organization=self.organization)
        )
        selected = self.monitor_ids[1:]

        changed = self.select_monitors(selected)
        assert changed.version == 3
        assert self.project_ids() == {monitor.project_id for monitor in self.monitors[1:]}
        connections = list(backing.detectorworkflow_set.values_list("id", flat=True))
        repeated = self.select_monitors([*reversed(selected), selected[0]])
        assert repeated.version == changed.version
        assert list(backing.detectorworkflow_set.values_list("id", flat=True)) == connections

        assert self.select_monitors([]).version == 4
        assert self.project_ids() == set()
        assert not backing.detectorworkflow_set.exists()
        assert DetectorWorkflow.objects.filter(id=unrelated.id).exists()

        assert self.select_monitors(self.monitor_ids).version == 5
        assert Workflow.objects.filter(organization=self.organization).count() == 2
        assert SeerWorkflowTriggerBinding.objects.get(workflow_config=self.config).id == binding.id
        assert set(backing.detectorworkflow_set.values_list("detector_id", flat=True)) == set(
            self.monitor_ids
        )

    def test_deleted_monitors_leave_scope(self) -> None:
        self.select_monitors(self.monitor_ids)

        self.monitors[0].update(status=ObjectStatus.PENDING_DELETION)
        self.monitors[1].delete()

        assert self.project_ids() == {self.monitors[2].project_id}

    def test_deleted_backing_workflow_empties_scope_and_is_replaced(self) -> None:
        original = self.select_monitors(self.monitor_ids)
        backing = original.backing_workflow
        assert backing is not None
        backing.update(status=ObjectStatus.PENDING_DELETION)
        assert self.project_ids() == set()

        replaced = self.select_monitors(self.monitor_ids[:1])

        assert replaced.backing_workflow is not None
        assert replaced.backing_workflow_id != backing.id
        assert replaced.backing_workflow.status == ObjectStatus.ACTIVE
        assert replaced.version == original.version + 1
        assert self.project_ids() == {self.monitors[0].project_id}
        assert SeerWorkflowTriggerBinding.objects.filter(workflow_config=self.config).count() == 2

        Workflow.objects_for_deletion.filter(id=replaced.backing_workflow_id).delete()
        self.config.refresh_from_db()
        assert self.config.backing_workflow is None
        assert self.project_ids() == set()

    def test_has_all_projects_with_monitors_in_some_projects(self) -> None:
        assert self.has_all_projects() is False
        self.select_monitors(self.monitor_ids[:2])
        assert self.has_all_projects() is False

    def test_has_all_projects_with_monitors_in_every_project(self) -> None:
        self.select_monitors(self.monitor_ids)
        assert self.has_all_projects() is True

    def test_has_all_projects_with_deleted_monitor(self) -> None:
        self.select_monitors(self.monitor_ids)
        self.monitors[0].update(status=ObjectStatus.PENDING_DELETION)
        assert self.has_all_projects() is False

    def test_create_with_monitors_connects_monitors(self) -> None:
        workflow = create_metric_workflow(
            self.organization.id,
            enabled=True,
            environments=["production"],
            monitor_ids=self.monitor_ids,
            extras=SeerWorkflowConfigExtras(name="Latency breaches"),
            service_account_grant=GRANT,
        )

        config = workflow.get_config()
        assert config.strategy == SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION
        assert config.enabled is True
        assert config.filters == {"all_projects": False, "environments": ["production"]}
        assert workflow.extras.name == "Latency breaches"
        assert config.version == 1
        assert config.backing_workflow is not None
        assert set(
            config.backing_workflow.detectorworkflow_set.values_list("detector_id", flat=True)
        ) == set(self.monitor_ids)
        assert set(workflow.get_project_ids()) == {monitor.project_id for monitor in self.monitors}

    def test_create_with_monitors_rolls_back_on_invalid_monitor(self) -> None:
        foreign = self.create_detector(
            project=self.create_project(organization=self.create_organization()),  # other org
            type=MetricIssue.slug,
        )

        with pytest.raises(ValueError, match="active metric monitors in this organization"):
            create_metric_workflow(
                self.organization.id,
                monitor_ids=[self.monitor_ids[0], foreign.id],
                service_account_grant=GRANT,
            )

        assert list(SeerWorkflowConfig.objects.filter(organization=self.organization)) == [
            self.config
        ]
        assert not Workflow.objects.exists()

    @mock.patch("sentry.seer.workflows.workflow.MAX_WORKFLOW_CONFIGS_PER_ORG", 2)
    def test_create_with_monitors_caps_configs_per_organization(self) -> None:
        # setUp already created one metric automation.
        Factories.create_seer_workflow_config(
            self.organization, strategy=SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION
        )

        with pytest.raises(ValueError, match="at most 2 automations"):
            create_metric_workflow(
                self.organization.id, monitor_ids=self.monitor_ids, service_account_grant=GRANT
            )

        assert SeerWorkflowConfig.objects.filter(organization=self.organization).count() == 2
        assert not Workflow.objects.exists()

    @mock.patch("sentry.seer.workflows.workflow.MAX_WORKFLOW_CONFIGS_PER_ORG", 3)
    def test_metric_and_triage_automations_share_the_org_limit(self) -> None:
        def create_triage() -> SeerWorkflow:
            return SeerWorkflow.create(
                organization_id=self.organization.id,
                strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2,
                schedule=SeerWorkflowSchedule.DAILY,
                scope=SelectedProjects(()),
                service_account_grant=GRANT,
            )

        def create_metric() -> SeerWorkflow:
            return create_metric_workflow(
                self.organization.id, monitor_ids=self.monitor_ids, service_account_grant=GRANT
            )

        # setUp already created one metric automation.
        create_triage()
        create_metric()

        with pytest.raises(ValueError, match="at most 3 automations"):
            create_triage()
        with pytest.raises(ValueError, match="at most 3 automations"):
            create_metric()

        assert SeerWorkflowConfig.objects.filter(organization=self.organization).count() == 3

    def test_rejects_ineligible_monitors_without_writing_graph(self) -> None:
        invalid_monitors = [
            self.create_detector(project=self.project),
            self.create_detector(
                project=self.create_project(organization=self.create_organization()),
                type=MetricIssue.slug,
            ),
            self.create_detector(
                project=self.project, type=MetricIssue.slug, status=ObjectStatus.PENDING_DELETION
            ),
            self.create_detector(
                project=self.project, type=MetricIssue.slug, status=ObjectStatus.DISABLED
            ),
            self.create_detector(
                project=self.create_project(status=ObjectStatus.PENDING_DELETION),
                type=MetricIssue.slug,
            ),
        ]
        for monitor in invalid_monitors:
            with pytest.raises(ValueError, match="active metric monitors in this organization"):
                self.select_monitors([self.monitor_ids[0], monitor.id])

        self.config.refresh_from_db()
        assert self.config.version == 1
        assert not Workflow.objects.exists()
        assert not SeerWorkflowTriggerBinding.objects.exists()

    def test_rejects_foreign_config_and_non_metric_strategy(self) -> None:
        other = Factories.create_seer_workflow_config(
            self.create_organization(), strategy=SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION
        )
        foreign = SeerWorkflow(config_id=other.id, organization_id=self.organization.id)
        with pytest.raises(SeerWorkflowConfig.DoesNotExist), foreign.update_config() as update:
            update.set_scope(SelectedMonitors(tuple(self.monitor_ids)))

        self.config.update(strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2)
        with pytest.raises(ValueError, match="does not support monitor selection"):
            self.select_monitors(self.monitor_ids)
        assert not Workflow.objects.exists()

    def test_connected_breach_starts_run_and_disconnect_stops_it(self) -> None:
        self.create_project()
        self.select_monitors(self.monitor_ids)
        for monitor in self.monitors:
            self.process_breach(monitor)
        assert SeerWorkflowRun.objects.filter(workflow_config=self.config).count() == 3
        assert set(
            SeerWorkflowRunExecution.objects.values_list("extras__error__code", flat=True)
        ) == {"source_unavailable"}
        for run in SeerWorkflowRun.objects.filter(workflow_config=self.config):
            assert set(run.extras["snapshot"]["project_ids"]) == {
                monitor.project_id for monitor in self.monitors
            }

        self.select_monitors([])
        self.process_breach(self.monitors[0])
        assert SeerWorkflowRun.objects.filter(workflow_config=self.config).count() == 3

    def select_monitors(self, monitor_ids: list[int]) -> SeerWorkflowConfig:
        workflow = SeerWorkflow(config_id=self.config.id, organization_id=self.organization.id)
        with workflow.update_config() as update:
            update.set_scope(SelectedMonitors(tuple(monitor_ids)))
        return workflow.get_config()

    def has_all_projects(self) -> bool:
        return SeerWorkflow(
            config_id=self.config.id, organization_id=self.organization.id
        ).has_all_projects()

    def project_ids(self) -> set[int]:
        return set(
            SeerWorkflow(
                config_id=self.config.id, organization_id=self.organization.id
            ).get_project_ids()
        )

    def process_breach(self, monitor: Detector) -> None:
        group = self.create_group(
            project=monitor.project, type=MetricIssue.type_id, create_open_period=False
        )
        self.create_detector_group(detector=monitor, group=group)
        event_id = uuid4().hex
        occurrence = self.build_occurrence(
            event_id=event_id,
            project_id=group.project_id,
            type=MetricIssue.type_id,
            evidence_data={"detector_id": monitor.id, "value": 180},
        )
        occurrence.save()
        event = self.store_event(
            data={"event_id": event_id, "environment": "production"}, project_id=group.project_id
        ).for_group(group)
        event.occurrence = occurrence
        with self.tasks():
            process_workflows(
                DelayedWorkflowClient(),
                WorkflowEventData(
                    event=event,
                    group=group,
                    group_state=GroupState(
                        id=group.id, is_new=True, is_regression=False, is_new_group_environment=True
                    ),
                ),
                event.datetime,
            )
