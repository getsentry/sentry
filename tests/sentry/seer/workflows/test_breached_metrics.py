from __future__ import annotations

from copy import deepcopy
from dataclasses import replace
from datetime import timedelta
from unittest import mock
from uuid import uuid4

import pytest
from pydantic import ValidationError

from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
from sentry.seer.models.workflow import (
    SeerWorkflowConfig,
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
    RejectedMetricBreach,
)
from sentry.seer.workflows.workflow import SeerWorkflow, SelectedProjects
from sentry.services.eventstore.models import GroupEvent
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories
from sentry.testutils.helpers.features import with_feature
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel
from tests.sentry.issues.test_utils import OccurrenceTestMixin


@with_feature("organizations:seer-automations")
class BreachedMetricWorkflowTest(OccurrenceTestMixin, TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.enterContext(
            mock.patch.object(
                Action, "get_handler", return_value=mock.Mock(config_schema={}, data_schema={})
            )
        )
        self.environment = self.create_environment(project=self.project, name="production")
        self.group = self.create_group(
            project=self.project,
            type=MetricIssue.type_id,
            message="Example error spike",
            create_open_period=False,
        )
        query = create_snuba_query(
            query_type=SnubaQuery.Type.ERROR,
            dataset=Dataset.Events,
            query="transaction:example",
            aggregate="count()",
            time_window=timedelta(minutes=5),
            resolution=timedelta(minutes=1),
            environment=self.environment,
        )
        self.query = query
        subscription = create_snuba_subscription(
            project=self.project, subscription_type="incidents", snuba_query=query
        )
        data_source = self.create_data_source(
            organization=self.organization,
            source_id=str(subscription.id),
            type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
        )
        self.data_source = data_source
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
        self.workflow = self.create_workflow(organization=self.organization)
        self.create_detector_workflow(detector=self.detector, workflow=self.workflow)
        self.action = self.create_action(type=Action.Type.SEER_WORKFLOW)
        self.action_conditions = self.create_data_condition_group(organization=self.organization)
        self.create_workflow_data_condition_group(
            workflow=self.workflow, condition_group=self.action_conditions
        )
        self.create_data_condition_group_action(
            action=self.action, condition_group=self.action_conditions
        )
        self.config = BreachedMetricWorkflow.create(self.organization.id, enabled=True).config
        Factories.create_seer_workflow_trigger_binding(self.config, self.action)

    def test_creates_all_projects_config_preserving_environment_filter(self) -> None:
        workflow = BreachedMetricWorkflow.create(self.organization.id, environments=["production"])

        workflow.config.refresh_from_db()
        assert workflow.config.strategy == SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION
        assert workflow.config.enabled is False
        assert workflow.config.filters == {"all_projects": True, "environments": ["production"]}

    def test_project_selection_is_managed_by_connected_monitors(self) -> None:
        with pytest.raises(ValueError, match="selected by connecting monitors"):
            SeerWorkflow(self.config).set_project_selection(
                SelectedProjects(project_ids=(self.project.id,))
            )

        self.config.refresh_from_db()
        assert self.config.filters["all_projects"] is True

    def test_accepts_once_and_freezes_trigger_evidence(self) -> None:
        event = self.breach_event()
        run = self.accept(event)
        assert run is not None
        trigger = deepcopy(run.extras["snapshot"]["inputs"])
        self.detector.update(name="Edited after breach")
        self.condition.update(comparison=200)
        snapshot = deepcopy(run.extras["snapshot"])
        self.config.update(version=2, output_policy={"review_required": True})

        other_event = self.breach_event(value=240)
        assert other_event.event_id != event.event_id
        retried = self.accept(other_event)

        assert retried is not None
        assert retried.id == run.id
        run.refresh_from_db()
        assert run.trigger_key == f"issue_created:{self.group.id}"
        assert run.extras["snapshot"]["inputs"] == trigger
        assert trigger["evidence"]["value"] == 180
        assert run.extras["snapshot"] == snapshot
        assert run.extras["snapshot"]["config_version"] == 1
        assert run.status == SeerWorkflowRunStatus.COMPLETE
        assert run.date_completed is not None
        execution = run.executions.get()
        assert execution.status == SeerWorkflowExecutionStatus.COMPLETE
        assert execution.date_completed is not None
        assert execution.extras == {"result": "noop", "error": None}
        stored = MetricBreachRunExtras.parse_obj(run.extras)
        assert event.occurrence is not None
        stored_trigger = MetricBreachTrigger.parse_obj(stored.snapshot.inputs)
        assert stored_trigger.observed_at == event.occurrence.detection_time
        assert stored_trigger.binding_id == self.action.seer_workflow_binding.id
        assert stored.admission.decided_at <= run.date_completed
        assert SeerWorkflowRun.objects.count() == 1

    def test_replaying_old_metadata_logs_validation_error_without_replacing_run(self) -> None:
        event = self.breach_event()
        run = self.accept(event)
        assert run is not None
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
            self.accept(event)

        capture_error.assert_called_once_with(
            "seer.workflow.invalid_run_extras",
            extra={"run_id": run.id, "organization_id": self.organization.id},
        )
        run.refresh_from_db()
        assert run.extras == old_extras
        assert SeerWorkflowRun.objects.count() == 1

    def test_accept_uses_latest_scope_from_the_locked_config(self) -> None:
        workflow = BreachedMetricWorkflow(self.config)
        SeerWorkflowConfig.objects.filter(id=self.config.id).update(
            filters={"all_projects": True, "environments": ["staging"]}
        )

        result = workflow.accept(
            self.group,
            self.breach_event(),
            binding=self.action.seer_workflow_binding,
            workflow_id=self.workflow.id,
        )

        assert result == IgnoredMetricBreach("out_of_scope")
        assert not SeerWorkflowRun.objects.exists()

    def test_multiple_action_bindings_share_one_automation_run(self) -> None:
        second_action = self.create_action(type=Action.Type.SEER_WORKFLOW)
        second_binding = Factories.create_seer_workflow_trigger_binding(self.config, second_action)
        second_workflow = self.create_workflow(organization=self.organization)
        self.create_detector_workflow(detector=self.detector, workflow=second_workflow)
        conditions = self.create_data_condition_group(organization=self.organization)
        self.create_workflow_data_condition_group(
            workflow=second_workflow, condition_group=conditions
        )
        self.create_data_condition_group_action(action=second_action, condition_group=conditions)
        event = self.breach_event()

        first = self.accept(event)
        second = BreachedMetricWorkflow(self.config).accept(
            self.group,
            event,
            binding=second_action.seer_workflow_binding,
            workflow_id=second_workflow.id,
        )

        assert first is not None
        assert isinstance(second, AcceptedMetricBreach)
        assert second.run.id == first.id
        assert second.created is False
        assert second_binding.workflow_config_id == self.config.id
        assert SeerWorkflowTriggerBinding.objects.filter(workflow_config=self.config).count() == 2
        assert SeerWorkflowRun.objects.count() == 1
        assert SeerWorkflowRunExecution.objects.count() == 1

    def test_ignored_configuration_reports_reason_without_starting_work(self) -> None:
        self.config.update(enabled=False)

        rejected = BreachedMetricWorkflow(self.config).accept(
            self.group,
            self.breach_event(),
            binding=self.action.seer_workflow_binding,
            workflow_id=self.workflow.id,
        )

        assert rejected == IgnoredMetricBreach("configuration_unavailable")
        assert not SeerWorkflowRun.objects.exists()
        assert not SeerWorkflowRunExecution.objects.exists()

    def test_ignored_malformed_source_reports_reason(self) -> None:
        event = self.breach_event()
        assert event.occurrence is not None
        event.occurrence = replace(event.occurrence, evidence_data={})

        rejected = BreachedMetricWorkflow(self.config).accept(
            self.group,
            event,
            binding=self.action.seer_workflow_binding,
            workflow_id=self.workflow.id,
        )

        assert rejected == IgnoredMetricBreach("invalid_source")
        assert not SeerWorkflowRun.objects.exists()

    def test_breach_is_ignored_when_feature_is_disabled(self) -> None:
        event = self.breach_event()

        with self.feature({"organizations:seer-automations": False}):
            result = BreachedMetricWorkflow(self.config).accept(
                self.group,
                event,
                binding=self.action.seer_workflow_binding,
                workflow_id=self.workflow.id,
            )

        assert result == IgnoredMetricBreach("feature_disabled")
        assert not SeerWorkflowRun.objects.exists()

    def test_matching_environment_accepts_the_breach(self) -> None:
        self.config.update(filters={"all_projects": True, "environments": ["production"]})

        run = self.accept(self.breach_event())
        assert run is not None

        assert run.workflow_config_id == self.config.id
        assert run.extras["admission"]["status"] == "accepted"
        assert run.extras["admission"]["reason"] is None
        assert SeerWorkflowRun.objects.count() == 1
        assert SeerWorkflowRunExecution.objects.get().run_id == run.id

    def test_rejected_trigger_is_not_readmitted_for_the_same_or_another_event(self) -> None:
        event = self.breach_event()
        with mock.patch(
            "sentry.seer.workflows.workflow.SeerWorkflow.has_quota_available",
            return_value=False,
        ):
            first = BreachedMetricWorkflow(self.config).accept(
                self.group,
                event,
                binding=self.action.seer_workflow_binding,
                workflow_id=self.workflow.id,
            )

        with mock.patch(
            "sentry.seer.workflows.workflow.SeerWorkflow.has_quota_available",
            return_value=True,
        ) as admission:
            replayed = BreachedMetricWorkflow(self.config).accept(
                self.group,
                event,
                binding=self.action.seer_workflow_binding,
                workflow_id=self.workflow.id,
            )
            later = BreachedMetricWorkflow(self.config).accept(
                self.group,
                self.breach_event(),
                binding=self.action.seer_workflow_binding,
                workflow_id=self.workflow.id,
            )
        assert isinstance(first, RejectedMetricBreach)
        assert first.run.status == SeerWorkflowRunStatus.REJECTED
        assert first.run.date_completed is not None
        assert first.run.extras["error"]["code"] == "quota_exceeded"
        assert isinstance(replayed, RejectedMetricBreach)
        assert replayed.created is False
        assert replayed.run.id == first.run.id
        assert replayed.reason == "quota_exceeded"
        assert isinstance(later, RejectedMetricBreach)
        assert later.created is False
        assert later.run.id == first.run.id
        assert later.reason == "quota_exceeded"
        admission.assert_not_called()

        assert SeerWorkflowRun.objects.count() == 1
        assert not SeerWorkflowRunExecution.objects.exists()

    def test_other_organization_configuration_does_not_accept_the_breach(self) -> None:
        other_action = self.create_action(type=Action.Type.SEER_WORKFLOW)
        other = Factories.create_seer_workflow_config(
            self.create_organization(),
            strategy=SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION,
            enabled=True,
            filters={"all_projects": True},
            trigger_actions=[other_action],
        )

        assert self.accept(self.breach_event(), config=other, action=other_action) is None

    def test_action_for_a_different_configuration_does_not_accept_work(self) -> None:
        other = Factories.create_seer_workflow_config(
            self.organization,
            strategy=SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION,
            enabled=True,
            filters={"all_projects": True},
            trigger_actions=[self.create_action(type=Action.Type.SEER_WORKFLOW)],
        )

        assert self.accept(self.breach_event(), config=other) is None
        assert not SeerWorkflowRun.objects.exists()

    def test_failed_execution_creation_rolls_back_admission(self) -> None:
        with (
            mock.patch(
                "sentry.seer.workflows.runs.SeerWorkflowRunExecution.objects.bulk_create",
                side_effect=RuntimeError("Cannot create execution"),
            ),
            pytest.raises(RuntimeError, match="Cannot create execution"),
        ):
            self.accept(self.breach_event())
        assert not SeerWorkflowRun.objects.exists()
        assert not SeerWorkflowRunExecution.objects.exists()

    def accept(
        self,
        event: GroupEvent,
        *,
        config: SeerWorkflowConfig | None = None,
        action: Action | None = None,
    ) -> SeerWorkflowRun | None:
        result = BreachedMetricWorkflow(config or self.config).accept(
            self.group,
            event,
            binding=(action or self.action).seer_workflow_binding,
            workflow_id=self.workflow.id,
        )
        return result.run if isinstance(result, AcceptedMetricBreach) else None

    def breach_event(self, *, value: int = 180) -> GroupEvent:
        event_id = uuid4().hex
        occurrence = self.build_occurrence(
            event_id=event_id,
            project_id=self.project.id,
            type=MetricIssue.type_id,
            evidence_data={
                "detector_id": self.detector.id,
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
