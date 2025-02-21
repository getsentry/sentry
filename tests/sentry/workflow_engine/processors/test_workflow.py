from datetime import timedelta
from unittest import mock

import pytest

from sentry import buffer
from sentry.eventstream.base import GroupState
from sentry.grouping.grouptype import ErrorGroupType
from sentry.testutils.factories import Factories
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.helpers.redis import mock_redis_buffer
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils import json
from sentry.workflow_engine.models import (
    Action,
    DataConditionGroup,
    DataConditionGroupAction,
    Workflow,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.processors.workflow import (
    WORKFLOW_ENGINE_BUFFER_LIST_KEY,
    WorkflowDataConditionGroupType,
    delete_workflow,
    enqueue_workflow,
    evaluate_workflow_triggers,
    evaluate_workflows_action_filters,
    process_workflows,
)
from sentry.workflow_engine.types import WorkflowJob
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
        self.job = WorkflowJob(
            {
                "event": self.group_event,
                "group_state": GroupState(
                    id=1, is_new=False, is_regression=True, is_new_group_environment=False
                ),
            }
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

        triggered_workflows = process_workflows(self.job)
        assert triggered_workflows == {self.error_workflow}

    def test_error_event(self):
        triggered_workflows = process_workflows(self.job)
        assert triggered_workflows == {self.error_workflow}

    def test_issue_occurrence_event(self):
        issue_occurrence = self.build_occurrence(evidence_data={"detector_id": self.detector.id})
        self.group_event.occurrence = issue_occurrence

        triggered_workflows = process_workflows(self.job)
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

        triggered_workflows = process_workflows(self.job)
        assert triggered_workflows == {self.error_workflow, workflow}

    def test_no_detector(self):
        self.group_event.occurrence = self.build_occurrence(evidence_data={})

        with mock.patch("sentry.workflow_engine.processors.workflow.logger") as mock_logger:
            with mock.patch("sentry.workflow_engine.processors.workflow.metrics") as mock_metrics:
                triggered_workflows = process_workflows(self.job)

                assert not triggered_workflows

                mock_metrics.incr.assert_called_once_with("workflow_engine.process_workflows.error")
                mock_logger.exception.assert_called_once_with(
                    "Detector not found for event",
                    extra={"event_id": self.event.event_id},
                )

    @mock.patch("sentry.workflow_engine.processors.workflow.logger")
    def test_no_metrics_triggered(self, mock_logger):
        self.job["event"].project_id = 0

        with mock.patch("sentry.utils.metrics.incr") as mock_incr:
            process_workflows(self.job)
            mock_incr.assert_called_once_with("workflow_engine.process_workflows.error")
            mock_logger.exception.assert_called_once()

    def test_metrics_with_workflows(self):
        with mock.patch("sentry.utils.metrics.incr") as mock_incr:
            process_workflows(self.job)

            mock_incr.assert_any_call(
                "workflow_engine.process_workflows",
                1,
                tags={"detector_type": self.error_detector.type},
            )

    def test_metrics_triggered_workflows(self):
        with mock.patch("sentry.utils.metrics.incr") as mock_incr:
            process_workflows(self.job)

            mock_incr.assert_any_call(
                "workflow_engine.process_workflows.triggered_workflows",
                1,
                tags={"detector_type": self.error_detector.type},
            )

    def test_metrics_triggered_actions(self):
        # add actions to the workflow

        with mock.patch("sentry.utils.metrics.incr") as mock_incr:
            process_workflows(self.job)
            mock_incr.assert_any_call(
                "workflow_engine.process_workflows.triggered_actions",
                0,
                tags={"detector_type": self.error_detector.type},
            )


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
        self.job = WorkflowJob({"event": self.group_event})

    def test_workflow_trigger(self):
        triggered_workflows = evaluate_workflow_triggers({self.workflow}, self.job)
        assert triggered_workflows == {self.workflow}

    def test_no_workflow_trigger(self):
        triggered_workflows = evaluate_workflow_triggers(set(), self.job)
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

        triggered_workflows = evaluate_workflow_triggers({self.workflow}, self.job)
        assert triggered_workflows == {self.workflow}

    def test_workflow_filtered_out(self):
        assert self.workflow.when_condition_group
        self.workflow.when_condition_group.update(logic_type=DataConditionGroup.Type.ALL)

        self.create_data_condition(
            condition_group=self.workflow.when_condition_group,
            type=Condition.EVENT_CREATED_BY_DETECTOR,
            comparison=self.detector.id + 1,
        )

        triggered_workflows = evaluate_workflow_triggers({self.workflow}, self.job)
        assert not triggered_workflows

    def test_many_workflows(self):
        workflow_two, _, _, _ = self.create_detector_and_workflow(name_prefix="two")
        triggered_workflows = evaluate_workflow_triggers({self.workflow, workflow_two}, self.job)

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

        triggered_workflows = evaluate_workflow_triggers({self.workflow}, self.job)
        # no workflows are triggered because the slow conditions need to be evaluted
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
        self.job = WorkflowJob({"event": self.group_event})
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

        triggered_workflows = evaluate_workflow_triggers({self.workflow}, self.job)
        assert not triggered_workflows

        process_workflows(self.job)

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

        triggered_workflows = evaluate_workflow_triggers({self.workflow}, self.job)
        assert not triggered_workflows

        project_ids = buffer.backend.get_sorted_set(
            WORKFLOW_ENGINE_BUFFER_LIST_KEY, 0, self.buffer_timestamp
        )
        assert project_ids[0][0] == self.project.id


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
        self.job = WorkflowJob({"event": self.group_event})

    def test_basic__no_filter(self):
        triggered_actions = evaluate_workflows_action_filters({self.workflow}, self.job)
        assert set(triggered_actions) == {self.action}

    def test_basic__with_filter__passes(self):
        self.create_data_condition(
            condition_group=self.action_group,
            type=Condition.EVENT_SEEN_COUNT,
            comparison=1,
            condition_result=True,
        )

        triggered_actions = evaluate_workflows_action_filters({self.workflow}, self.job)
        assert set(triggered_actions) == {self.action}

    def test_basic__with_filter__filtered(self):
        # Add a filter to the action's group
        self.create_data_condition(
            condition_group=self.action_group,
            type=Condition.EVENT_CREATED_BY_DETECTOR,
            comparison=self.detector.id + 1,
        )

        triggered_actions = evaluate_workflows_action_filters({self.workflow}, self.job)
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

        triggered_actions = evaluate_workflows_action_filters({self.workflow}, self.job)

        assert self.action_group.conditions.count() == 2

        # The first condition passes, but the second is enqueued for later evaluation
        assert not triggered_actions

        # TODO @saponifi3d - Add a check to ensure the second condition is enqueued for later evaluation


class TestEnqueueWorkflows(BaseWorkflowTest):
    def setUp(self):
        self.workflow = self.create_workflow()
        self.data_condition_group = self.create_data_condition_group()
        self.condition = self.create_data_condition(condition_group=self.data_condition_group)
        _, self.event, self.group_event = self.create_group_event()

    @mock.patch("sentry.buffer.backend.push_to_hash")
    @mock.patch("sentry.buffer.backend.push_to_sorted_set")
    def test_enqueue_workflow__adds_to_workflow_engine_buffer(
        self, mock_push_to_hash, mock_push_to_sorted_set
    ):
        enqueue_workflow(
            self.workflow,
            [self.condition],
            self.group_event,
            WorkflowDataConditionGroupType.WORKFLOW_TRIGGER,
        )

        mock_push_to_hash.assert_called_once_with(
            key=WORKFLOW_ENGINE_BUFFER_LIST_KEY,
            value=self.group_event.project_id,
        )

    @mock.patch("sentry.buffer.backend.push_to_hash")
    @mock.patch("sentry.buffer.backend.push_to_sorted_set")
    def test_enqueue_workflow__adds_to_workflow_engine_set(
        self, mock_push_to_hash, mock_push_to_sorted_set
    ):
        enqueue_workflow(
            self.workflow,
            [self.condition],
            self.group_event,
            WorkflowDataConditionGroupType.WORKFLOW_TRIGGER,
        )

        mock_push_to_sorted_set.assert_called_once_with(
            model=Workflow,
            filters={"project_id": self.group_event.project_id},
            field=f"{self.workflow.id}:{self.group_event.group_id}:{self.condition.condition_group_id}:workflow_trigger",
            value=json.dumps(
                {"event_id": self.event.event_id, "occurrence_id": self.group_event.occurrence_id}
            ),
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
