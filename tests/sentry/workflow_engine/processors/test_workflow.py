from datetime import timedelta
from unittest.mock import MagicMock, Mock, patch

import pytest
from django.utils import timezone

from sentry.eventstream.base import GroupState
from sentry.grouping.grouptype import ErrorGroupType
from sentry.models.activity import Activity
from sentry.models.environment import Environment
from sentry.services.eventstore.models import GroupEvent
from sentry.testutils.factories import Factories
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.types.activity import ActivityType
from sentry.utils import json
from sentry.utils.cache import cache
from sentry.workflow_engine.buffer.batch_client import DelayedWorkflowClient, DelayedWorkflowItem
from sentry.workflow_engine.models import (
    Action,
    DataConditionGroup,
    DataConditionGroupAction,
    Workflow,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.models.workflow_fire_history import WorkflowFireHistory
from sentry.workflow_engine.processors.contexts.workflow_event_context import (
    WorkflowEventContext,
    WorkflowEventContextData,
)
from sentry.workflow_engine.processors.data_condition_group import get_data_conditions_for_group
from sentry.workflow_engine.processors.workflow import (
    delete_workflow,
    enqueue_workflows,
    evaluate_workflow_triggers,
    evaluate_workflows_action_filters,
    process_workflows,
)
from sentry.workflow_engine.tasks.workflows import process_workflows_event
from sentry.workflow_engine.types import WorkflowEventData
from sentry.workflow_engine.typings.grouptype import IssueStreamGroupType
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest

FROZEN_TIME = before_now(days=1).replace(hour=1, minute=30, second=0, microsecond=0)


class TestProcessWorkflows(BaseWorkflowTest):
    def setUp(self) -> None:
        (
            self.workflow,
            self.detector,
            self.detector_workflow,
            self.workflow_triggers,
        ) = self.create_detector_and_workflow()

        self.error_workflow, self.error_detector, self.detector_workflow_error, _ = (
            self.create_detector_and_workflow(
                name_prefix="error",
                workflow_triggers=self.create_data_condition_group(),
                detector_type=ErrorGroupType.slug,
            )
        )

        self.group, self.event, self.group_event = self.create_group_event()
        self.event_data = WorkflowEventData(
            event=self.group_event,
            group=self.group,
            group_state=GroupState(
                id=1, is_new=False, is_regression=True, is_new_group_environment=False
            ),
        )
        self.issue_stream_detector = self.create_detector(
            project=self.project,
            type=IssueStreamGroupType.slug,
        )
        self.batch_client = DelayedWorkflowClient()

    def test_skips_disabled_workflows(self) -> None:
        workflow_triggers = self.create_data_condition_group()
        self.create_data_condition(
            condition_group=workflow_triggers,
            type=Condition.EVENT_SEEN_COUNT,
            comparison=1,
            condition_result=True,
        )
        workflow = self.create_workflow(
            name="disabled_workflow", when_condition_group=workflow_triggers, enabled=False
        )
        self.create_detector_workflow(
            detector=self.error_detector,
            workflow=workflow,
        )

        result = process_workflows(self.batch_client, self.event_data, FROZEN_TIME)
        assert result.data.triggered_workflows == {self.error_workflow}

    def test_error_event(self) -> None:
        result = process_workflows(self.batch_client, self.event_data, FROZEN_TIME)
        assert result.data.triggered_workflows == {self.error_workflow}

    @patch("sentry.workflow_engine.processors.action.fire_actions")
    def test_process_workflows_event(self, mock_fire_actions: MagicMock) -> None:
        # Create an action so fire_actions will be called
        self.create_workflow_action(workflow=self.error_workflow)

        process_workflows_event(
            project_id=self.project.id,
            event_id=self.event.event_id,
            group_id=self.group.id,
            occurrence_id=self.group_event.occurrence_id,
            group_state={
                "id": 1,
                "is_new": False,
                "is_regression": True,
                "is_new_group_environment": False,
            },
            has_reappeared=False,
            has_escalated=False,
        )
        mock_fire_actions.assert_called_once()

    @with_feature("projects:servicehooks")
    @patch("sentry.sentry_apps.tasks.service_hooks.process_service_hook")
    def test_process_workflows_event__service_hooks_event_alert(
        self, mock_process_service_hook: MagicMock
    ) -> None:
        hook = self.create_service_hook(
            project=self.project,
            organization=self.project.organization,
            actor=self.user,
            events=["event.alert"],
        )
        project2 = self.create_project(organization=self.organization)
        self.create_service_hook(
            project=project2,
            organization=self.project.organization,
            actor=self.user,
            events=["event.alert"],
        )

        self.create_workflow_action(workflow=self.error_workflow)

        process_workflows_event(
            project_id=self.project.id,
            event_id=self.event.event_id,
            group_id=self.group.id,
            occurrence_id=self.group_event.occurrence_id,
            group_state={
                "id": 1,
                "is_new": False,
                "is_regression": True,
                "is_new_group_environment": False,
            },
            has_reappeared=False,
            has_escalated=False,
        )

        mock_process_service_hook.delay.assert_called_once_with(
            servicehook_id=hook.id,
            project_id=self.project.id,
            group_id=self.group.id,
            event_id=self.event.event_id,
        )

    @with_feature("projects:servicehooks")
    @patch("sentry.sentry_apps.tasks.service_hooks.process_service_hook")
    def test_process_workflows_event__service_hooks_event_created(
        self, mock_process_service_hook: MagicMock
    ) -> None:
        hook = self.create_service_hook(
            project=self.project,
            organization=self.project.organization,
            actor=self.user,
            events=["event.created"],
        )
        self.create_service_hook(
            project=self.project,
            organization=self.project.organization,
            actor=self.user,
            events=["event.alert"],
        )

        process_workflows_event(
            project_id=self.project.id,
            event_id=self.event.event_id,
            group_id=self.group.id,
            occurrence_id=self.group_event.occurrence_id,
            group_state={
                "id": 1,
                "is_new": False,
                "is_regression": True,
                "is_new_group_environment": False,
            },
            has_reappeared=False,
            has_escalated=False,
        )

        # no actions to fire, only event.created service hook fired
        mock_process_service_hook.delay.assert_called_once_with(
            servicehook_id=hook.id,
            project_id=self.project.id,
            group_id=self.group.id,
            event_id=self.event.event_id,
        )

    @patch("sentry.workflow_engine.processors.action.filter_recently_fired_workflow_actions")
    def test_populate_workflow_env_for_filters(self, mock_filter: MagicMock) -> None:
        # this should not pass because the environment is not None
        self.error_workflow.update(environment=self.group_event.get_environment())
        error_workflow_filters = self.create_data_condition_group(
            logic_type=DataConditionGroup.Type.ANY_SHORT_CIRCUIT
        )
        self.create_data_condition(
            condition_group=error_workflow_filters,
            type=Condition.FIRST_SEEN_EVENT,
            comparison=True,
            condition_result=True,
        )
        self.create_workflow_data_condition_group(
            workflow=self.error_workflow, condition_group=error_workflow_filters
        )

        workflow_triggers = self.create_data_condition_group(
            logic_type=DataConditionGroup.Type.ANY_SHORT_CIRCUIT
        )
        workflow_filters = self.create_data_condition_group(
            logic_type=DataConditionGroup.Type.ANY_SHORT_CIRCUIT
        )
        # this should pass because the environment is None
        self.create_data_condition(
            condition_group=workflow_filters,
            type=Condition.FIRST_SEEN_EVENT,
            comparison=True,
            condition_result=True,
        )
        workflow = self.create_workflow(
            name="testy",
            when_condition_group=workflow_triggers,
        )
        self.create_detector_workflow(
            detector=self.error_detector,
            workflow=workflow,
        )
        self.create_workflow_data_condition_group(
            workflow=workflow, condition_group=workflow_filters
        )

        assert self.event_data.group_state
        self.event_data.group_state["is_new"] = True

        result = process_workflows(self.batch_client, self.event_data, FROZEN_TIME)
        mock_filter.assert_called_with({workflow_filters}, self.event_data)
        assert result.tainted is False

    def test_same_environment_only(self) -> None:
        env = self.create_environment(project=self.project)
        other_env = self.create_environment(project=self.project)

        self.group, self.event, self.group_event = self.create_group_event(environment=env.name)
        self.event_data = WorkflowEventData(
            event=self.group_event,
            group=self.group,
            group_state=GroupState(
                id=1, is_new=False, is_regression=True, is_new_group_environment=False
            ),
        )

        # only processes workflows with the same env or no env specified
        self.error_workflow.update(environment=None)

        dcg = self.create_data_condition_group()
        non_matching_env_workflow = self.create_workflow(
            when_condition_group=dcg, environment=self.create_environment()
        )
        self.create_detector_workflow(
            detector=self.error_detector,
            workflow=non_matching_env_workflow,
        )

        matching_dcg = self.create_data_condition_group()
        matching_env_workflow = self.create_workflow(
            when_condition_group=matching_dcg,
            environment=env,
        )
        self.create_detector_workflow(
            detector=self.error_detector,
            workflow=matching_env_workflow,
        )

        mismatched_dcg = self.create_data_condition_group()
        mismatched_env_workflow = self.create_workflow(
            when_condition_group=mismatched_dcg, environment=other_env
        )
        self.create_detector_workflow(
            detector=self.error_detector,
            workflow=mismatched_env_workflow,
        )

        result = process_workflows(self.batch_client, self.event_data, FROZEN_TIME)
        assert result.data.triggered_workflows == {self.error_workflow, matching_env_workflow}

    def test_issue_occurrence_event(self) -> None:
        issue_occurrence = self.build_occurrence(evidence_data={"detector_id": self.detector.id})
        self.group_event.occurrence = issue_occurrence

        result = process_workflows(self.batch_client, self.event_data, FROZEN_TIME)
        assert result.data.triggered_workflows == {self.workflow}

    def test_regressed_event(self) -> None:
        dcg = self.create_data_condition_group()
        self.create_data_condition(
            type=Condition.REGRESSION_EVENT,
            comparison=True,
            condition_result=True,
            condition_group=dcg,
        )

        workflow = self.create_workflow(when_condition_group=dcg)
        self.create_detector_workflow(
            detector=self.error_detector,
            workflow=workflow,
        )

        result = process_workflows(self.batch_client, self.event_data, FROZEN_TIME)
        assert result.data.triggered_workflows == {self.error_workflow, workflow}

    @patch("sentry.utils.metrics.incr")
    @patch("sentry.workflow_engine.processors.detector.logger")
    def test_no_detector(self, mock_logger: MagicMock, mock_incr: MagicMock) -> None:
        self.issue_stream_detector.delete()
        self.group_event.occurrence = self.build_occurrence(evidence_data={})

        result = process_workflows(self.batch_client, self.event_data, FROZEN_TIME)
        assert result.msg == "No Detectors associated with the issue were found"

        mock_incr.assert_called_with("workflow_engine.detectors.error")  # called twice
        mock_logger.exception.assert_called_with(
            "Detector not found for event",
            extra={
                "event_id": self.event.event_id,
                "group_id": self.group_event.group_id,
                "detector_id": None,
            },
        )  # exception is called twice for both missing detectors

    @patch("sentry.utils.metrics.incr")
    @patch("sentry.workflow_engine.processors.detector.logger")
    def test_no_issue_stream_detector(self, mock_logger: MagicMock, mock_incr: MagicMock) -> None:
        self.issue_stream_detector.delete()

        process_workflows(self.batch_client, self.event_data, FROZEN_TIME)

        mock_incr.assert_any_call("workflow_engine.detectors.error")
        mock_logger.exception.assert_called_once_with(
            "Issue stream detector not found for event",
            extra={
                "project_id": self.group.project_id,
                "group_id": self.group_event.group_id,
            },
        )

    @patch("sentry.utils.metrics.incr")
    @patch("sentry.workflow_engine.processors.workflow.logger")
    def test_no_environment(self, mock_logger: MagicMock, mock_incr: MagicMock) -> None:
        Environment.objects.all().delete()
        cache.clear()
        result = process_workflows(self.batch_client, self.event_data, FROZEN_TIME)

        assert not result.data.triggered_workflows
        assert result.msg == "Environment for event not found"

        mock_incr.assert_called_once_with(
            "workflow_engine.process_workflows.error", 1, tags={"detector_type": "error"}
        )
        mock_logger.exception.assert_called_once_with(
            "Missing environment for event",
            extra={"event_id": self.event.event_id},
        )

    @patch("sentry.utils.metrics.incr")
    @patch("sentry.workflow_engine.processors.detector.logger")
    def test_no_metrics_triggered(self, mock_logger: MagicMock, mock_incr: MagicMock) -> None:
        self.issue_stream_detector.delete()
        self.error_detector.delete()

        process_workflows(self.batch_client, self.event_data, FROZEN_TIME)
        mock_incr.assert_called_with("workflow_engine.detectors.error")  # called twice
        mock_logger.exception.assert_called()  # called twice

    @patch("sentry.utils.metrics.incr")
    def test_metrics_with_workflows(self, mock_incr: MagicMock) -> None:
        process_workflows(self.batch_client, self.event_data, FROZEN_TIME)

        mock_incr.assert_any_call(
            "workflow_engine.process_workflows",
            1,
            tags={"detector_type": self.error_detector.type},
        )

    @patch("sentry.utils.metrics.incr")
    def test_metrics_triggered_workflows(self, mock_incr: MagicMock) -> None:
        process_workflows(self.batch_client, self.event_data, FROZEN_TIME)

        mock_incr.assert_any_call(
            "workflow_engine.process_workflows.triggered_workflows",
            1,
            tags={"detector_type": self.error_detector.type},
        )

    @override_options({"workflow_engine.issue_alert.group.type_id.ga": [1]})
    @patch("sentry.workflow_engine.processors.action.trigger_action.apply_async")
    def test_workflow_fire_history_with_action_deduping(
        self, mock_trigger_action: MagicMock
    ) -> None:
        """Fire a single action, but record that it was fired for multiple workflows"""
        self.action_group, self.action = self.create_workflow_action(workflow=self.error_workflow)

        error_workflow_2 = self.create_workflow(
            name="error_workflow_2",
            when_condition_group=self.create_data_condition_group(),
        )
        self.create_detector_workflow(
            detector=self.error_detector,
            workflow=error_workflow_2,
        )
        self.action_group_2, self.action_2 = self.create_workflow_action(workflow=error_workflow_2)

        error_workflow_3 = self.create_workflow(
            name="error_workflow_3",
            when_condition_group=self.create_data_condition_group(),
        )
        self.create_detector_workflow(
            detector=self.error_detector,
            workflow=error_workflow_3,
        )
        self.action_group_3, self.action_3 = self.create_workflow_action(workflow=error_workflow_3)

        process_workflows(self.batch_client, self.event_data, FROZEN_TIME)

        assert WorkflowFireHistory.objects.count() == 3
        assert mock_trigger_action.call_count == 3

    @override_options({"workflow_engine.exclude_issue_stream_detector": False})
    def test_uses_issue_stream_workflows(self) -> None:
        issue_occurrence = self.build_occurrence()
        self.group_event.occurrence = issue_occurrence
        self.group.update(type=issue_occurrence.type.type_id)

        self.error_workflow.delete()

        issue_stream_workflow, _, _, _ = self.create_detector_and_workflow(
            name_prefix="issue_stream",
            workflow_triggers=self.create_data_condition_group(),
            detector_type=IssueStreamGroupType.slug,
        )

        result = process_workflows(self.batch_client, self.event_data, FROZEN_TIME)

        assert result.tainted is True
        assert result.data.triggered_workflows == {issue_stream_workflow}
        assert result.data.triggered_actions is not None
        assert len(result.data.triggered_actions) == 0

    @override_options({"workflow_engine.exclude_issue_stream_detector": False})
    def test_multiple_detectors(self) -> None:
        issue_stream_workflow, issue_stream_detector, _, _ = self.create_detector_and_workflow(
            name_prefix="issue_stream",
            workflow_triggers=self.create_data_condition_group(),
            detector_type=IssueStreamGroupType.slug,
        )
        self.create_detector_workflow(
            detector=issue_stream_detector,
            workflow=self.error_workflow,
        )

        result = process_workflows(self.batch_client, self.event_data, FROZEN_TIME)
        assert result.data.triggered_workflows == {self.error_workflow, issue_stream_workflow}
        assert result.data.associated_detector == self.error_detector


class TestEvaluateWorkflowTriggers(BaseWorkflowTest):
    def setUp(self) -> None:
        (
            self.workflow,
            self.detector,
            self.detector_workflow,
            self.workflow_triggers,
        ) = self.create_detector_and_workflow(organization=self.organization)

        occurrence = self.build_occurrence(evidence_data={"detector_id": self.detector.id})
        self.group, self.event, self.group_event = self.create_group_event(
            occurrence=occurrence,
        )
        self.event_data = WorkflowEventData(event=self.group_event, group=self.group)
        self.event_start_time = timezone.now()

    def test_workflow_trigger(self) -> None:
        triggered_workflows, _ = evaluate_workflow_triggers(
            {self.workflow}, self.event_data, self.event_start_time
        )
        assert triggered_workflows == {self.workflow}

    @with_feature("organizations:workflow-engine-metric-alert-dual-processing-logs")
    @patch("sentry.workflow_engine.processors.workflow.logger")
    def test_logs_triggered_workflows(self, mock_logger: MagicMock) -> None:
        ctx_token = WorkflowEventContext.set(
            WorkflowEventContextData(
                detector=self.detector,
            )
        )
        evaluate_workflow_triggers({self.workflow}, self.event_data, self.event_start_time)
        mock_logger.info.assert_called_once_with(
            "workflow_engine.process_workflows.workflow_triggered",
            extra={
                "workflow_id": self.workflow.id,
                "detector_id": self.detector.id,
                "organization_id": self.workflow.organization.id,
                "project_id": self.event_data.group.project.id,
                "group_type": self.event_data.group.type,
            },
        )

        WorkflowEventContext.reset(ctx_token)

    def test_workflow_trigger__no_conditions(self) -> None:
        assert self.workflow.when_condition_group
        self.workflow.when_condition_group.conditions.all().delete()

        triggered_workflows, _ = evaluate_workflow_triggers(
            {self.workflow}, self.event_data, self.event_start_time
        )
        assert triggered_workflows == {self.workflow}

    def test_no_workflow_trigger(self) -> None:
        triggered_workflows, _ = evaluate_workflow_triggers(
            set(), self.event_data, self.event_start_time
        )
        assert not triggered_workflows

    def test_workflow_many_filters(self) -> None:
        assert self.workflow.when_condition_group
        self.workflow.when_condition_group.update(logic_type=DataConditionGroup.Type.ALL)

        self.create_data_condition(
            condition_group=self.workflow.when_condition_group,
            type=Condition.EVENT_CREATED_BY_DETECTOR,
            comparison=self.detector.id,
            condition_result=75,
        )

        triggered_workflows, _ = evaluate_workflow_triggers(
            {self.workflow}, self.event_data, self.event_start_time
        )
        assert triggered_workflows == {self.workflow}

    def test_workflow_filtered_out(self) -> None:
        assert self.workflow.when_condition_group
        self.workflow.when_condition_group.update(logic_type=DataConditionGroup.Type.ALL)

        self.create_data_condition(
            condition_group=self.workflow.when_condition_group,
            type=Condition.EVENT_CREATED_BY_DETECTOR,
            comparison=self.detector.id + 1,
        )

        triggered_workflows, _ = evaluate_workflow_triggers(
            {self.workflow}, self.event_data, self.event_start_time
        )
        assert not triggered_workflows

    def test_many_workflows(self) -> None:
        workflow_two, _, _, _ = self.create_detector_and_workflow(name_prefix="two")
        triggered_workflows, _ = evaluate_workflow_triggers(
            {self.workflow, workflow_two}, self.event_data, self.event_start_time
        )

        assert triggered_workflows == {self.workflow, workflow_two}

    @patch.object(get_data_conditions_for_group, "batch")
    def test_batched_data_condition_lookup_is_used(self, mock_batch: MagicMock) -> None:
        """Test that batch lookup is used when evaluating multiple workflows."""
        workflow_two, _, _, _ = self.create_detector_and_workflow(name_prefix="two")

        assert self.workflow.when_condition_group
        assert workflow_two.when_condition_group
        # Mock the batch method to return the expected data
        mock_batch.return_value = [
            list(self.workflow.when_condition_group.conditions.all()),
            list(workflow_two.when_condition_group.conditions.all()),
        ]

        # Evaluate workflows with batching
        workflows = {self.workflow, workflow_two}
        evaluate_workflow_triggers(workflows, self.event_data, self.event_start_time)

        # Verify batch was called once with the correct DCG IDs
        mock_batch.assert_called_once()
        call_args = mock_batch.call_args[0][0]

        expected_dcg_ids = {
            self.workflow.when_condition_group_id,
            workflow_two.when_condition_group_id,
        }
        actual_dcg_ids = {args[0] for args in call_args}

        assert actual_dcg_ids == expected_dcg_ids

    def test_delays_slow_conditions(self) -> None:
        assert self.workflow.when_condition_group
        self.workflow.when_condition_group.update(logic_type=DataConditionGroup.Type.ALL)

        self.create_data_condition(
            condition_group=self.workflow.when_condition_group,
            type=Condition.EVENT_FREQUENCY_COUNT,
            comparison={
                "interval": "1h",
                "value": 100,
            },
            condition_result=True,
        )

        triggered_workflows, queue_items_by_workflow_id = evaluate_workflow_triggers(
            {self.workflow}, self.event_data, self.event_start_time
        )
        # no workflows are triggered because the slow conditions need to be evaluated
        assert triggered_workflows == set()
        # we return the list of items we may enqueue in the filtering function
        assert list(queue_items_by_workflow_id.keys()) == [self.workflow]

    def test_activity_update__slow_condition(self) -> None:
        # Setup slow conditions
        assert self.workflow.when_condition_group
        self.workflow.when_condition_group.update(logic_type=DataConditionGroup.Type.ALL)

        self.create_data_condition(
            condition_group=self.workflow.when_condition_group,
            type=Condition.EVENT_FREQUENCY_COUNT,
            comparison={
                "interval": "1h",
                "value": 100,
            },
            condition_result=True,
        )

        # Create Activity update
        self.event = Activity.objects.create(
            project=self.project,
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
        )
        self.event_data = WorkflowEventData(
            event=self.event,
            group=self.group,
        )
        triggered_workflows, queue_items_by_workflow_id = evaluate_workflow_triggers(
            {self.workflow}, self.event_data, self.event_start_time
        )

        # no workflows are triggered because the slow conditions need to be evaluated
        assert triggered_workflows == set()
        assert (
            not queue_items_by_workflow_id.keys()
        )  # TODO: implement evaluating slow conditions for activity updates


@freeze_time(FROZEN_TIME)
class TestWorkflowEnqueuing(BaseWorkflowTest):
    buffer_timestamp = (FROZEN_TIME + timedelta(seconds=1)).timestamp()

    def setUp(self) -> None:
        (
            self.workflow,
            self.detector,
            self.detector_workflow,
            self.workflow_triggers,
        ) = self.create_detector_and_workflow()

        occurrence = self.build_occurrence(evidence_data={"detector_id": self.detector.id})
        self.group, self.event, self.group_event = self.create_group_event(
            occurrence=occurrence,
        )
        self.event_data = WorkflowEventData(event=self.group_event, group=self.group)
        self.action_group, _ = self.create_workflow_action(self.workflow)

        self.batch_client = DelayedWorkflowClient()

    def test_enqueues_workflow_all_logic_type(self) -> None:
        assert self.workflow.when_condition_group
        self.workflow.when_condition_group.update(logic_type=DataConditionGroup.Type.ALL)
        self.create_data_condition(
            condition_group=self.workflow.when_condition_group,
            type=Condition.EVENT_FREQUENCY_COUNT,
            comparison={
                "interval": "1h",
                "value": 100,
            },
            condition_result=True,
        )

        triggered_workflows, _ = evaluate_workflow_triggers(
            {self.workflow}, self.event_data, FROZEN_TIME
        )
        assert not triggered_workflows

        process_workflows(self.batch_client, self.event_data, FROZEN_TIME)

        project_ids = self.batch_client.get_project_ids(
            min=0,
            max=self.buffer_timestamp,
        )
        assert list(project_ids.keys()) == [self.project.id]

    def test_enqueues_workflow_any_logic_type(self) -> None:
        assert self.workflow.when_condition_group
        self.workflow.when_condition_group.conditions.all().delete()

        self.create_data_condition(
            condition_group=self.workflow.when_condition_group,
            type=Condition.EVENT_FREQUENCY_COUNT,
            comparison={
                "interval": "1h",
                "value": 100,
            },
            condition_result=True,
        )
        self.create_data_condition(
            condition_group=self.workflow.when_condition_group,
            type=Condition.REGRESSION_EVENT,  # fast condition, does not pass
            comparison=True,
            condition_result=True,
        )

        triggered_workflows, _ = evaluate_workflow_triggers(
            {self.workflow}, self.event_data, FROZEN_TIME
        )
        assert not triggered_workflows

        process_workflows(self.batch_client, self.event_data, FROZEN_TIME)

        project_ids = self.batch_client.get_project_ids(
            min=0,
            max=self.buffer_timestamp,
        )
        assert list(project_ids.keys()) == [self.project.id]

    def test_skips_enqueuing_any(self) -> None:
        # skips slow conditions if the condition group evaluates to True without evaluating them
        assert self.workflow.when_condition_group
        self.workflow.when_condition_group.update(
            logic_type=DataConditionGroup.Type.ANY_SHORT_CIRCUIT
        )

        self.create_data_condition(
            condition_group=self.workflow.when_condition_group,
            type=Condition.EVENT_FREQUENCY_COUNT,
            comparison={
                "interval": "1h",
                "value": 100,
            },
            condition_result=True,
        )

        triggered_workflows, queue_items_by_workflow_id = evaluate_workflow_triggers(
            {self.workflow}, self.event_data, FROZEN_TIME
        )
        assert triggered_workflows == {self.workflow}
        assert not queue_items_by_workflow_id

    def test_skips_enqueuing_all(self) -> None:
        assert self.workflow.when_condition_group
        self.workflow.when_condition_group.conditions.all().delete()
        self.workflow.when_condition_group.update(logic_type=DataConditionGroup.Type.ALL)

        self.create_data_condition(
            condition_group=self.workflow.when_condition_group,
            type=Condition.EVENT_FREQUENCY_COUNT,
            comparison={
                "interval": "1h",
                "value": 100,
            },
            condition_result=True,
        )
        self.create_data_condition(
            condition_group=self.workflow.when_condition_group,
            type=Condition.REGRESSION_EVENT,  # fast condition, does not pass
            comparison=True,
            condition_result=True,
        )

        triggered_workflows, queue_items_by_workflow_id = evaluate_workflow_triggers(
            {self.workflow}, self.event_data, FROZEN_TIME
        )
        assert not triggered_workflows
        assert not queue_items_by_workflow_id

    def test_enqueues_with_when_and_if_slow_conditions(self) -> None:
        assert self.workflow.when_condition_group
        self.workflow.when_condition_group.update(logic_type=DataConditionGroup.Type.ALL)
        self.create_data_condition(
            condition_group=self.workflow.when_condition_group,
            type=Condition.EVENT_FREQUENCY_COUNT,
            comparison={
                "interval": "1h",
                "value": 100,
            },
            condition_result=True,
        )

        self.create_data_condition(
            condition_group=self.action_group,
            type=Condition.EVENT_FREQUENCY_COUNT,
            comparison={
                "interval": "1h",
                "value": 100,
            },
            condition_result=True,
        )

        process_workflows(self.batch_client, self.event_data, FROZEN_TIME)

        project_ids = self.batch_client.get_project_ids(
            min=0,
            max=self.buffer_timestamp,
        )
        assert list(project_ids.keys()) == [self.project.id]

    def test_enqueues_event_if_meets_fast_conditions(self) -> None:
        assert self.workflow.when_condition_group
        self.workflow.when_condition_group.update(logic_type=DataConditionGroup.Type.ALL)
        self.create_data_condition(
            condition_group=self.workflow.when_condition_group,
            type=Condition.EVENT_FREQUENCY_COUNT,
            comparison={
                "interval": "1h",
                "value": 100,
            },
            condition_result=True,
        )

        tag_condition = self.create_data_condition(
            condition_group=self.action_group,
            type=Condition.TAGGED_EVENT,
            comparison={"key": "hello", "value": "world", "match": "eq"},
            condition_result=True,
        )

        process_workflows(self.batch_client, self.event_data, FROZEN_TIME)

        project_ids = self.batch_client.get_project_ids(
            min=0,
            max=self.buffer_timestamp,
        )
        assert not project_ids

        # enqueue if the tag condition is met
        tag_condition.update(comparison={"key": "level", "value": "error", "match": "eq"})

        process_workflows(self.batch_client, self.event_data, FROZEN_TIME)

        project_ids = self.batch_client.get_project_ids(
            min=0,
            max=self.buffer_timestamp,
        )
        assert list(project_ids.keys()) == [self.project.id]


@freeze_time(FROZEN_TIME)
class TestEvaluateWorkflowActionFilters(BaseWorkflowTest):
    def setUp(self) -> None:
        (
            self.workflow,
            self.detector,
            self.detector_workflow,
            self.workflow_triggers,
        ) = self.create_detector_and_workflow()

        self.action_group, self.action = self.create_workflow_action(workflow=self.workflow)

        self.group, self.event, self.group_event = self.create_group_event(
            occurrence=self.build_occurrence(evidence_data={"detector_id": self.detector.id})
        )
        self.event_data = WorkflowEventData(event=self.group_event, group=self.group)
        self.batch_client = DelayedWorkflowClient()

    @patch("sentry.utils.metrics.incr")
    @patch("sentry.workflow_engine.tasks.utils.IssueOccurrence.fetch")
    def test_metrics_issue_dual_processing_metrics(
        self, mock_fetch: MagicMock, mock_incr: MagicMock
    ) -> None:
        mock_fetch.return_value = self.group_event.occurrence

        with self.tasks():
            process_workflows(self.batch_client, self.event_data, FROZEN_TIME)
        mock_incr.assert_any_call(
            "workflow_engine.tasks.trigger_action_task_started",
            tags={
                "detector_type": self.detector.type,
                "action_type": "slack",
            },
            sample_rate=1.0,
        )

    def test_basic__no_filter(self) -> None:
        triggered_action_filters, _ = evaluate_workflows_action_filters(
            {self.workflow}, self.event_data, {}, FROZEN_TIME
        )
        assert set(triggered_action_filters) == {self.action_group}

    def test_basic__with_filter__passes(self) -> None:
        self.create_data_condition(
            condition_group=self.action_group,
            type=Condition.EVENT_SEEN_COUNT,
            comparison=1,
            condition_result=True,
        )

        triggered_action_filters, _ = evaluate_workflows_action_filters(
            {self.workflow}, self.event_data, {}, FROZEN_TIME
        )
        assert set(triggered_action_filters) == {self.action_group}

    def test_basic__with_filter__filtered(self) -> None:
        # Add a filter to the action's group
        self.create_data_condition(
            condition_group=self.action_group,
            type=Condition.EVENT_CREATED_BY_DETECTOR,
            comparison=self.detector.id + 1,
        )

        triggered_action_filters, _ = evaluate_workflows_action_filters(
            {self.workflow}, self.event_data, {}, FROZEN_TIME
        )
        assert not triggered_action_filters

    def test_with_slow_conditions(self) -> None:
        self.action_group.logic_type = DataConditionGroup.Type.ALL

        self.create_data_condition(
            condition_group=self.action_group,
            type=Condition.EVENT_FREQUENCY_COUNT,
            comparison={"interval": "1d", "value": 7},
        )

        self.create_data_condition(
            condition_group=self.action_group,
            type=Condition.EVENT_SEEN_COUNT,
            comparison=1,
            condition_result=True,
        )
        self.action_group.save()

        triggered_action_filters, _ = evaluate_workflows_action_filters(
            {self.workflow}, self.event_data, {}, FROZEN_TIME
        )

        assert self.action_group.conditions.count() == 2

        # The first condition passes, but the second is enqueued for later evaluation
        assert not triggered_action_filters

    @patch.object(get_data_conditions_for_group, "batch")
    def test_batched_data_condition_lookup_for_action_filters(self, mock_batch: MagicMock) -> None:
        """Test that batch lookup is used when evaluating action filters."""
        # Create a second workflow with action filters
        workflow_two, _, _, _ = self.create_detector_and_workflow(name_prefix="two")
        action_group_two, action_two = self.create_workflow_action(workflow=workflow_two)

        # Mock the batch method to return the expected data
        mock_batch.return_value = [
            list(self.action_group.conditions.all()),
            list(action_group_two.conditions.all()),
        ]

        # Evaluate workflows action filters with batching
        workflows = {self.workflow, workflow_two}
        evaluate_workflows_action_filters(workflows, self.event_data, {}, FROZEN_TIME)

        # Verify batch was called once with the correct DCG IDs
        mock_batch.assert_called_once()
        call_args = mock_batch.call_args[0][0]

        expected_dcg_ids = {self.action_group.id, action_group_two.id}
        actual_dcg_ids = {args[0] for args in call_args}

        assert actual_dcg_ids == expected_dcg_ids

    def test_activity__with_slow_conditions(self) -> None:
        # Create a condition group with fast and slow conditions
        self.action_group.logic_type = DataConditionGroup.Type.ALL

        self.create_data_condition(
            condition_group=self.action_group,
            type=Condition.EVENT_FREQUENCY_COUNT,
            comparison={"interval": "1d", "value": 7},
        )

        self.create_data_condition(
            condition_group=self.action_group,
            type=Condition.EVENT_SEEN_COUNT,
            comparison=1,
            condition_result=True,
        )
        self.action_group.save()

        # Create an activity update
        self.event = Activity.objects.create(
            project=self.project,
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
        )
        self.event_data = WorkflowEventData(
            event=self.event,
            group=self.group,
        )

        # Evaluate the workflow actions with a slow condition
        _, queue_items = evaluate_workflows_action_filters(
            {self.workflow}, self.event_data, {}, FROZEN_TIME
        )

        # ensure we do not enqueue slow condition evaluation
        assert not queue_items

    def test_enqueues_when_slow_conditions(self) -> None:
        assert isinstance(self.event_data.event, GroupEvent)
        queue_items_by_workflow_id = {
            self.workflow: DelayedWorkflowItem(
                workflow=self.workflow,
                event=self.event_data.event,
                delayed_when_group_id=self.workflow.when_condition_group_id,
                delayed_if_group_ids=[],
                passing_if_group_ids=[],
                timestamp=timezone.now(),
            )
        }

        triggered_action_filters, queue_items = evaluate_workflows_action_filters(
            set(), self.event_data, queue_items_by_workflow_id, FROZEN_TIME
        )
        assert not triggered_action_filters

        enqueue_workflows(self.batch_client, queue_items)

        project_ids = self.batch_client.get_project_ids(
            min=0,
            max=timezone.now().timestamp(),
        )
        assert list(project_ids.keys()) == [self.project.id]


class TestEnqueueWorkflows(BaseWorkflowTest):
    def setUp(self) -> None:
        self.data_condition_group = self.create_data_condition_group()
        self.condition = self.create_data_condition(condition_group=self.data_condition_group)
        self.workflow = self.create_workflow(when_condition_group=self.data_condition_group)

        self.workflow_filter_group = self.create_data_condition_group()
        self.create_workflow_data_condition_group(
            workflow=self.workflow,
            condition_group=self.workflow_filter_group,
        )

        self.slow_workflow_filter_group = self.create_data_condition_group()
        self.create_workflow_data_condition_group(
            workflow=self.workflow,
            condition_group=self.slow_workflow_filter_group,
        )
        self.create_data_condition(
            condition_group=self.slow_workflow_filter_group,
            type=Condition.EVENT_FREQUENCY_COUNT,
            comparison={"interval": "1d", "value": 7},
        )

        _, self.event, self.group_event = self.create_group_event()
        self.workflow_event_data = WorkflowEventData(
            event=self.group_event,
            group=self.group_event.group,
        )

    def test_enqueue_workflows__adds_to_workflow_engine_buffer(self) -> None:
        batch_client = Mock(spec=DelayedWorkflowClient)
        enqueue_workflows(
            batch_client,
            {
                self.workflow: DelayedWorkflowItem(
                    self.workflow,
                    self.group_event,
                    self.workflow.when_condition_group_id,
                    [self.slow_workflow_filter_group.id],
                    [self.workflow_filter_group.id],
                    timestamp=timezone.now(),
                )
            },
        )

        batch_client.add_project_ids.assert_called_once_with(
            [self.group_event.project_id],
        )

    def test_enqueue_workflow__adds_to_workflow_engine_set(self) -> None:
        current_time = timezone.now()
        workflow_filter_group_2 = self.create_data_condition_group()
        self.create_workflow_data_condition_group(
            workflow=self.workflow,
            condition_group=workflow_filter_group_2,
        )

        slow_workflow_filter_group_2 = self.create_data_condition_group()
        self.create_workflow_data_condition_group(
            workflow=self.workflow,
            condition_group=slow_workflow_filter_group_2,
        )
        self.create_data_condition(
            condition_group=slow_workflow_filter_group_2,
            type=Condition.EVENT_FREQUENCY_COUNT,
            comparison={"interval": "1d", "value": 7},
        )
        batch_client = Mock(spec=DelayedWorkflowClient)
        enqueue_workflows(
            batch_client,
            {
                self.workflow: DelayedWorkflowItem(
                    self.workflow,
                    self.group_event,
                    self.workflow.when_condition_group_id,
                    [self.slow_workflow_filter_group.id, slow_workflow_filter_group_2.id],
                    [self.workflow_filter_group.id, workflow_filter_group_2.id],
                    timestamp=current_time,
                )
            },
        )

        slow_condition_group_ids = ",".join(
            str(id) for id in [self.slow_workflow_filter_group.id, slow_workflow_filter_group_2.id]
        )
        passing_condition_group_ids = ",".join(
            str(id) for id in [self.workflow_filter_group.id, workflow_filter_group_2.id]
        )
        batch_client.for_project.assert_called_once_with(self.group_event.project_id)
        batch_client.for_project.return_value.push_to_hash.assert_called_once_with(
            batch_key=None,
            data={
                f"{self.workflow.id}:{self.group_event.group_id}:{self.workflow.when_condition_group_id}:{slow_condition_group_ids}:{passing_condition_group_ids}": json.dumps(
                    {
                        "event_id": self.event.event_id,
                        "occurrence_id": self.group_event.occurrence_id,
                        "timestamp": current_time,
                    }
                )
            },
        )


@django_db_all
class TestDeleteWorkflow:
    @pytest.fixture(autouse=True)
    def setUp(self) -> None:
        self.organization = Factories.create_organization()
        self.project = Factories.create_project(organization=self.organization)

        self.workflow = Factories.create_workflow()
        self.workflow_trigger = Factories.create_data_condition_group(
            organization=self.organization
        )
        self.workflow.when_condition_group = self.workflow_trigger
        self.workflow.save()

        self.action_filter = Factories.create_data_condition_group(organization=self.organization)
        self.action = Factories.create_action()
        self.action_and_filter = Factories.create_data_condition_group_action(
            condition_group=self.action_filter,
            action=self.action,
        )

        self.workflow_actions = Factories.create_workflow_data_condition_group(
            workflow=self.workflow,
            condition_group=self.action_filter,
        )

        self.trigger_condition = Factories.create_data_condition(
            condition_group=self.workflow_trigger,
            comparison=1,
            condition_result=True,
        )

        self.action_condition = Factories.create_data_condition(
            condition_group=self.action_filter,
            comparison=1,
            condition_result=True,
        )

    @pytest.mark.parametrize(
        "instance_attr",
        [
            "workflow",
            "workflow_trigger",
            "action_filter",
            "action_and_filter",
            "workflow_actions",
            "trigger_condition",
            "action_condition",
        ],
    )
    def test_delete_workflow(self, instance_attr: str) -> None:
        instance = getattr(self, instance_attr)
        instance_id = instance.id
        cls = instance.__class__

        delete_workflow(self.workflow)
        assert not cls.objects.filter(id=instance_id).exists()

    def test_delete_workflow__no_actions(self) -> None:
        Action.objects.get(id=self.action.id).delete()
        assert not DataConditionGroupAction.objects.filter(id=self.action_and_filter.id).exists()

        workflow_id = self.workflow.id
        delete_workflow(self.workflow)

        assert not Workflow.objects.filter(id=workflow_id).exists()

    def test_delete_workflow__no_workflow_triggers(self) -> None:
        # TODO - when this condition group is deleted, it's removing the workflow
        # it's basically inverted from what's expected on the cascade delete
        self.workflow.when_condition_group = None
        self.workflow.save()

        DataConditionGroup.objects.get(id=self.workflow_trigger.id).delete()

        workflow_id = self.workflow.id
        delete_workflow(self.workflow)
        assert not Workflow.objects.filter(id=workflow_id).exists()
