from __future__ import annotations

from copy import deepcopy
from dataclasses import replace
from datetime import timedelta
from unittest import mock
from uuid import uuid4

import pytest
from pydantic import ValidationError

from sentry.eventstream.base import GroupState
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
from sentry.models.project import Project
from sentry.seer.models.workflow import (
    SeerWorkflowConfig,
    SeerWorkflowExecutionStatus,
    SeerWorkflowRun,
    SeerWorkflowRunExecution,
    SeerWorkflowRunStatus,
    SeerWorkflowStrategy,
)
from sentry.seer.workflows.breached_metrics import (
    AcceptedMetricBreach,
    BreachedMetricWorkflow,
    IgnoredMetricBreach,
    MetricBreachRunExtras,
    MetricBreachTrigger,
)
from sentry.services.eventstore.models import GroupEvent
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories
from sentry.testutils.helpers.features import with_feature
from sentry.workflow_engine.buffer.batch_client import DelayedWorkflowClient
from sentry.workflow_engine.models import Action, Detector, DetectorWorkflow
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.processors.action import is_action_permitted
from sentry.workflow_engine.processors.evaluations import ProcessWorkflowsResult
from sentry.workflow_engine.processors.workflow import process_workflows
from sentry.workflow_engine.types import DetectorPriorityLevel, WorkflowEventData
from tests.sentry.issues.test_utils import OccurrenceTestMixin


