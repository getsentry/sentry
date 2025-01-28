from datetime import timedelta
from unittest import mock

from sentry import buffer
from sentry.eventstream.base import GroupState
from sentry.grouping.grouptype import ErrorGroupType
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.helpers.redis import mock_redis_buffer
from sentry.workflow_engine.models import DataConditionGroup
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.processors.workflow import (
    WORKFLOW_ENGINE_BUFFER_LIST_KEY,
    evaluate_workflow_triggers,
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

    def test_skips_slow_conditions(self):
        # triggers workflow if the logic_type is ANY and a condition is met
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
        assert triggered_workflows == {self.workflow}


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

        process_workflows(self.job)

        project_ids = buffer.backend.get_sorted_set(
            WORKFLOW_ENGINE_BUFFER_LIST_KEY, 0, self.buffer_timestamp
        )
        assert project_ids[0][0] == self.project.id
