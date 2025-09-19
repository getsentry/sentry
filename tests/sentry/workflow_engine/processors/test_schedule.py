from datetime import datetime
from unittest.mock import MagicMock, patch
from uuid import uuid4

from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.helpers.options import override_options
from sentry.utils import json
from sentry.workflow_engine.buffer import get_backend
from sentry.workflow_engine.buffer.redis_hash_sorted_set_buffer import RedisHashSortedSetBuffer
from sentry.workflow_engine.processors.schedule import (
    bucket_num_groups,
    fetch_group_to_event_data,
    process_buffered_workflows,
    process_in_batches,
)
from sentry.workflow_engine.tasks.delayed_workflows import DelayedWorkflow

FROZEN_TIME = before_now(days=1).replace(hour=1, minute=30, second=0, microsecond=0)


def mock_workflows_buffer():
    return patch(
        "sentry.workflow_engine.buffer.get_backend", new=lambda: RedisHashSortedSetBuffer()
    )


def test_bucket_num_groups() -> None:
    assert bucket_num_groups(1) == "1"
    assert bucket_num_groups(50) == ">10"
    assert bucket_num_groups(101) == ">100"


@freeze_time(FROZEN_TIME)
class CreateEventTestCase(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.mock_redis_buffer = mock_workflows_buffer()
        self.mock_redis_buffer.__enter__()

    def tearDown(self) -> None:
        self.mock_redis_buffer.__exit__(None, None, None)

    def push_to_hash(self, project_id, rule_id, group_id, event_id=None, occurrence_id=None):
        value = json.dumps({"event_id": event_id, "occurrence_id": occurrence_id})
        buffer = get_backend()
        processing_info = DelayedWorkflow(project_id)
        hash_args = processing_info.hash_args

        buffer.push_to_hash(
            model=hash_args.model,
            filters={"project_id": project_id},
            field=f"{rule_id}:{group_id}",
            value=value,
        )


class ProcessBufferedWorkflowsTest(CreateEventTestCase):
    @override_options({"delayed_workflow.rollout": True})
    @patch("sentry.workflow_engine.processors.schedule.process_in_batches")
    def test_fetches_from_buffer_and_executes(self, mock_process_in_batches: MagicMock) -> None:
        project = self.create_project()
        project_two = self.create_project()
        group = self.create_group(project)
        group_two = self.create_group(project_two)
        rule = self.create_alert_rule()

        # Push data to buffer (need actual workflow data, not just rule data)
        processing_info1 = DelayedWorkflow(project.id)
        processing_info2 = DelayedWorkflow(project_two.id)

        # Add some workflow data to the hash
        buffer = get_backend()
        buffer.push_to_hash(
            model=processing_info1.hash_args.model,
            filters={"project_id": project.id},
            field=f"{rule.id}:{group.id}",
            value=json.dumps({"event_id": "event-1"}),
        )
        buffer.push_to_hash(
            model=processing_info2.hash_args.model,
            filters={"project_id": project_two.id},
            field=f"{rule.id}:{group_two.id}",
            value=json.dumps({"event_id": "event-2"}),
        )

        # Add projects to sorted set (use the main buffer key, not all sharded keys)
        buffer.push_to_sorted_set(key=DelayedWorkflow.buffer_key, value=project.id)
        buffer.push_to_sorted_set(key=DelayedWorkflow.buffer_key, value=project_two.id)

        process_buffered_workflows()

        # Should be called for each project
        assert mock_process_in_batches.call_count == 2

        # Verify that the buffer keys are cleaned up
        fetch_time = datetime.now().timestamp()
        buffer_keys = DelayedWorkflow.get_buffer_keys()
        all_project_ids = buffer.bulk_get_sorted_set(
            buffer_keys,
            min=0,
            max=fetch_time,
        )
        assert all_project_ids == {}

    @patch("sentry.workflow_engine.processors.schedule.process_in_batches")
    @override_options({"delayed_workflow.rollout": False})
    def test_skips_processing_with_option(self, mock_process_in_batches) -> None:
        project = self.create_project()
        buffer = get_backend()
        buffer.push_to_sorted_set(key=DelayedWorkflow.buffer_key, value=project.id)

        process_buffered_workflows()

        assert mock_process_in_batches.call_count == 0

        # Verify that the buffer keys are NOT cleaned up when disabled
        fetch_time = datetime.now().timestamp()
        buffer_keys = DelayedWorkflow.get_buffer_keys()
        all_project_ids = buffer.bulk_get_sorted_set(
            buffer_keys,
            min=0,
            max=fetch_time,
        )
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
        buffer = get_backend()
        process_in_batches(buffer, self.project.id)
        mock_apply_delayed.assert_called_once_with(
            kwargs={"project_id": self.project.id}, headers={"sentry-propagate-traces": False}
        )

    @patch("sentry.workflow_engine.tasks.delayed_workflows.process_delayed_workflows.apply_async")
    def test_basic(self, mock_apply_delayed: MagicMock) -> None:
        self.push_to_hash(self.project.id, self.rule.id, self.group.id)
        self.push_to_hash(self.project.id, self.rule.id, self.group_two.id)
        self.push_to_hash(self.project.id, self.rule.id, self.group_three.id)

        buffer = get_backend()
        process_in_batches(buffer, self.project.id)
        mock_apply_delayed.assert_called_once_with(
            kwargs={"project_id": self.project.id}, headers={"sentry-propagate-traces": False}
        )

    @override_options({"delayed_processing.batch_size": 2})
    @patch("sentry.workflow_engine.tasks.delayed_workflows.process_delayed_workflows.apply_async")
    def test_batch(self, mock_apply_delayed: MagicMock) -> None:
        self.push_to_hash(self.project.id, self.rule.id, self.group.id)
        self.push_to_hash(self.project.id, self.rule.id, self.group_two.id)
        self.push_to_hash(self.project.id, self.rule.id, self.group_three.id)

        buffer = get_backend()
        process_in_batches(buffer, self.project.id)
        assert mock_apply_delayed.call_count == 2

        # Validate the batches are created correctly
        batch_one_key = mock_apply_delayed.call_args_list[0][1]["kwargs"]["batch_key"]
        processing_info = DelayedWorkflow(self.project.id)
        hash_args = processing_info.hash_args

        batch_one = buffer.get_hash(
            model=hash_args.model, field={"project_id": self.project.id, "batch_key": batch_one_key}
        )
        batch_two_key = mock_apply_delayed.call_args_list[1][1]["kwargs"]["batch_key"]
        batch_two = buffer.get_hash(
            model=hash_args.model, field={"project_id": self.project.id, "batch_key": batch_two_key}
        )

        assert len(batch_one) == 2
        assert len(batch_two) == 1

        # Validate that we've cleared the original data to reduce storage usage
        original_data = buffer.get_hash(
            model=hash_args.model, field={"project_id": self.project.id}
        )
        assert not original_data


class FetchGroupToEventDataTest(CreateEventTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project()
        self.group = self.create_group(self.project)
        self.rule = self.create_alert_rule()

    def test_fetch_group_to_event_data_basic(self) -> None:
        self.push_to_hash(self.project.id, self.rule.id, self.group.id, "event-123")

        buffer = get_backend()
        processing_info = DelayedWorkflow(self.project.id)
        hash_args = processing_info.hash_args

        result = fetch_group_to_event_data(buffer, self.project.id, hash_args.model)

        assert f"{self.rule.id}:{self.group.id}" in result
        data = json.loads(result[f"{self.rule.id}:{self.group.id}"])
        assert data["event_id"] == "event-123"

    def test_fetch_group_to_event_data_with_batch_key(self) -> None:
        batch_key = str(uuid4())
        self.push_to_hash(self.project.id, self.rule.id, self.group.id, "event-456")

        # Move data to batch
        buffer = get_backend()
        processing_info = DelayedWorkflow(self.project.id)
        hash_args = processing_info.hash_args

        original_data = buffer.get_hash(
            model=hash_args.model, field={"project_id": self.project.id}
        )
        buffer.push_to_hash_bulk(
            model=hash_args.model,
            filters={"project_id": self.project.id, "batch_key": batch_key},
            data=original_data,
        )

        result = fetch_group_to_event_data(
            buffer, self.project.id, hash_args.model, batch_key=batch_key
        )

        assert f"{self.rule.id}:{self.group.id}" in result
        data = json.loads(result[f"{self.rule.id}:{self.group.id}"])
        assert data["event_id"] == "event-456"
