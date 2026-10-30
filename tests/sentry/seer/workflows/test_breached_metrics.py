from __future__ import annotations

from copy import deepcopy
from dataclasses import replace
from datetime import timedelta
from unittest import mock
from uuid import uuid4

import pytest
from django.db import connections, router, transaction
from django.test.utils import CaptureQueriesContext
from pydantic import ValidationError

from sentry.constants import ObjectStatus
from sentry.eventstream.base import GroupState
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
from sentry.models.project import Project
from sentry.seer.models.workflow import (
    SeerWorkflowConfig,
    SeerWorkflowConfigProject,
    SeerWorkflowExecutionStatus,
    SeerWorkflowRun,
    SeerWorkflowRunExecution,
    SeerWorkflowRunStatus,
    SeerWorkflowStrategy,
    SeerWorkflowTriggerBinding,
)
from sentry.seer.workflows.breached_metrics import (
    AcceptedMetricBreach,
    BreachedMetricWorkflow,
    IgnoredMetricBreach,
    MetricBreachRunExtras,
    MetricBreachTrigger,
)
from sentry.seer.workflows.workflow import SeerWorkflow, SelectedProjects
from sentry.services.eventstore.models import GroupEvent
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories
from sentry.testutils.helpers.features import with_feature
from sentry.workflow_engine.buffer.batch_client import DelayedWorkflowClient
from sentry.workflow_engine.models import (
    Action,
    DataConditionGroup,
    DataConditionGroupAction,
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
        self.config = BreachedMetricWorkflow.create(self.organization.id, enabled=True).get_config()
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

        config = workflow.get_config()
        assert config.strategy == SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION
        assert config.enabled is False
        assert config.filters == {"all_projects": True, "environments": ["production"]}

    def test_project_selection_is_managed_by_connected_monitors(self) -> None:
        with pytest.raises(ValueError, match="selected by connecting monitors"):
            SeerWorkflow(
                config_id=self.config.id, organization_id=self.config.organization_id
            ).set_project_selection(SelectedProjects(project_ids=(self.project.id,)))

        self.config.refresh_from_db()
        assert self.config.filters["all_projects"] is True

    def test_replaying_old_metadata_logs_validation_error_without_replacing_run(self) -> None:
        event = self.breach_event(detector_id=1)
        workflow = BreachedMetricWorkflow(
            config_id=self.config.id, organization_id=self.config.organization_id
        )
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
        workflow = BreachedMetricWorkflow(
            config_id=self.config.id, organization_id=self.config.organization_id
        )
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
        workflow = BreachedMetricWorkflow(
            config_id=self.config.id, organization_id=self.config.organization_id
        )
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

    def test_admission_and_run_creation_lock_current_config(self) -> None:
        workflow = BreachedMetricWorkflow(
            config_id=self.config.id, organization_id=self.organization.id
        )
        event = self.breach_event(detector_id=1)
        binding = self.action.seer_workflow_binding
        SeerWorkflowConfig.objects.filter(id=self.config.id).update(
            version=3,
            filters={"all_projects": True, "environments": ["production"]},
            output_policy={"review_required": True},
        )

        with CaptureQueriesContext(connections[router.db_for_write(SeerWorkflowConfig)]) as queries:
            result = workflow.accept(self.group, event, binding=binding, workflow_id=1)

        assert isinstance(result, AcceptedMetricBreach)
        assert result.created is True
        snapshot = MetricBreachRunExtras.parse_obj(result.run.extras).snapshot
        assert snapshot.config_version == 3
        assert snapshot.filters == {"all_projects": True, "environments": ["production"]}
        assert snapshot.output_policy == {"review_required": True}
        config_reads = [
            query["sql"] for query in queries if 'FROM "seer_workflowconfig"' in query["sql"]
        ]
        assert len(config_reads) == 2
        assert all("FOR UPDATE" in query for query in config_reads)

    def test_ignored_configuration_reports_reason_without_starting_work(self) -> None:
        self.config.update(enabled=False)

        rejected = BreachedMetricWorkflow(
            config_id=self.config.id, organization_id=self.config.organization_id
        ).accept(
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

        rejected = BreachedMetricWorkflow(
            config_id=self.config.id, organization_id=self.config.organization_id
        ).accept(
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

        result = BreachedMetricWorkflow(
            config_id=other.id, organization_id=other.organization_id
        ).accept(
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
        other_config = BreachedMetricWorkflow.create(
            self.organization.id, enabled=True
        ).get_config()
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

    def test_creates_complete_graph_for_existing_monitors(self) -> None:
        Factories.create_seer_workflow_config_project(self.config, self.monitors[0].project)

        updated = self.select_monitors([*self.monitor_ids, self.monitor_ids[0]])

        workflow = Workflow.objects.get(organization=self.organization)
        binding = SeerWorkflowTriggerBinding.objects.get(workflow_config=self.config)
        assert updated.backing_workflow_id == workflow.id
        assert updated.filters == {"all_projects": True, "environments": ["production"]}
        assert updated.version == 2
        assert not SeerWorkflowConfigProject.objects.filter(config=self.config).exists()
        assert set(workflow.detectorworkflow_set.values_list("detector_id", flat=True)) == set(
            self.monitor_ids
        )
        assert workflow.enabled
        assert workflow.when_condition_group is not None
        assert workflow.when_condition_group.logic_type == DataConditionGroup.Type.ANY_SHORT_CIRCUIT
        trigger = workflow.when_condition_group.conditions.get()
        assert (trigger.type, trigger.comparison) == (Condition.FIRST_SEEN_EVENT, True)
        action = binding.trigger_action
        assert (action.type, action.config, action.data) == (Action.Type.SEER_WORKFLOW, {}, {})
        action_group = workflow.workflowdataconditiongroup_set.get().condition_group
        assert DataConditionGroupAction.objects.get(condition_group=action_group).action == action
        condition = action_group.conditions.get()
        assert (condition.type, condition.comparison) == (
            Condition.ISSUE_TYPE,
            {"value": MetricIssue.slug},
        )

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
        connections = list(backing.detectorworkflow_set.values_list("id", flat=True))
        repeated = self.select_monitors([*reversed(selected), selected[0]])
        assert repeated.version == changed.version
        assert list(backing.detectorworkflow_set.values_list("id", flat=True)) == connections

        assert self.select_monitors([]).version == 4
        assert not backing.detectorworkflow_set.exists()
        assert DetectorWorkflow.objects.filter(id=unrelated.id).exists()

        assert self.select_monitors(self.monitor_ids).version == 5
        assert Workflow.objects.filter(organization=self.organization).count() == 2
        assert SeerWorkflowTriggerBinding.objects.get(workflow_config=self.config).id == binding.id
        assert set(backing.detectorworkflow_set.values_list("detector_id", flat=True)) == set(
            self.monitor_ids
        )

    def test_empty_selection_provisions_once_and_reuses_disabled_workflow(self) -> None:
        created = self.select_monitors([])
        backing = Workflow.objects.get(organization=self.organization)
        backing.update(enabled=False)

        assert self.select_monitors([]).version == created.version
        self.select_monitors(self.monitor_ids)

        backing.refresh_from_db()
        assert not backing.enabled
        assert Workflow.objects.filter(organization=self.organization).count() == 1
        assert set(backing.detectorworkflow_set.values_list("detector_id", flat=True)) == set(
            self.monitor_ids
        )

    def test_logs_committed_connection_changes_and_skips_unchanged_saves(self) -> None:
        with mock.patch("sentry.seer.workflows.breached_metrics.logger") as logger:
            with (
                self.capture_on_commit_callbacks(execute=True),
                transaction.atomic(router.db_for_write(SeerWorkflowConfig)),
            ):
                created = self.select_monitors(self.monitor_ids[:1])
                logger.info.assert_not_called()

            logger.info.assert_called_once_with(
                "seer.workflow.monitors_updated",
                extra={
                    "organization_id": self.organization.id,
                    "workflow_config_id": self.config.id,
                    "workflow_id": created.backing_workflow_id,
                    "config_version": created.version,
                    "workflow_created": True,
                    "monitor_count": 1,
                    "added_count": 1,
                    "removed_count": 0,
                },
            )
            logger.info.reset_mock()

            with self.capture_on_commit_callbacks(execute=True):
                self.select_monitors(self.monitor_ids[:1])
                changed = self.select_monitors(self.monitor_ids[1:])

            logger.info.assert_called_once_with(
                "seer.workflow.monitors_updated",
                extra={
                    "organization_id": self.organization.id,
                    "workflow_config_id": self.config.id,
                    "workflow_id": created.backing_workflow_id,
                    "config_version": changed.version,
                    "workflow_created": False,
                    "monitor_count": 2,
                    "added_count": 2,
                    "removed_count": 1,
                },
            )

    def test_outer_transaction_rollback_does_not_log_connection_change(self) -> None:
        with (
            mock.patch("sentry.seer.workflows.breached_metrics.logger") as logger,
            self.capture_on_commit_callbacks(execute=True),
        ):
            with (
                pytest.raises(RuntimeError, match="API update failed"),
                transaction.atomic(router.db_for_write(SeerWorkflowConfig)),
            ):
                self.select_monitors(self.monitor_ids)
                raise RuntimeError("API update failed")

        logger.info.assert_not_called()
        self.config.refresh_from_db()
        assert self.config.backing_workflow_id is None

    def test_other_bindings_do_not_change_managed_monitor_selection(self) -> None:
        created = self.select_monitors(self.monitor_ids)
        backing = created.backing_workflow
        assert backing is not None
        other = self.create_bound_workflow(enabled=True)
        connection = self.create_detector_workflow(detector=self.monitors[0], workflow=other)
        binding_ids = list(SeerWorkflowTriggerBinding.objects.values_list("id", flat=True))

        assert self.select_monitors(self.monitor_ids).version == created.version
        self.select_monitors(self.monitor_ids[1:])

        assert set(backing.detectorworkflow_set.values_list("detector_id", flat=True)) == set(
            self.monitor_ids[1:]
        )
        other.refresh_from_db()
        assert other.enabled
        assert DetectorWorkflow.objects.get(workflow=other).id == connection.id
        assert list(SeerWorkflowTriggerBinding.objects.values_list("id", flat=True)) == binding_ids

    def test_existing_binding_does_not_imply_ownership(self) -> None:
        other = self.create_bound_workflow(enabled=True)
        connection = self.create_detector_workflow(detector=self.monitors[0], workflow=other)

        created = self.select_monitors(self.monitor_ids[1:])

        assert created.backing_workflow is not None
        assert created.backing_workflow_id != other.id
        assert set(
            created.backing_workflow.detectorworkflow_set.values_list("detector_id", flat=True)
        ) == set(self.monitor_ids[1:])
        assert DetectorWorkflow.objects.get(workflow=other).id == connection.id
        assert SeerWorkflowTriggerBinding.objects.filter(workflow_config=self.config).count() == 2

    def test_rejects_backing_workflow_from_another_organization(self) -> None:
        other = self.create_workflow(organization=self.create_organization())
        self.config.update(backing_workflow=other)

        with pytest.raises(Workflow.DoesNotExist):
            self.select_monitors(self.monitor_ids)

        assert not DetectorWorkflow.objects.exists()
        assert not Workflow.objects.filter(organization=self.organization).exists()
        assert not SeerWorkflowTriggerBinding.objects.exists()

    def test_rejects_changes_to_workflow_shared_with_other_actions(self) -> None:
        self.select_monitors(self.monitor_ids)
        backing = Workflow.objects.get(organization=self.organization)
        self.create_data_condition_group_action(
            action=self.create_action(),
            condition_group=backing.workflowdataconditiongroup_set.get().condition_group,
        )

        with pytest.raises(ValueError, match="only this automation's actions"):
            self.select_monitors([])

        assert set(backing.detectorworkflow_set.values_list("detector_id", flat=True)) == set(
            self.monitor_ids
        )

    def test_automations_keep_independent_monitor_selections(self) -> None:
        self.select_monitors(self.monitor_ids)
        other = Factories.create_seer_workflow_config(
            self.organization, strategy=SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION
        )
        BreachedMetricWorkflow(
            config_id=other.id, organization_id=self.organization.id
        ).set_monitor_selection(self.monitor_ids)
        self.select_monitors([])

        remaining = Workflow.objects.get(detectorworkflow__detector=self.monitors[0])
        assert set(remaining.detectorworkflow_set.values_list("detector_id", flat=True)) == set(
            self.monitor_ids
        )
        action_group = remaining.workflowdataconditiongroup_set.get().condition_group
        action = DataConditionGroupAction.objects.get(condition_group=action_group).action
        assert action.seer_workflow_binding.workflow_config_id == other.id

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

    def test_snoozed_monitor_can_be_connected(self) -> None:
        self.monitors[0].update(enabled=False)
        self.select_monitors([self.monitor_ids[0]])
        assert DetectorWorkflow.objects.filter(detector=self.monitors[0]).exists()

    def test_rejects_foreign_config_and_non_metric_strategy(self) -> None:
        other = Factories.create_seer_workflow_config(
            self.create_organization(), strategy=SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION
        )
        with pytest.raises(SeerWorkflowConfig.DoesNotExist):
            BreachedMetricWorkflow(
                config_id=other.id, organization_id=self.organization.id
            ).set_monitor_selection(self.monitor_ids)

        self.config.update(strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2)
        with pytest.raises(ValueError, match="Only metric automations"):
            self.select_monitors(self.monitor_ids)
        assert not Workflow.objects.exists()

    def test_failed_binding_rolls_back_graph_and_config_changes(self) -> None:
        before_groups = DataConditionGroup.objects.count()
        with (
            mock.patch(
                "sentry.seer.workflows.breached_metrics.SeerWorkflowTriggerBinding.objects.create",
                side_effect=RuntimeError("binding failed"),
            ),
            pytest.raises(RuntimeError, match="binding failed"),
        ):
            self.select_monitors(self.monitor_ids)

        assert not Workflow.objects.exists()
        assert not Action.objects.exists()
        assert not DetectorWorkflow.objects.exists()
        assert DataConditionGroup.objects.count() == before_groups
        self.config.refresh_from_db()
        assert self.config.version == 1
        assert self.config.backing_workflow_id is None
        assert self.config.filters == {"all_projects": False, "environments": ["production"]}

    def test_connected_breach_starts_run_and_disconnect_stops_it(self) -> None:
        self.select_monitors(self.monitor_ids)
        for monitor in self.monitors:
            self.process_breach(monitor)
        assert SeerWorkflowRun.objects.filter(workflow_config=self.config).count() == 3
        assert set(SeerWorkflowRunExecution.objects.values_list("extras__result", flat=True)) == {
            "noop"
        }

        self.select_monitors([])
        self.process_breach(self.monitors[0])
        assert SeerWorkflowRun.objects.filter(workflow_config=self.config).count() == 3

    def test_failed_replacement_preserves_connections_and_config_version(self) -> None:
        original = self.select_monitors(self.monitor_ids[:2])
        with (
            mock.patch(
                "sentry.seer.workflows.breached_metrics.DetectorWorkflow.objects.bulk_create",
                side_effect=RuntimeError("connection failed"),
            ),
            pytest.raises(RuntimeError, match="connection failed"),
        ):
            self.select_monitors(self.monitor_ids[1:])

        self.config.refresh_from_db()
        assert self.config.version == original.version
        assert set(DetectorWorkflow.objects.values_list("detector_id", flat=True)) == set(
            self.monitor_ids[:2]
        )

    def select_monitors(self, monitor_ids: list[int]) -> SeerWorkflowConfig:
        workflow = BreachedMetricWorkflow(
            config_id=self.config.id, organization_id=self.organization.id
        )
        workflow.set_monitor_selection(monitor_ids)
        return workflow.get_config()

    def create_bound_workflow(self, *, enabled: bool) -> Workflow:
        workflow = self.create_workflow(organization=self.organization, enabled=enabled)
        group = self.create_data_condition_group(organization=self.organization)
        self.create_workflow_data_condition_group(workflow=workflow, condition_group=group)
        action = self.create_action(type=Action.Type.SEER_WORKFLOW)
        self.create_data_condition_group_action(condition_group=group, action=action)
        Factories.create_seer_workflow_trigger_binding(self.config, action)
        return workflow

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
