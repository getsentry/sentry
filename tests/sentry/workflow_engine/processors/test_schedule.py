import random
from datetime import datetime, timedelta
from unittest.mock import MagicMock, Mock, patch
from uuid import uuid4

import pytest

from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.helpers.options import override_options
from sentry.utils import json
from sentry.workflow_engine.buffer.batch_client import CohortUpdates, DelayedWorkflowClient
from sentry.workflow_engine.buffer.redis_hash_sorted_set_buffer import RedisHashSortedSetBuffer
from sentry.workflow_engine.processors.schedule import (
    ProjectChooser,
    bucket_num_groups,
    chosen_projects,
    mark_projects_processed,
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

    def push_to_hash(
        self,
        project_id: int,
        rule_id: str | int,
        group_id: str | int,
        event_id: str | int | None = None,
        occurrence_id: str | int | None = None,
    ) -> None:
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
    def test_fetches_from_buffer_and_executes(self, mock_process_in_batches: MagicMock) -> None:
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
    def test_skips_processing_with_option(self, mock_process_in_batches: MagicMock) -> None:
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


def run_to_timestamp(run: int, interval_sec: int, jitter: bool = True) -> float:
    """
    Helper to provide timestamps for 'run every X seconds' scenarios.
    If jitter_sec is provided, it will add a random jitter to the timestamp.
    """
    value = float(run * interval_sec)
    if jitter:
        # +/- 2 seconds; not unreasonable for our scheduling crons.
        value += random.choice((0, 2, -2))
    return value


class TestProjectChooser:
    @pytest.fixture
    def mock_buffer(self) -> Mock:
        mock_buffer = Mock(spec=DelayedWorkflowClient)
        return mock_buffer

    @pytest.fixture
    def project_chooser(self, mock_buffer: Mock) -> ProjectChooser:
        return ProjectChooser(mock_buffer, num_cohorts=6, min_scheduling_age=timedelta(seconds=50))

    def _find_projects_for_cohorts(self, chooser: ProjectChooser, num_cohorts: int) -> list[int]:
        """Helper method to find project IDs that map to each cohort to ensure even distribution."""
        all_project_ids = []
        used_cohorts: set[int] = set()
        project_id = 1
        while len(used_cohorts) < num_cohorts:
            cohort = chooser._project_id_to_cohort(project_id)
            if cohort not in used_cohorts:
                all_project_ids.append(project_id)
                used_cohorts.add(cohort)
            project_id += 1
        return all_project_ids

    def test_project_id_to_cohort_distribution(self, project_chooser: ProjectChooser) -> None:
        project_ids = list(range(1, 1001))  # 1000 project IDs
        cohorts = [project_chooser._project_id_to_cohort(pid) for pid in project_ids]

        # Check all cohorts are used
        assert set(cohorts) == set(range(6))

        # Check distribution is reasonably even (each cohort gets some projects)
        cohort_counts = [cohorts.count(i) for i in range(6)]
        assert all(count > 0 for count in cohort_counts)
        assert all(count < 1000 for count in cohort_counts)

    def test_project_id_to_cohort_consistent(self, project_chooser: ProjectChooser) -> None:
        for project_id in [123, 999, 4, 193848493]:
            cohort1 = project_chooser._project_id_to_cohort(project_id)
            cohort2 = project_chooser._project_id_to_cohort(project_id)
            cohort3 = project_chooser._project_id_to_cohort(project_id)

            assert cohort1 == cohort2 == cohort3
            assert 0 <= cohort1 < 6

    def test_project_ids_to_process_must_process_over_minute(
        self, project_chooser: ProjectChooser
    ) -> None:
        fetch_time = 1000.0
        cohort_updates = CohortUpdates(
            values={
                0: 900.0,  # 100 seconds ago - must process
                1: 950.0,  # 50 seconds ago - may process
                2: 990.0,  # 10 seconds ago - no process
            }
        )
        all_project_ids = [10, 11, 12, 13, 14, 15]  # Projects mapping to cohorts 0-5

        result = project_chooser.project_ids_to_process(fetch_time, cohort_updates, all_project_ids)

        # Should include projects from cohort 0 (over 1 minute old)
        expected_cohort = project_chooser._project_id_to_cohort(10)
        if expected_cohort == 0:
            assert 10 in result

        # cohort_updates should be updated with fetch_time for processed cohorts
        assert 0 in cohort_updates.values

    def test_project_ids_to_process_may_process_fallback(
        self, project_chooser: ProjectChooser
    ) -> None:
        fetch_time = 1000.0
        cohort_updates = CohortUpdates(
            values={
                0: 945.0,  # 55 seconds ago - may process (older)
                1: 948.0,  # 52 seconds ago - may process (newer)
                2: 999.0,  # 1 second ago - no process
            }
        )
        all_project_ids = [10, 11, 12]

        result = project_chooser.project_ids_to_process(fetch_time, cohort_updates, all_project_ids)

        # Should choose the oldest from may_process cohorts (cohort 0)
        # and update cohort_updates accordingly
        assert len(result) > 0  # Should process something
        processed_cohorts = {project_chooser._project_id_to_cohort(pid) for pid in result}

        # The processed cohorts should be updated in cohort_updates
        for cohort in processed_cohorts:
            assert cohort_updates.values[cohort] == fetch_time

    def test_project_ids_to_process_no_processing_needed(
        self, project_chooser: ProjectChooser
    ) -> None:
        fetch_time = 1000.0
        cohort_updates = CohortUpdates(
            values={
                0: 999.0,  # 1 second ago
                1: 998.0,  # 2 seconds ago
                2: 997.0,  # 3 seconds ago
                3: 996.0,  # 4 seconds ago
                4: 995.0,  # 5 seconds ago
                5: 994.0,  # 6 seconds ago
            }
        )
        all_project_ids = [10, 11, 12, 13, 14, 15]

        result = project_chooser.project_ids_to_process(fetch_time, cohort_updates, all_project_ids)

        # No cohorts are old enough for must_process or may_process
        assert len(result) == 0

    def test_scenario_once_per_minute_6_cohorts(self, project_chooser: ProjectChooser) -> None:
        """
        Scenario test: Running once per minute with 6 cohorts.
        Since run interval (60s) equals must_process threshold (60s),
        all cohorts should be processed on every single run.
        """
        all_project_ids = self._find_projects_for_cohorts(project_chooser, 6)

        cohort_updates = CohortUpdates(values={})

        # Simulate 5 minutes of processing (5 runs, once per minute)
        for minute in range(5):
            fetch_time = run_to_timestamp(minute, interval_sec=60, jitter=False)

            processed_projects = project_chooser.project_ids_to_process(
                fetch_time, cohort_updates, all_project_ids
            )
            processed_cohorts = {
                project_chooser._project_id_to_cohort(pid) for pid in processed_projects
            }

            # Every run should process all 6 cohorts.
            assert processed_cohorts == {
                0,
                1,
                2,
                3,
                4,
                5,
            }, f"Run {minute} at {fetch_time} didn't process all cohorts: {processed_cohorts}"

    def test_scenario_six_times_per_minute(self, project_chooser: ProjectChooser) -> None:
        """
        Scenario test: Running 6 times per minute (every 10 seconds).
        Should process exactly one cohort per run in stable cycle, cycling through all.
        """
        all_project_ids = self._find_projects_for_cohorts(project_chooser, 6)

        cohort_updates = CohortUpdates(values={})

        all_cohorts = set(range(6))
        processed_cohorts_over_time = []

        # Simulate 2 minutes of processing (12 runs, every 10 seconds)
        previous_cohorts = []
        for run in range(12):
            fetch_time = run_to_timestamp(run, interval_sec=10, jitter=True)

            processed_projects = project_chooser.project_ids_to_process(
                fetch_time, cohort_updates, all_project_ids
            )
            processed_cohorts = {
                project_chooser._project_id_to_cohort(pid) for pid in processed_projects
            }
            if run == 0:
                assert (
                    processed_cohorts == all_cohorts
                ), f"First run should process all cohorts, got {processed_cohorts}"
            previous_cohorts.append(processed_cohorts)
            if len(previous_cohorts) > 6:
                previous_cohorts.pop(0)
            elif len(previous_cohorts) == 6:
                processed_in_last_cycle = set().union(*previous_cohorts)
                assert (
                    processed_in_last_cycle == all_cohorts
                ), f"Run {run} should process all cohorts, got {processed_in_last_cycle}"
            processed_cohorts_over_time.append(processed_cohorts)

    def test_scenario_once_per_minute_cohort_count_1(self, mock_buffer: Mock) -> None:
        """
        Scenario test: Running once per minute with cohort count of 1 (production default).
        This demonstrates that all projects are processed together every minute.
        """
        # Create ProjectChooser with cohort count = 1 (production default)
        chooser = ProjectChooser(
            mock_buffer, num_cohorts=1, min_scheduling_age=timedelta(seconds=50)
        )
        all_project_ids = self._find_projects_for_cohorts(chooser, 1)

        # Add more projects to demonstrate they all map to cohort 0
        additional_projects = [10, 25, 50, 100, 999, 1001, 5000]
        all_project_ids.extend(additional_projects)

        # Verify all projects map to cohort 0
        for project_id in all_project_ids:
            cohort = chooser._project_id_to_cohort(project_id)
            assert cohort == 0, f"Project {project_id} should map to cohort 0, got {cohort}"

        cohort_updates = CohortUpdates(values={})

        # Simulate 5 minutes of processing (5 runs, once per minute)
        for minute in range(5):
            fetch_time = run_to_timestamp(minute, interval_sec=60, jitter=True)

            processed_projects = chooser.project_ids_to_process(
                fetch_time, cohort_updates, all_project_ids
            )
            processed_cohorts = {chooser._project_id_to_cohort(pid) for pid in processed_projects}

            # With cohort count = 1, should always process cohort 0
            assert processed_cohorts == {
                0
            }, f"Run {minute} should process cohort 0, got {processed_cohorts}"

            # Since all projects are in cohort 0, processing cohort 0 means ALL projects
            assert set(processed_projects) == set(all_project_ids), (
                f"Run {minute}: Expected all {len(all_project_ids)} projects to be processed, "
                f"but got {len(processed_projects)}: {sorted(processed_projects)}"
            )

    def test_cohort_count_change_uses_eldest_freshness(self, mock_buffer: Mock) -> None:
        """
        Test that when num_cohorts changes, all new cohorts use the eldest stored cohort freshness,
        then cohorts that need processing are scheduled and updated to current time.
        """
        # Start with 3 cohorts at different ages
        cohort_updates = CohortUpdates(
            values={
                0: 100.0,  # eldest
                1: 200.0,
                2: 300.0,  # newest
            }
        )

        # Change to 6 cohorts - since all cohorts will be reset to 100.0 (900 seconds old),
        # they will all exceed the target_max_age of 60 seconds and be scheduled to run
        new_chooser = ProjectChooser(
            mock_buffer, num_cohorts=6, min_scheduling_age=timedelta(seconds=50)
        )
        new_chooser.project_ids_to_process(1000.0, cohort_updates, [])

        # All 6 cohorts should exist and be set to current time since they were all very old
        assert len(cohort_updates.values) == 6
        for cohort_id in range(6):
            assert cohort_updates.values[cohort_id] == 1000.0


class TestChosenProjects:
    @pytest.fixture
    def mock_project_chooser(self) -> Mock:
        """Create a mock ProjectChooser."""
        return Mock(spec=ProjectChooser)

    def test_chosen_projects_context_manager(self, mock_project_chooser: Mock) -> None:
        """Test chosen_projects as a context manager."""
        # Setup mocks
        mock_cohort_updates = Mock(spec=CohortUpdates)
        mock_buffer_client = Mock(spec=DelayedWorkflowClient)
        mock_project_chooser.client = mock_buffer_client
        mock_buffer_client.fetch_updates.return_value = mock_cohort_updates

        fetch_time = 1000.0
        all_project_ids = [1, 2, 3, 4, 5]
        expected_result = [1, 2, 3]

        mock_project_chooser.project_ids_to_process.return_value = expected_result

        # Use context manager
        with chosen_projects(mock_project_chooser, fetch_time, all_project_ids) as result:
            project_ids_to_process = result

            # Verify fetch_updates was called on project_chooser.client
            mock_buffer_client.fetch_updates.assert_called_once()

            # Verify project_ids_to_process was called with correct args
            mock_project_chooser.project_ids_to_process.assert_called_once_with(
                fetch_time, mock_cohort_updates, all_project_ids
            )

            # Verify the result
            assert project_ids_to_process == expected_result

        # Verify persist_updates was called after context exit
        mock_buffer_client.persist_updates.assert_called_once_with(mock_cohort_updates)

    def test_chosen_projects_fetch_updates_exception(self, mock_project_chooser: Mock) -> None:
        """Test that exception during fetch_updates is properly handled."""
        # Setup mocks
        mock_buffer_client = Mock(spec=DelayedWorkflowClient)
        mock_project_chooser.client = mock_buffer_client
        # Make fetch_updates raise an exception (e.g. key doesn't exist)
        mock_buffer_client.fetch_updates.side_effect = Exception("Key not found")

        fetch_time = 1000.0
        all_project_ids = [1, 2, 3, 4, 5]

        # Should raise the exception from fetch_updates
        with pytest.raises(Exception, match="Key not found"):
            with chosen_projects(mock_project_chooser, fetch_time, all_project_ids):
                pass

        # persist_updates should not be called if fetch_updates fails
        mock_buffer_client.persist_updates.assert_not_called()

    def test_chosen_projects_exception_during_processing(self, mock_project_chooser: Mock) -> None:
        mock_buffer_client = Mock(spec=DelayedWorkflowClient)
        mock_project_chooser.client = mock_buffer_client
        mock_buffer_client.fetch_updates.return_value = Mock(spec=CohortUpdates)
        mock_project_chooser.project_ids_to_process.return_value = [1, 2, 3]

        with pytest.raises(RuntimeError, match="Processing failed"):
            with chosen_projects(mock_project_chooser, 1000.0, [1, 2, 3, 4, 5]):
                raise RuntimeError("Processing failed")

        mock_buffer_client.persist_updates.assert_not_called()


def test_mark_projects_processed_only_cleans_up_processed_projects() -> None:
    """Test that mark_projects_processed only cleans up processed projects, not all projects."""
    processed_project_id = 5000
    unprocessed_project_id = 5001

    current_time = 1000.0

    def get_fake_time() -> float:
        return current_time

    all_project_ids_and_timestamps = {
        processed_project_id: [1000.0],
        unprocessed_project_id: [2000.0],
    }

    client = DelayedWorkflowClient(RedisHashSortedSetBuffer(now_fn=get_fake_time))

    # Add both projects to buffer
    for project_id, [timestamp] in all_project_ids_and_timestamps.items():
        current_time = timestamp
        client.add_project_ids([project_id])

    # Only mark one project as processed
    mark_projects_processed(
        client,
        [processed_project_id],  # Only this one was processed
        all_project_ids_and_timestamps,
    )

    # The unprocessed project should still be in buffer
    remaining_project_ids = client.get_project_ids(min=0, max=3000.0)
    assert unprocessed_project_id in remaining_project_ids
    assert processed_project_id not in remaining_project_ids
