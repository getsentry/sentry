from datetime import timedelta
from typing import DefaultDict
from unittest.mock import patch

import pytest
from django.utils import timezone

from sentry import buffer
from sentry.eventstream.base import GroupState
from sentry.grouping.grouptype import ErrorGroupType
from sentry.models.activity import Activity
from sentry.models.environment import Environment
from sentry.models.rule import Rule
from sentry.testutils.factories import Factories
from sentry.testutils.helpers import with_feature
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.helpers.redis import mock_redis_buffer
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.types.activity import ActivityType
from sentry.utils import json
from sentry.workflow_engine.models import (
    Action,
    AlertRuleWorkflow,
    DataConditionGroup,
    DataConditionGroupAction,
    Detector,
    Workflow,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.processors.workflow import (
    WORKFLOW_ENGINE_BUFFER_LIST_KEY,
    DelayedWorkflowItem,
    WorkflowDataConditionGroupType,
    delete_workflow,
    enqueue_workflows,
    evaluate_workflow_triggers,
    evaluate_workflows_action_filters,
    process_workflows,
)
from sentry.workflow_engine.types import ActionHandler, WorkflowEventData
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest

FROZEN_TIME = before_now(days=1).replace(hour=1, minute=30, second=0, microsecond=0)


class TestProcessWorkflows(BaseWorkflowTest):
    def setUp(self):
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

    def test_skips_disabled_workflows(self):
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

    def test_error_event(self):
        triggered_workflows = process_workflows(self.event_data)
        assert triggered_workflows == {self.error_workflow}

    @with_feature("organizations:workflow-engine-process-workflows-logs")
    @patch("sentry.workflow_engine.processors.workflow.logger")
    def test_error_event__logger(self, mock_logger):
        self.action_group, self.action = self.create_workflow_action(workflow=self.error_workflow)

        rule = Rule.objects.get(project=self.project)
        AlertRuleWorkflow.objects.create(workflow=self.error_workflow, rule_id=rule.id)

        triggered_workflows = process_workflows(self.event_data)
        assert triggered_workflows == {self.error_workflow}

        mock_logger.debug.assert_any_call(
            "workflow_engine.evaluate_workflows_action_filters",
            extra={
                "group_id": self.group.id,
                "event_id": self.event.event_id,
                "workflow_ids": [self.error_workflow.id],
                "action_conditions": [self.action_group.id],
                "filtered_action_groups": [self.action_group.id],
            },
        )

    @patch("sentry.workflow_engine.processors.workflow.filter_recently_fired_workflow_actions")
    def test_populate_workflow_env_for_filters(self, mock_filter):
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

    def test_same_environment_only(self):
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

    def test_issue_occurrence_event(self):
        issue_occurrence = self.build_occurrence(evidence_data={"detector_id": self.detector.id})
        self.group_event.occurrence = issue_occurrence

        triggered_workflows = process_workflows(self.event_data)
        assert triggered_workflows == {self.workflow}

    def test_regressed_event(self):
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
    def test_no_detector(self, mock_logger, mock_incr):
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
    def test_no_environment(self, mock_logger, mock_incr):
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
    def test_no_metrics_triggered(self, mock_logger, mock_incr):
        self.event_data.event.project_id = 0

        process_workflows(self.event_data)
        mock_incr.assert_called_once_with("workflow_engine.detectors.error")
        mock_logger.exception.assert_called_once()

    @patch("sentry.utils.metrics.incr")
    def test_metrics_with_workflows(self, mock_incr):
        process_workflows(self.event_data)

        mock_incr.assert_any_call(
            "workflow_engine.process_workflows",
            1,
            tags={"detector_type": self.error_detector.type},
        )

    @patch("sentry.utils.metrics.incr")
    def test_metrics_triggered_workflows(self, mock_incr):
        process_workflows(self.event_data)

        mock_incr.assert_any_call(
            "workflow_engine.process_workflows.triggered_workflows",
            1,
            tags={"detector_type": self.error_detector.type},
        )

    @with_feature("organizations:workflow-engine-process-workflows")
    @with_feature("organizations:workflow-engine-trigger-actions")
    @patch("sentry.utils.metrics.incr")
    def test_metrics_triggered_actions(self, mock_incr):
        # add actions to the workflow
        self.action_group, self.action = self.create_workflow_action(
            workflow=self.error_workflow,
        )

        # mock the handler to get a fake noop handler
        with patch(
            "sentry.workflow_engine.models.action.action_handler_registry.get"
        ) as mock_handler:

            class MockHandler(ActionHandler):
                @staticmethod
                def execute(
                    event_data: WorkflowEventData, action: Action, detector: Detector
                ) -> None:
                    return None

            mock_handler.return_value = MockHandler

            # process the workflows
            process_workflows(self.event_data)
            mock_incr.assert_any_call(
                "workflow_engine.action.trigger",
                1,
                tags={
                    "detector_type": self.error_detector.type,
                    "action_type": self.action.type,
                },
            )


@mock_redis_buffer()
class TestEvaluateWorkflowTriggers(BaseWorkflowTest):
    def setUp(self):
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

    def test_workflow_trigger(self):
        triggered_workflows = evaluate_workflow_triggers({self.workflow}, self.event_data)
        assert triggered_workflows == {self.workflow}

    def test_workflow_trigger__no_conditions(self):
        assert self.workflow.when_condition_group
        self.workflow.when_condition_group.conditions.all().delete()

        triggered_workflows = evaluate_workflow_triggers({self.workflow}, self.event_data)
        assert triggered_workflows == {self.workflow}

    def test_no_workflow_trigger(self):
        triggered_workflows = evaluate_workflow_triggers(set(), self.event_data)
        assert not triggered_workflows

    def test_workflow_many_filters(self):
        assert self.workflow.when_condition_group
        self.workflow.when_condition_group.update(logic_type=DataConditionGroup.Type.ALL)

        self.create_data_condition(
            condition_group=self.workflow.when_condition_group,
            type=Condition.EVENT_CREATED_BY_DETECTOR,
            comparison=self.detector.id,
            condition_result=75,
        )

        triggered_workflows = evaluate_workflow_triggers({self.workflow}, self.event_data)
        assert triggered_workflows == {self.workflow}

    def test_workflow_filtered_out(self):
        assert self.workflow.when_condition_group
        self.workflow.when_condition_group.update(logic_type=DataConditionGroup.Type.ALL)

        self.create_data_condition(
            condition_group=self.workflow.when_condition_group,
            type=Condition.EVENT_CREATED_BY_DETECTOR,
            comparison=self.detector.id + 1,
        )

        triggered_workflows = evaluate_workflow_triggers({self.workflow}, self.event_data)
        assert not triggered_workflows

    def test_many_workflows(self):
        workflow_two, _, _, _ = self.create_detector_and_workflow(name_prefix="two")
        triggered_workflows = evaluate_workflow_triggers(
            {self.workflow, workflow_two}, self.event_data
        )

        assert triggered_workflows == {self.workflow, workflow_two}

    def test_delays_slow_conditions(self):
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

        triggered_workflows = evaluate_workflow_triggers({self.workflow}, self.event_data)
        # no workflows are triggered because the slow conditions need to be evaluated
        assert triggered_workflows == set()

    def test_activity_update__slow_condition(self):
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
        with patch("sentry.workflow_engine.processors.workflow.enqueue_workflows") as mock_enqueue:
            triggered_workflows = evaluate_workflow_triggers({self.workflow}, self.event_data)

            empty_list = DefaultDict[int, list[DelayedWorkflowItem]](list)
            mock_enqueue.assert_called_once_with(empty_list)

            # no workflows are triggered because the slow conditions need to be evaluated
            assert triggered_workflows == set()


@freeze_time(FROZEN_TIME)
class TestEnqueueWorkflow(BaseWorkflowTest):
    buffer_timestamp = (FROZEN_TIME + timedelta(seconds=1)).timestamp()

    def setUp(self):
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
        self.create_workflow_action(self.workflow)
        self.mock_redis_buffer = mock_redis_buffer()
        self.mock_redis_buffer.__enter__()

    def tearDown(self):
        self.mock_redis_buffer.__exit__(None, None, None)

    def test_enqueues_workflow_all_logic_type(self):
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

        triggered_workflows = evaluate_workflow_triggers({self.workflow}, self.event_data)
        assert not triggered_workflows

        process_workflows(self.event_data)

        project_ids = buffer.backend.get_sorted_set(
            WORKFLOW_ENGINE_BUFFER_LIST_KEY, 0, self.buffer_timestamp
        )
        assert project_ids
        assert project_ids[0][0] == self.project.id

    def test_enqueues_workflow_any_logic_type(self):
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

        triggered_workflows = evaluate_workflow_triggers({self.workflow}, self.event_data)
        assert not triggered_workflows

        project_ids = buffer.backend.get_sorted_set(
            WORKFLOW_ENGINE_BUFFER_LIST_KEY, 0, self.buffer_timestamp
        )
        assert project_ids[0][0] == self.project.id

    def test_skips_enqueuing_any(self):
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

        triggered_workflows = evaluate_workflow_triggers({self.workflow}, self.event_data)
        assert triggered_workflows == {self.workflow}
        project_ids = buffer.backend.get_sorted_set(
            WORKFLOW_ENGINE_BUFFER_LIST_KEY, 0, self.buffer_timestamp
        )
        assert len(project_ids) == 0

    def test_skips_enqueuing_all(self):
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

        triggered_workflows = evaluate_workflow_triggers({self.workflow}, self.event_data)
        assert not triggered_workflows
        project_ids = buffer.backend.get_sorted_set(
            WORKFLOW_ENGINE_BUFFER_LIST_KEY, 0, self.buffer_timestamp
        )
        assert len(project_ids) == 0


@mock_redis_buffer()
class TestEvaluateWorkflowActionFilters(BaseWorkflowTest):
    def setUp(self):
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

    @with_feature("organizations:workflow-engine-process-workflows")
    @with_feature("organizations:workflow-engine-metric-alert-dual-processing-logs")
    @patch("sentry.utils.metrics.incr")
    def test_metrics_issue_dual_processing_metrics(self, mock_incr):
        process_workflows(self.event_data)
        mock_incr.assert_any_call(
            "workflow_engine.process_workflows.fired_actions",
            1,
            tags={
                "detector_type": self.detector.type,
            },
        )

    def test_basic__no_filter(self) -> None:
        triggered_actions = evaluate_workflows_action_filters({self.workflow}, self.event_data)
        assert set(triggered_actions) == {self.action_group}
        assert {getattr(action, "workflow_id") for action in triggered_actions} == {
            self.workflow.id
        }

    def test_basic__with_filter__passes(self):
        self.create_data_condition(
            condition_group=self.action_group,
            type=Condition.EVENT_SEEN_COUNT,
            comparison=1,
            condition_result=True,
        )

        triggered_actions = evaluate_workflows_action_filters({self.workflow}, self.event_data)
        assert set(triggered_actions) == {self.action_group}
        assert {getattr(action, "workflow_id") for action in triggered_actions} == {
            self.workflow.id
        }

    def test_basic__with_filter__filtered(self):
        # Add a filter to the action's group
        self.create_data_condition(
            condition_group=self.action_group,
            type=Condition.EVENT_CREATED_BY_DETECTOR,
            comparison=self.detector.id + 1,
        )

        triggered_actions = evaluate_workflows_action_filters({self.workflow}, self.event_data)
        assert not triggered_actions

    def test_with_slow_conditions(self):
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

        triggered_actions = evaluate_workflows_action_filters({self.workflow}, self.event_data)

        assert self.action_group.conditions.count() == 2

        # The first condition passes, but the second is enqueued for later evaluation
        assert not triggered_actions

    def test_activty__with_slow_conditions(self):
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

        with patch("sentry.workflow_engine.processors.workflow.enqueue_workflows") as mock_enqueue:
            with patch("sentry.workflow_engine.processors.workflow.metrics_incr") as mock_incr:
                # Evaluate the workflow actions with a slow condition
                evaluate_workflows_action_filters({self.workflow}, self.event_data)

                # ensure we do not enqueue slow condition evaluation
                empty_list = DefaultDict[int, list[DelayedWorkflowItem]](list)
                mock_enqueue.assert_called_once_with(empty_list)
                mock_incr.assert_called_once_with("process_workflows.enqueue_workflow.activity")


class TestEnqueueWorkflows(BaseWorkflowTest):
    def setUp(self):
        self.workflow = self.create_workflow()
        self.data_condition_group = self.create_data_condition_group()
        self.condition = self.create_data_condition(condition_group=self.data_condition_group)
        _, self.event, self.group_event = self.create_group_event()
        self.workflow_event_data = WorkflowEventData(
            event=self.group_event,
            group=self.group_event.group,
        )

    @patch("sentry.buffer.backend.push_to_sorted_set")
    @patch("sentry.buffer.backend.push_to_hash_bulk")
    def test_enqueue_workflows__adds_to_workflow_engine_buffer(
        self, mock_push_to_hash_bulk, mock_push_to_sorted_set
    ):
        enqueue_workflows(
            {
                self.group_event.project_id: [
                    DelayedWorkflowItem(
                        self.workflow,
                        [self.condition],
                        self.group_event,
                        WorkflowDataConditionGroupType.WORKFLOW_TRIGGER,
                        timestamp=timezone.now(),
                    )
                ]
            }
        )

        mock_push_to_sorted_set.assert_called_once_with(
            key=WORKFLOW_ENGINE_BUFFER_LIST_KEY,
            value=[self.group_event.project_id],
        )

    @patch("sentry.buffer.backend.push_to_sorted_set")
    @patch("sentry.buffer.backend.push_to_hash_bulk")
    def test_enqueue_workflow__adds_to_workflow_engine_set(
        self, mock_push_to_hash_bulk, mock_push_to_sorted_set
    ):
        current_time = timezone.now()
        condition2 = self.create_data_condition(condition_group=self.create_data_condition_group())
        condition3 = self.create_data_condition(condition_group=self.create_data_condition_group())
        enqueue_workflows(
            {
                self.group_event.project_id: [
                    DelayedWorkflowItem(
                        self.workflow,
                        [self.condition, condition2, condition3],
                        self.group_event,
                        WorkflowDataConditionGroupType.WORKFLOW_TRIGGER,
                        timestamp=current_time,
                    )
                ]
            }
        )

        condition_group_ids = ",".join(
            str(condition.condition_group_id)
            for condition in [self.condition, condition2, condition3]
        )
        mock_push_to_hash_bulk.assert_called_once_with(
            model=Workflow,
            filters={"project_id": self.group_event.project_id},
            data={
                f"{self.workflow.id}:{self.group_event.group_id}:{condition_group_ids}:workflow_trigger": json.dumps(
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
    def setUp(self):
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
    def test_delete_workflow(self, instance_attr):
        instance = getattr(self, instance_attr)
        instance_id = instance.id
        cls = instance.__class__

        delete_workflow(self.workflow)
        assert not cls.objects.filter(id=instance_id).exists()

    def test_delete_workflow__no_actions(self):
        Action.objects.get(id=self.action.id).delete()
        assert not DataConditionGroupAction.objects.filter(id=self.action_and_filter.id).exists()

        workflow_id = self.workflow.id
        delete_workflow(self.workflow)

        assert not Workflow.objects.filter(id=workflow_id).exists()

    def test_delete_workflow__no_workflow_triggers(self):
        # TODO - when this condition group is deleted, it's removing the workflow
        # it's basically inverted from what's expected on the cascade delete
        self.workflow.when_condition_group = None
        self.workflow.save()

        DataConditionGroup.objects.get(id=self.workflow_trigger.id).delete()

        workflow_id = self.workflow.id
        delete_workflow(self.workflow)
        assert not Workflow.objects.filter(id=workflow_id).exists()