class BreachedMetricWorkflowTestCase(OccurrenceTestMixin, TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.environment = self.create_environment(project=self.project, name="production")
        self.group = self.create_group(
            project=self.project,
            type=MetricIssue.type_id,
            message="Example error spike",
            create_open_period=False,
        )
        self.action = self.create_action(type=Action.Type.SEER_WORKFLOW)
        self.config = BreachedMetricWorkflow.create(self.organization.id, enabled=True).config
        Factories.create_seer_workflow_trigger_binding(self.config, self.action)

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
    def test_creates_all_projects_config_preserving_environment_filter(self) -> None:
        workflow = BreachedMetricWorkflow.create(self.organization.id, environments=["production"])

        workflow.config.refresh_from_db()
        assert workflow.config.strategy == SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION
        assert workflow.config.enabled is False
        assert workflow.config.filters == {"all_projects": True, "environments": ["production"]}

    def test_replaying_old_metadata_logs_validation_error_without_replacing_run(self) -> None:
        event = self.breach_event(detector_id=1)
        workflow = BreachedMetricWorkflow(self.config)
        result = workflow.accept(
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
            workflow.accept(
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
        workflow = BreachedMetricWorkflow(self.config)
        with (
            mock.patch(
                "sentry.seer.workflows.runs.SeerWorkflowRunExecution.objects.bulk_create",
                side_effect=RuntimeError("Cannot create execution"),
            ),
            pytest.raises(RuntimeError, match="Cannot create execution"),
        ):
            workflow.accept(
                self.group, event, binding=self.action.seer_workflow_binding, workflow_id=1
            )
        assert not SeerWorkflowRun.objects.exists()
        assert not SeerWorkflowRunExecution.objects.exists()

    def test_accept_uses_latest_scope_from_the_locked_config(self) -> None:
        workflow = BreachedMetricWorkflow(self.config)
        SeerWorkflowConfig.objects.filter(id=self.config.id).update(
            filters={"all_projects": True, "environments": ["staging"]}
        )

        result = workflow.accept(
            self.group,
            self.breach_event(detector_id=1),
            binding=self.action.seer_workflow_binding,
            workflow_id=1,
        )

        assert result == IgnoredMetricBreach("out_of_scope")
        assert not SeerWorkflowRun.objects.exists()

    def test_ignored_configuration_reports_reason_without_starting_work(self) -> None:
        self.config.update(enabled=False)

        rejected = BreachedMetricWorkflow(self.config).accept(
            self.group,
            self.breach_event(detector_id=1),
            binding=self.action.seer_workflow_binding,
            workflow_id=1,
        )

        assert rejected == IgnoredMetricBreach("configuration_unavailable")
        assert not SeerWorkflowRun.objects.exists()
        assert not SeerWorkflowRunExecution.objects.exists()

    def test_ignored_malformed_source_reports_reason(self) -> None:
        event = self.breach_event(detector_id=1)
        assert event.occurrence is not None
        event.occurrence = replace(event.occurrence, evidence_data={})

        rejected = BreachedMetricWorkflow(self.config).accept(
            self.group,
            event,
            binding=self.action.seer_workflow_binding,
            workflow_id=1,
        )

        assert rejected == IgnoredMetricBreach("invalid_source")
        assert not SeerWorkflowRun.objects.exists()

    def test_other_organization_configuration_does_not_accept_the_breach(self) -> None:
        other_action = self.create_action(type=Action.Type.SEER_WORKFLOW)
        other = Factories.create_seer_workflow_config(
            self.create_organization(),
            strategy=SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION,
            enabled=True,
            filters={"all_projects": True},
            trigger_actions=[other_action],
        )

        result = BreachedMetricWorkflow(other).accept(
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

    def test_matching_breach_runs_once_and_preserves_original_trigger(self) -> None:
        self.config.update(filters={"all_projects": True, "environments": ["production"]})
        event = self.breach_event(detector_id=self.detector.id)
        with (
            mock.patch("sentry.seer.workflows.action.metrics.incr") as incr,
            mock.patch("sentry.seer.workflows.action.logger") as logger,
        ):
            self.process_breach_workflow(event)
            run = SeerWorkflowRun.objects.get(workflow_config=self.config)
            trigger = deepcopy(run.extras["snapshot"]["inputs"])
            self.detector.update(name="Edited after breach")
            self.condition.update(comparison=200)
            snapshot = deepcopy(run.extras["snapshot"])
            self.config.update(version=2, output_policy={"review_required": True})

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
        assert run.extras["snapshot"] == snapshot
        assert run.extras["snapshot"]["config_version"] == 1
        assert run.status == SeerWorkflowRunStatus.COMPLETE
        assert run.date_completed is not None
        execution = SeerWorkflowRunExecution.objects.get(run=run)
        assert execution.status == SeerWorkflowExecutionStatus.COMPLETE
        assert execution.date_completed is not None
        assert execution.extras == {"result": "noop", "error": None}
        stored = MetricBreachRunExtras.parse_obj(run.extras)
        assert event.occurrence is not None
        stored_trigger = MetricBreachTrigger.parse_obj(stored.snapshot.inputs)
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
        other_config = BreachedMetricWorkflow.create(self.organization.id, enabled=True).config
        Factories.create_seer_workflow_trigger_binding(other_config, other_action)
        self.create_data_condition_group_action(
            action=shared_action, condition_group=self.action_conditions
        )
        self.create_data_condition_group_action(
            action=other_action, condition_group=self.action_conditions
        )

        with mock.patch("sentry.seer.workflows.action.logger") as logger:
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

    def test_action_ignores_existing_issue_without_first_seen_condition(self) -> None:
        self.workflow.update(when_condition_group=None)
        event = self.breach_event(detector_id=self.detector.id)

        result = self.process_breach_workflow(event, is_new=False)

        assert result.has_triggered_actions()
        assert not SeerWorkflowRun.objects.exists()
        assert not SeerWorkflowRunExecution.objects.exists()

        self.process_breach_workflow(event)

        assert SeerWorkflowRun.objects.get().trigger_key == f"issue_created:{self.group.id}"
        assert SeerWorkflowRunExecution.objects.count() == 1

    def test_registered_action_requires_feature_and_ignores_disabled_breaches(self) -> None:
        event = self.breach_event(detector_id=self.detector.id)
        with (
            self.feature({"organizations:seer-automations": False}),
            mock.patch("sentry.seer.workflows.action.metrics.incr") as incr,
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

        with mock.patch("sentry.seer.workflows.action.metrics.incr") as incr:
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

    @mock.patch("sentry.seer.workflows.workflow.SeerWorkflow.has_quota_available")
    def test_wfe_action_ignores_environment_mismatch_without_history(
        self, admission: mock.MagicMock
    ) -> None:
        self.config.update(filters={"all_projects": True, "environments": ["staging"]})

        with mock.patch("sentry.seer.workflows.action.metrics.incr") as incr:
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
                "sentry.seer.workflows.workflow.SeerWorkflow.has_quota_available",
                return_value=False,
            ) as quota,
            mock.patch("sentry.seer.workflows.action.metrics.incr") as incr,
        ):
            self.process_breach_workflow(event)
            quota.assert_called_once_with()
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
        stored = MetricBreachRunExtras.parse_obj(run.extras)
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
