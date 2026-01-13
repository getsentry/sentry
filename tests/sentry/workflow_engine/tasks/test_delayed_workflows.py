from datetime import datetime
from unittest.mock import MagicMock, patch

from sentry.constants import ObjectStatus
from sentry.grouping.grouptype import ErrorGroupType
from sentry.models.environment import Environment
from sentry.models.project import Project
from sentry.testutils.helpers import override_options
from sentry.testutils.helpers.datetime import before_now
from sentry.utils import json
from sentry.workflow_engine.buffer.batch_client import DelayedWorkflowClient
from sentry.workflow_engine.models import DataConditionGroup, Detector, Workflow
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.processors.delayed_workflow import (
    EventRedisData,
    _process_workflows_for_project,
    process_delayed_workflows,
)
from sentry.workflow_engine.processors.schedule import process_in_batches
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest
from tests.snuba.rules.conditions.test_event_frequency import BaseEventFrequencyPercentTest

FROZEN_TIME = before_now(days=1).replace(hour=1, minute=30, second=0, microsecond=0)


class TestDelayedWorkflowTaskBase(BaseWorkflowTest, BaseEventFrequencyPercentTest):
    def setUp(self) -> None:
        super().setUp()

        self.workflow1, self.workflow1_if_dcgs = self.create_project_event_freq_workflow(
            self.project, self.environment, has_when_slow_condition=True
        )
        self.workflow2, self.workflow2_if_dcgs = self.create_project_event_freq_workflow(
            self.project
        )

        self.project2 = self.create_project()
        self.environment2 = self.create_environment(project=self.project2)

        self.event1, self.group1 = self.setup_event(self.project, self.environment, "group-1")
        self.event2, self.group2 = self.setup_event(self.project, self.environment, "group-2")

        self.workflow_group_dcg_mapping = {
            f"{self.workflow1.id}:{self.group1.id}:{self.workflow1.when_condition_group_id}:{self.workflow1_if_dcgs[0].id}:{self.workflow1_if_dcgs[1].id}",
            f"{self.workflow2.id}:{self.group2.id}::{self.workflow2_if_dcgs[0].id}:{self.workflow2_if_dcgs[1].id}",
        }

        self.detector = Detector.objects.get(project_id=self.project.id, type=ErrorGroupType.slug)
        self.detector_dcg = self.create_data_condition_group()
        self.detector.update(workflow_condition_group=self.detector_dcg)

        self.batch_client = DelayedWorkflowClient()
        self.batch_client.add_project_ids([self.project.id, self.project2.id])

    def create_project_event_freq_workflow(
        self,
        project: Project,
        environment: Environment | None = None,
        has_when_slow_condition: bool = False,
    ) -> tuple[Workflow, list[DataConditionGroup]]:
        detector, _ = Detector.objects.get_or_create(
            project_id=project.id, type=ErrorGroupType.slug, defaults={"config": {}}
        )

        workflow_trigger_group = self.create_data_condition_group(
            logic_type=DataConditionGroup.Type.ANY_SHORT_CIRCUIT
        )
        if has_when_slow_condition:
            self.create_data_condition(
                condition_group=workflow_trigger_group,
                type=Condition.EVENT_FREQUENCY_COUNT,
                comparison={"interval": "1h", "value": 100},
                condition_result=True,
            )

        workflow = self.create_workflow(
            when_condition_group=workflow_trigger_group,
            organization=project.organization,
            environment=environment,
        )
        self.create_detector_workflow(
            detector=detector,
            workflow=workflow,
        )

        workflow_action_slow_filter_group = self.create_data_condition_group(
            logic_type=DataConditionGroup.Type.ALL
        )
        self.create_data_condition(
            condition_group=workflow_action_slow_filter_group,
            type=Condition.EVENT_FREQUENCY_PERCENT,
            comparison={"interval": "1h", "value": 100, "comparison_interval": "1w"},
            condition_result=True,
        )

        workflow_action_filter_group = self.create_data_condition_group(
            logic_type=DataConditionGroup.Type.ALL
        )
        self.create_data_condition(
            condition_group=workflow_action_filter_group,
            type=Condition.EVENT_FREQUENCY_COUNT,
            comparison={"interval": "1h", "value": 100},
            condition_result=True,
        )
        self.create_workflow_data_condition_group(
            workflow=workflow, condition_group=workflow_action_filter_group
        )
        self.create_workflow_data_condition_group(
            workflow=workflow, condition_group=workflow_action_slow_filter_group
        )

        return workflow, [workflow_action_slow_filter_group, workflow_action_filter_group]

    def setup_event(self, project, environment, name):
        event = self.create_event(project.id, FROZEN_TIME, name, environment.name)
        assert event.group
        return event, event.group

    def push_to_hash(
        self,
        project_id: int,
        workflow_id: int,
        group_id: int,
        when_dcg_id: int | None,
        if_dcgs: list[DataConditionGroup],
        passing_dcgs: list[DataConditionGroup],
        event_id: str | None = None,
        occurrence_id: str | None = None,
        timestamp: datetime | None = None,
    ) -> None:
        value_dict: dict[str, str | None | datetime] = {
            "event_id": event_id,
            "occurrence_id": occurrence_id,
        }
        if timestamp:
            value_dict["timestamp"] = timestamp
        value = json.dumps(value_dict)
        when_dcg_str = str(when_dcg_id) if when_dcg_id else ""
        field = f"{workflow_id}:{group_id}:{when_dcg_str}:{','.join([str(dcg.id) for dcg in if_dcgs])}:{','.join([str(dcg.id) for dcg in passing_dcgs])}"
        self.batch_client.for_project(project_id).push_to_hash(
            batch_key=None,
            data={field: value},
        )

    def _push_base_events(self, timestamp: datetime | None = None) -> None:
        workflow_to_data = {
            self.workflow1: (
                self.project,
                self.workflow1.when_condition_group_id,
                [self.workflow1_if_dcgs[0]],
                [self.workflow1_if_dcgs[1]],
                self.event1,
                self.group1,
            ),
            self.workflow2: (
                self.project,
                None,
                [self.workflow2_if_dcgs[0]],
                [self.workflow2_if_dcgs[1]],
                self.event2,
                self.group2,
            ),
        }

        for workflow, (
            project,
            when_condition_group_id,
            if_condition_groups,
            passing_if_groups,
            event,
            group,
        ) in workflow_to_data.items():
            self.push_to_hash(
                project_id=project.id,
                workflow_id=workflow.id,
                group_id=group.id,
                when_dcg_id=when_condition_group_id,
                if_dcgs=if_condition_groups,
                passing_dcgs=passing_if_groups,
                event_id=event.event_id,
                timestamp=timestamp,
            )


