from datetime import datetime
from unittest.mock import MagicMock, patch
from uuid import uuid4

from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.helpers.options import override_options
from sentry.utils import json
from sentry.workflow_engine.buffer.batch_client import DelayedWorkflowClient
from sentry.workflow_engine.processors.schedule import (
    bucket_num_groups,
    process_buffered_workflows,
    process_in_batches,
)

FROZEN_TIME = before_now(days=1).replace(hour=1, minute=30, second=0, microsecond=0)


def test_bucket_num_groups() -> None:
    assert bucket_num_groups(1) == "1"
    assert bucket_num_groups(50) == ">10"
    assert bucket_num_groups(101) == ">100"


@freeze_time(FROZEN_TIME)
class CreateEventTestCase(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.batch_client = DelayedWorkflowClient()

    def push_to_hash(self, project_id, rule_id, group_id, event_id=None, occurrence_id=None):
        value = json.dumps({"event_id": event_id, "occurrence_id": occurrence_id})
        self.batch_client.for_project(project_id).push_to_hash(
            batch_key=None,
            data={f"{rule_id}:{group_id}": value},
        )


class ProcessBufferedWorkflowsTest(CreateEventTestCase):
    @override_options(
        {"delayed_workflow.rollout": True},
    )
    @patch("sentry.workflow_engine.processors.schedule.process_in_batches")
    def test_fetches_from_buffer_and_executes_with_conditional_delete(
        self, mock_process_in_batches: MagicMock
    ) -> None:
        project = self.create_project()
        project_two = self.create_project()
        group = self.create_group(project)
        group_two = self.create_group(project_two)

        # Push data to buffer (need actual workflow data, not just rule data)
        self.batch_client.for_project(project.id).push_to_hash(
            batch_key=None,
            data={f"345:{group.id}": json.dumps({"event_id": "event-1"})},
        )
        self.batch_client.for_project(project_two.id).push_to_hash(
            batch_key=None,
            data={f"345:{group_two.id}": json.dumps({"event_id": "event-2"})},
        )

        # Add projects to sorted set
        self.batch_client.add_project_ids([project.id, project_two.id])

        process_buffered_workflows(self.batch_client)

        # Should be called for each project
        assert mock_process_in_batches.call_count == 2

        # Verify that the buffer keys are cleaned up
        fetch_time = datetime.now().timestamp()
        all_project_ids = self.batch_client.get_project_ids(min=0, max=fetch_time)
        assert all_project_ids == {}

    @patch("sentry.workflow_engine.processors.schedule.process_in_batches")
    @override_options({"delayed_workflow.rollout": False})
    def test_skips_processing_with_option(self, mock_process_in_batches) -> None:
        project = self.create_project()
        self.batch_client.add_project_ids([project.id])

        process_buffered_workflows(self.batch_client)

        assert mock_process_in_batches.call_count == 0

        # Verify that the buffer keys are NOT cleaned up when disabled
        fetch_time = datetime.now().timestamp()
        all_project_ids = self.batch_client.get_project_ids(min=0, max=fetch_time)
        # Should still contain our project
        assert project.id in all_project_ids


class ProcessInBatchesTest(CreateEventTestCase):
    def setUp(self) -> None:
        super().setUp()

        self.project = self.create_project()
        self.group = self.create_group(self.project)
        self.group_two = self.create_group(self.project)
        self.group_three = self.create_group(self.project)
        self.rule = self.create_alert_rule()

    @patch("sentry.workflow_engine.tasks.delayed_workflows.process_delayed_workflows.apply_async")
    def test_no_redis_data(self, mock_apply_delayed: MagicMock) -> None:
        process_in_batches(self.batch_client.for_project(self.project.id))
        mock_apply_delayed.assert_called_once_with(
            kwargs={"project_id": self.project.id}, headers={"sentry-propagate-traces": False}
        )

    @patch("sentry.workflow_engine.tasks.delayed_workflows.process_delayed_workflows.apply_async")
    def test_basic(self, mock_apply_delayed: MagicMock) -> None:
        self.push_to_hash(self.project.id, self.rule.id, self.group.id)
        self.push_to_hash(self.project.id, self.rule.id, self.group_two.id)
        self.push_to_hash(self.project.id, self.rule.id, self.group_three.id)

        client = self.batch_client.for_project(self.project.id)
        process_in_batches(client)
        mock_apply_delayed.assert_called_once_with(
            kwargs={"project_id": self.project.id}, headers={"sentry-propagate-traces": False}
        )

    @override_options({"delayed_processing.batch_size": 2})
    @patch("sentry.workflow_engine.tasks.delayed_workflows.process_delayed_workflows.apply_async")
    def test_batch(self, mock_apply_delayed: MagicMock) -> None:
        self.push_to_hash(self.project.id, self.rule.id, self.group.id)
        self.push_to_hash(self.project.id, self.rule.id, self.group_two.id)
        self.push_to_hash(self.project.id, self.rule.id, self.group_three.id)

        client = self.batch_client.for_project(self.project.id)
        process_in_batches(client)
        assert mock_apply_delayed.call_count == 2

        # Validate the batches are created correctly
        batch_one_key = mock_apply_delayed.call_args_list[0][1]["kwargs"]["batch_key"]

        batch_one = client.get_hash_data(batch_key=batch_one_key)
        batch_two_key = mock_apply_delayed.call_args_list[1][1]["kwargs"]["batch_key"]
        batch_two = client.get_hash_data(batch_key=batch_two_key)

        assert len(batch_one) == 2
        assert len(batch_two) == 1

        # Validate that we've cleared the original data to reduce storage usage
        original_data = client.get_hash_data(batch_key=None)
        assert not original_data


class FetchGroupToEventDataTest(CreateEventTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project()
        self.group = self.create_group(self.project)
        self.rule = self.create_alert_rule()
        self.project_client = self.batch_client.for_project(self.project.id)

    def test_get_hash_data_basic(self) -> None:
        self.push_to_hash(self.project.id, self.rule.id, self.group.id, "event-123")

        result = self.project_client.get_hash_data(batch_key=None)

        assert f"{self.rule.id}:{self.group.id}" in result
        data = json.loads(result[f"{self.rule.id}:{self.group.id}"])
        assert data["event_id"] == "event-123"

    def test_get_hash_data_with_batch_key(self) -> None:
        batch_key = str(uuid4())
        self.push_to_hash(self.project.id, self.rule.id, self.group.id, "event-456")

        # Move data to batch
        original_data = self.project_client.get_hash_data(batch_key=None)
        self.project_client.push_to_hash(batch_key=batch_key, data=original_data)

        result = self.project_client.get_hash_data(batch_key=batch_key)

        assert f"{self.rule.id}:{self.group.id}" in result
        data = json.loads(result[f"{self.rule.id}:{self.group.id}"])
        assert data["event_id"] == "event-456"
