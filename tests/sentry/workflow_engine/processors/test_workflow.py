from datetime import timedelta
from unittest.mock import MagicMock, patch

import pytest
from django.utils import timezone

from sentry.eventstream.base import GroupState
from sentry.grouping.grouptype import ErrorGroupType
from sentry.models.activity import Activity
from sentry.models.environment import Environment
from sentry.services.eventstore.models import GroupEvent
from sentry.testutils.factories import Factories
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.helpers.options import override_options
from sentry.testutils.helpers.redis import mock_redis_buffer
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.types.activity import ActivityType
from sentry.utils import json
from sentry.workflow_engine import buffer as workflow_buffer
from sentry.workflow_engine.models import (
    Action,
    DataConditionGroup,
    DataConditionGroupAction,
    Workflow,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.models.workflow_fire_history import WorkflowFireHistory
from sentry.workflow_engine.processors.workflow import (
    DelayedWorkflowItem,
    delete_workflow,
    enqueue_workflows,
    evaluate_workflow_triggers,
    evaluate_workflows_action_filters,
    process_workflows,
)
from sentry.workflow_engine.tasks.delayed_workflows import DelayedWorkflow
from sentry.workflow_engine.types import WorkflowEventData
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

        triggered_workflows = process_workflows(self.event_data)
        assert triggered_workflows == {self.error_workflow}

    def test_error_event(self) -> None:
        triggered_workflows = process_workflows(self.event_data)
        assert triggered_workflows == {self.error_workflow}

    @patch("sentry.workflow_engine.processors.workflow.filter_recently_fired_workflow_actions")
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

        process_workflows(self.event_data)

        mock_filter.assert_called_with({workflow_filters}, self.event_data)

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

        dcg = self.create_data_condition_group()
        matching_env_workflow = self.create_workflow(
            when_condition_group=dcg,
            environment=env,
        )
        self.create_detector_workflow(
            detector=self.error_detector,
            workflow=matching_env_workflow,
        )

        mismatched_env_workflow = self.create_workflow(
            when_condition_group=dcg, environment=other_env
        )
        self.create_detector_workflow(
            detector=self.error_detector,
            workflow=mismatched_env_workflow,
        )

        triggered_workflows = process_workflows(self.event_data)
        assert triggered_workflows == {self.error_workflow, matching_env_workflow}

    def test_issue_occurrence_event(self) -> None:
        issue_occurrence = self.build_occurrence(evidence_data={"detector_id": self.detector.id})
        self.group_event.occurrence = issue_occurrence

        triggered_workflows = process_workflows(self.event_data)
        assert triggered_workflows == {self.workflow}

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

        triggered_workflows = process_workflows(self.event_data)
        assert triggered_workflows == {self.error_workflow, workflow}

    @patch("sentry.utils.metrics.incr")
    @patch("sentry.workflow_engine.processors.detector.logger")
    def test_no_detector(self, mock_logger: MagicMock, mock_incr: MagicMock) -> None:
        self.group_event.occurrence = self.build_occurrence(evidence_data={})

        triggered_workflows = process_workflows(self.event_data)

        assert not triggered_workflows

        mock_incr.assert_called_once_with("workflow_engine.detectors.error")
        mock_logger.exception.assert_called_once_with(
            "Detector not found for event",
            extra={
                "event_id": self.event.event_id,
                "group_id": self.group_event.group_id,
                "detector_id": None,
            },
        )

    @patch("sentry.utils.metrics.incr")
    @patch("sentry.workflow_engine.processors.workflow.logger")
    def test_no_environment(self, mock_logger: MagicMock, mock_incr: MagicMock) -> None:
        Environment.objects.all().delete()
        triggered_workflows = process_workflows(self.event_data)

        assert not triggered_workflows

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
        self.event_data.event.project_id = 0

        process_workflows(self.event_data)
        mock_incr.assert_called_once_with("workflow_engine.detectors.error")
        mock_logger.exception.assert_called_once()

    @patch("sentry.utils.metrics.incr")
    def test_metrics_with_workflows(self, mock_incr: MagicMock) -> None:
        process_workflows(self.event_data)

        mock_incr.assert_any_call(
            "workflow_engine.process_workflows",
            1,
            tags={"detector_type": self.error_detector.type},
        )

    @patch("sentry.utils.metrics.incr")
    def test_metrics_triggered_workflows(self, mock_incr: MagicMock) -> None:
        process_workflows(self.event_data)

        mock_incr.assert_any_call(
            "workflow_engine.process_workflows.triggered_workflows",
            1,
            tags={"detector_type": self.error_detector.type},
        )

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

        process_workflows(self.event_data)

        assert WorkflowFireHistory.objects.count() == 3
        assert mock_trigger_action.call_count == 3


@mock_redis_buffer()
class TestEvaluateWorkflowTriggers(BaseWorkflowTest):
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

    def test_workflow_trigger(self) -> None:
        triggered_workflows, _ = evaluate_workflow_triggers({self.workflow}, self.event_data)
        assert triggered_workflows == {self.workflow}

    def test_workflow_trigger__no_conditions(self) -> None:
        assert self.workflow.when_condition_group
        self.workflow.when_condition_group.conditions.all().delete()

        triggered_workflows, _ = evaluate_workflow_triggers({self.workflow}, self.event_data)
        assert triggered_workflows == {self.workflow}

    def test_no_workflow_trigger(self) -> None:
        triggered_workflows, _ = evaluate_workflow_triggers(set(), self.event_data)
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

        triggered_workflows, _ = evaluate_workflow_triggers({self.workflow}, self.event_data)
        assert triggered_workflows == {self.workflow}

    def test_workflow_filtered_out(self) -> None:
        assert self.workflow.when_condition_group
        self.workflow.when_condition_group.update(logic_type=DataConditionGroup.Type.ALL)

        self.create_data_condition(
            condition_group=self.workflow.when_condition_group,
            type=Condition.EVENT_CREATED_BY_DETECTOR,
            comparison=self.detector.id + 1,
        )

        triggered_workflows, _ = evaluate_workflow_triggers({self.workflow}, self.event_data)
        assert not triggered_workflows

    def test_many_workflows(self) -> None:
        workflow_two, _, _, _ = self.create_detector_and_workflow(name_prefix="two")
        triggered_workflows, _ = evaluate_workflow_triggers(
            {self.workflow, workflow_two}, self.event_data
        )

        assert triggered_workflows == {self.workflow, workflow_two}

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
            {self.workflow}, self.event_data
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
            {self.workflow}, self.event_data
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

        self.buffer_keys = DelayedWorkflow.get_buffer_keys()
        self.mock_redis_buffer = mock_redis_buffer()
        self.mock_redis_buffer.__enter__()

    def tearDown(self):
        self.mock_redis_buffer.__exit__(None, None, None)

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

        triggered_workflows, _ = evaluate_workflow_triggers({self.workflow}, self.event_data)
        assert not triggered_workflows

        process_workflows(self.event_data)

        project_ids = workflow_buffer.get_backend().bulk_get_sorted_set(
            self.buffer_keys,
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

        triggered_workflows, _ = evaluate_workflow_triggers({self.workflow}, self.event_data)
        assert not triggered_workflows

        process_workflows(self.event_data)

        project_ids = workflow_buffer.get_backend().bulk_get_sorted_set(
            self.buffer_keys,
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
            {self.workflow}, self.event_data
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
            {self.workflow}, self.event_data
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

        process_workflows(self.event_data)

        project_ids = workflow_buffer.get_backend().bulk_get_sorted_set(
            self.buffer_keys,
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

        process_workflows(self.event_data)

        project_ids = workflow_buffer.get_backend().bulk_get_sorted_set(
            self.buffer_keys,
            min=0,
            max=self.buffer_timestamp,
        )
        assert not project_ids

        # enqueue if the tag condition is met
        tag_condition.update(comparison={"key": "level", "value": "error", "match": "eq"})

        process_workflows(self.event_data)

        project_ids = workflow_buffer.get_backend().bulk_get_sorted_set(
            self.buffer_keys,
            min=0,
            max=self.buffer_timestamp,
        )
        assert list(project_ids.keys()) == [self.project.id]


@freeze_time(FROZEN_TIME)
@mock_redis_buffer()
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
        self.buffer_keys = DelayedWorkflow.get_buffer_keys()

    @patch("sentry.utils.metrics.incr")
    def test_metrics_issue_dual_processing_metrics(self, mock_incr: MagicMock) -> None:
        with self.tasks():
            process_workflows(self.event_data)
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
            {self.workflow}, self.event_data, {}
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
            {self.workflow}, self.event_data, {}
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
            {self.workflow}, self.event_data, {}
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
            {self.workflow}, self.event_data, {}
        )

        assert self.action_group.conditions.count() == 2

        # The first condition passes, but the second is enqueued for later evaluation
        assert not triggered_action_filters

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
        _, queue_items = evaluate_workflows_action_filters({self.workflow}, self.event_data, {})

        # ensure we do not enqueue slow condition evaluation
        assert not queue_items

    def test_enqueues_when_slow_conditions(self):
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
            set(), self.event_data, queue_items_by_workflow_id
        )
        assert not triggered_action_filters

        enqueue_workflows(queue_items)

        project_ids = workflow_buffer.get_backend().bulk_get_sorted_set(
            self.buffer_keys,
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

    @patch("sentry.buffer.backend.push_to_sorted_set")
    @patch("sentry.buffer.backend.push_to_hash_bulk")
    @patch("random.choice")
    @override_options({"workflow_engine.buffer.use_new_buffer": False})
    def test_enqueue_workflows__adds_to_workflow_engine_buffer(
        self, mock_randchoice, mock_push_to_hash_bulk, mock_push_to_sorted_set
    ) -> None:
        mock_randchoice.return_value = f"{DelayedWorkflow.buffer_key}:{5}"
        enqueue_workflows(
            {
                self.workflow: DelayedWorkflowItem(
                    self.workflow,
                    self.group_event,
                    self.workflow.when_condition_group_id,
                    [self.slow_workflow_filter_group.id],
                    [self.workflow_filter_group.id],
                    timestamp=timezone.now(),
                )
            }
        )

        mock_push_to_sorted_set.assert_called_once_with(
            key=f"{DelayedWorkflow.buffer_key}:{5}",
            value=[self.group_event.project_id],
        )

    @patch("sentry.workflow_engine.buffer._backend.push_to_sorted_set")
    @patch("sentry.workflow_engine.buffer._backend.push_to_hash_bulk")
    @patch("random.choice")
    @override_options({"workflow_engine.buffer.use_new_buffer": True})
    def test_enqueue_workflows__adds_to_workflow_engine_buffer_new_buffer(
        self, mock_randchoice, mock_push_to_hash_bulk, mock_push_to_sorted_set
    ) -> None:
        key_choice = f"{DelayedWorkflow.buffer_key}:{5}"
        mock_randchoice.return_value = key_choice
        enqueue_workflows(
            {
                self.workflow: DelayedWorkflowItem(
                    self.workflow,
                    self.group_event,
                    self.workflow.when_condition_group_id,
                    [self.slow_workflow_filter_group.id],
                    [self.workflow_filter_group.id],
                    timestamp=timezone.now(),
                )
            }
        )

        mock_push_to_sorted_set.assert_called_once_with(
            key=key_choice,
            value=[self.group_event.project_id],
        )

    @patch("sentry.buffer.backend.push_to_sorted_set")
    @patch("sentry.buffer.backend.push_to_hash_bulk")
    @override_options({"workflow_engine.buffer.use_new_buffer": False})
    def test_enqueue_workflow__adds_to_workflow_engine_set(
        self, mock_push_to_hash_bulk, mock_push_to_sorted_set
    ) -> None:
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
        enqueue_workflows(
            {
                self.workflow: DelayedWorkflowItem(
                    self.workflow,
                    self.group_event,
                    self.workflow.when_condition_group_id,
                    [self.slow_workflow_filter_group.id, slow_workflow_filter_group_2.id],
                    [self.workflow_filter_group.id, workflow_filter_group_2.id],
                    timestamp=current_time,
                )
            }
        )

        slow_condition_group_ids = ",".join(
            str(id) for id in [self.slow_workflow_filter_group.id, slow_workflow_filter_group_2.id]
        )
        passing_condition_group_ids = ",".join(
            str(id) for id in [self.workflow_filter_group.id, workflow_filter_group_2.id]
        )
        mock_push_to_hash_bulk.assert_called_once_with(
            model=Workflow,
            filters={"project_id": self.group_event.project_id},
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
    def test_delete_workflow(self, instance_attr) -> None:
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