class TestDelayedWorkflowTaskIntegration(TestDelayedWorkflowTaskBase):
    @override_options({"delayed_processing.batch_size": 1})
    @patch("sentry.workflow_engine.tasks.delayed_workflows.process_delayed_workflows.apply_async")
    def test_batched_cleanup(self, mock_process_delayed: MagicMock) -> None:
        self._push_base_events()
        project_client = self.batch_client.for_project(self.project.id)
        all_data = project_client.get_hash_data(batch_key=None)

        process_in_batches(project_client)
        batch_one_key = mock_process_delayed.call_args_list[0][1]["kwargs"]["batch_key"]
        batch_two_key = mock_process_delayed.call_args_list[1][1]["kwargs"]["batch_key"]

        # Verify we removed the data from the buffer
        data = project_client.get_hash_data(batch_key=None)
        assert data == {}

        first_batch = project_client.get_hash_data(batch_key=batch_one_key)
        event_data = EventRedisData.from_redis_data(first_batch, continue_on_error=False)
        from sentry.workflow_engine.processors.delayed_workflow import cleanup_redis_buffer

        cleanup_redis_buffer(
            project_client,
            event_data.events.keys(),
            batch_one_key,
        )

        # Verify the batch we "executed" is removed
        data = project_client.get_hash_data(batch_key=batch_one_key)
        assert data == {}

        # Verify the batch we didn't execute is still in redis
        data = project_client.get_hash_data(batch_key=batch_two_key)
        for key in first_batch.keys():
            all_data.pop(key)
        assert data == all_data

    def test_deleted_workflow_events_cleaned_from_redis(self) -> None:
        self._push_base_events()
        self.workflow1.update(status=ObjectStatus.PENDING_DELETION)

        project_client = self.batch_client.for_project(self.project.id)
        initial_data = project_client.get_hash_data(batch_key=None)
        assert len(initial_data) > 0

        with patch("sentry.workflow_engine.processors.delayed_workflow.fire_actions_for_groups"):
            process_delayed_workflows(self.batch_client, self.project.id)

        final_data = project_client.get_hash_data(batch_key=None)
        assert final_data == {}

    @patch("sentry.workflow_engine.processors.delayed_workflow.get_condition_group_results")
    def test_deleted_workflow_skips_snuba_queries(self, mock_snuba: MagicMock) -> None:
        redis_data = {
            f"{self.workflow1.id}:{self.group1.id}::1:": '{"event_id": "event-1"}',
            f"{self.workflow2.id}:{self.group2.id}::2:": '{"event_id": "event-2"}',
        }
        event_data = EventRedisData.from_redis_data(redis_data, continue_on_error=False)

        self.workflow1.update(status=ObjectStatus.PENDING_DELETION)
        self.workflow2.update(status=ObjectStatus.DELETION_IN_PROGRESS)

        _process_workflows_for_project(self.project, event_data)

        mock_snuba.assert_not_called()

    def test_partial_workflow_deletion(self) -> None:
        self._push_base_events()
        self.workflow1.update(status=ObjectStatus.DELETION_IN_PROGRESS)

        project_client = self.batch_client.for_project(self.project.id)
        initial_data = project_client.get_hash_data(batch_key=None)
        assert len(initial_data) == 2

        with patch(
            "sentry.workflow_engine.processors.delayed_workflow.fire_actions_for_groups"
        ) as mock_fire:
            process_delayed_workflows(self.batch_client, self.project.id)
            assert mock_fire.called

        final_data = project_client.get_hash_data(batch_key=None)
        assert final_data == {}
