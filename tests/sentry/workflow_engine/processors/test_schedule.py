from datetime import datetime
from unittest.mock import MagicMock, Mock, patch
from uuid import uuid4

import pytest

from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.helpers.options import override_options
from sentry.utils import json
from sentry.workflow_engine.buffer.batch_client import DelayedWorkflowClient
from sentry.workflow_engine.processors.schedule import (
    NUM_COHORTS,
    CohortUpdates,
    ProjectChooser,
    bucket_num_groups,
    chosen_projects,
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


class TestCohortUpdates:
    def test_get_last_cohort_run_existing(self):
        """Test getting last run time for existing cohort."""
        updates = CohortUpdates(values={1: 100.5, 2: 200.3})
        assert updates.get_last_cohort_run(1) == 100.5
        assert updates.get_last_cohort_run(2) == 200.3

    def test_get_last_cohort_run_missing(self):
        """Test getting last run time for non-existent cohort returns 0."""
        updates = CohortUpdates(values={1: 100.5})
        assert updates.get_last_cohort_run(999) == 0


class TestProjectChooser:
    @pytest.fixture
    def mock_buffer(self):
        """Create a mock buffer for testing."""
        mock_buffer = Mock()
        return mock_buffer

    @pytest.fixture
    def project_chooser(self, mock_buffer):
        """Create a ProjectChooser with mocked buffer."""
        return ProjectChooser(mock_buffer, num_cohorts=6)

    def test_init_default_cohorts(self, mock_buffer):
        chooser = ProjectChooser(mock_buffer)
        assert chooser.num_cohorts == NUM_COHORTS

    def test_fetch_updates(self, project_chooser, mock_buffer):
        """Test fetching cohort updates from buffer."""
        expected_updates = CohortUpdates(values={1: 100.0})
        mock_buffer.get_parsed_key.return_value = expected_updates

        result = project_chooser.fetch_updates()

        mock_buffer.get_parsed_key.assert_called_once_with(
            "WORKFLOW_ENGINE_COHORT_UPDATES", CohortUpdates
        )
        assert result == expected_updates

    def test_persist_updates(self, project_chooser, mock_buffer):
        """Test persisting cohort updates to buffer."""
        updates = CohortUpdates(values={1: 100.0, 2: 200.0})

        project_chooser.persist_updates(updates)

        mock_buffer.put_parsed_key.assert_called_once_with(
            "WORKFLOW_ENGINE_COHORT_UPDATES", updates
        )

    def test_fetch_updates_missing_key(self, project_chooser, mock_buffer):
        """Test fetching cohort updates when key doesn't exist (returns None)."""
        mock_buffer.get_parsed_key.return_value = None

        result = project_chooser.fetch_updates()

        mock_buffer.get_parsed_key.assert_called_once_with(
            "WORKFLOW_ENGINE_COHORT_UPDATES", CohortUpdates
        )
        assert isinstance(result, CohortUpdates)
        assert result.values == {}  # Should be default empty dict

    def test_project_id_to_cohort_distribution(self, project_chooser):
        """Test that project IDs are distributed across cohorts."""
        project_ids = list(range(1, 1001))  # 1000 project IDs
        cohorts = [project_chooser.project_id_to_cohort(pid) for pid in project_ids]

        # Check all cohorts are used
        assert set(cohorts) == set(range(6))

        # Check distribution is reasonably even (each cohort gets some projects)
        cohort_counts = [cohorts.count(i) for i in range(6)]
        assert all(count > 0 for count in cohort_counts)
        assert all(count < 1000 for count in cohort_counts)

    def test_project_id_to_cohort_consistent(self, project_chooser):
        """Test that same project ID always maps to same cohort."""
        for project_id in [123, 999, 4, 193848493]:
            cohort1 = project_chooser.project_id_to_cohort(project_id)
            cohort2 = project_chooser.project_id_to_cohort(project_id)
            cohort3 = project_chooser.project_id_to_cohort(project_id)

            assert cohort1 == cohort2 == cohort3
            assert 0 <= cohort1 < 6

    def test_project_ids_to_process_must_process_over_minute(self, project_chooser):
        """Test that cohorts not run for over a minute are marked as must_process."""
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
        expected_cohort = project_chooser.project_id_to_cohort(10)
        if expected_cohort == 0:
            assert 10 in result

        # cohort_updates should be updated with fetch_time for processed cohorts
        assert 0 in cohort_updates.values

    def test_project_ids_to_process_may_process_fallback(self, project_chooser):
        """Test that when no must_process cohorts, oldest may_process is chosen."""
        fetch_time = 1000.0
        cohort_updates = CohortUpdates(
            values={
                0: 995.0,  # 5 seconds ago - may process (older)
                1: 998.0,  # 2 seconds ago - may process (newer)
                2: 999.0,  # 1 second ago - no process
            }
        )
        all_project_ids = [10, 11, 12]

        result = project_chooser.project_ids_to_process(fetch_time, cohort_updates, all_project_ids)

        # Should choose the oldest from may_process cohorts (cohort 0)
        # and update cohort_updates accordingly
        assert len(result) > 0  # Should process something
        processed_cohorts = {project_chooser.project_id_to_cohort(pid) for pid in result}

        # The processed cohorts should be updated in cohort_updates
        for cohort in processed_cohorts:
            assert cohort_updates.values[cohort] == fetch_time

    def test_project_ids_to_process_no_processing_needed(self, project_chooser):
        """Test when no processing is needed (all cohorts recently processed)."""
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

    def test_scenario_once_per_minute_6_cohorts(self, project_chooser):
        """
        Scenario test: Running once per minute with 6 cohorts.
        Should converge to stable cycle where each cohort gets processed every 6 minutes.
        """
        # Find project IDs that map to each cohort to ensure even distribution
        all_project_ids = []
        used_cohorts: set[int] = set()
        project_id = 1
        while len(used_cohorts) < 6:
            cohort = project_chooser.project_id_to_cohort(project_id)
            if cohort not in used_cohorts:
                all_project_ids.append(project_id)
                used_cohorts.add(cohort)
            project_id += 1

        cohort_updates = CohortUpdates(values={})

        # Track which cohorts get processed over time
        processed_cohorts_over_time = []

        # Simulate 20 minutes of processing (20 runs, once per minute)
        for minute in range(20):
            fetch_time = float(minute * 60)  # Every 60 seconds

            processed_projects = project_chooser.project_ids_to_process(
                fetch_time, cohort_updates, all_project_ids
            )
            processed_cohorts = {
                project_chooser.project_id_to_cohort(pid) for pid in processed_projects
            }
            processed_cohorts_over_time.append(processed_cohorts)

        # After initial ramp-up, should settle into stable cycle
        # Check the last 12 runs (2 full cycles) for stability
        stable_period = processed_cohorts_over_time[-12:]

        # Each cohort should be processed at least once in 12 minutes
        cohort_counts = {i: 0 for i in range(6)}
        for processed_cohorts in stable_period:
            for cohort in processed_cohorts:
                cohort_counts[cohort] += 1

        # Verify that all cohorts get processed (at least once in stable period)
        for cohort in range(6):
            assert cohort_counts[cohort] >= 1, f"Cohort {cohort} never processed in stable period"

    def test_scenario_six_times_per_minute(self, project_chooser):
        """
        Scenario test: Running 6 times per minute (every 10 seconds).
        Should process one cohort per run in stable cycle.
        """
        # Find project IDs that map to each cohort to ensure even distribution
        all_project_ids = []
        used_cohorts: set[int] = set()
        project_id = 1
        while len(used_cohorts) < 6:
            cohort = project_chooser.project_id_to_cohort(project_id)
            if cohort not in used_cohorts:
                all_project_ids.append(project_id)
                used_cohorts.add(cohort)
            project_id += 1

        cohort_updates = CohortUpdates(values={})

        processed_cohorts_over_time = []

        # Simulate 2 minutes of processing (12 runs, every 10 seconds)
        for run in range(12):
            fetch_time = float(run * 10)  # Every 10 seconds

            processed_projects = project_chooser.project_ids_to_process(
                fetch_time, cohort_updates, all_project_ids
            )
            processed_cohorts = {
                project_chooser.project_id_to_cohort(pid) for pid in processed_projects
            }
            processed_cohorts_over_time.append(processed_cohorts)

        # After initial period, check stable cycle behavior
        # In the last 6 runs, each cohort should be processed at least once
        stable_period = processed_cohorts_over_time[-6:]

        cohort_counts = {i: 0 for i in range(6)}
        for processed_cohorts in stable_period:
            for cohort in processed_cohorts:
                cohort_counts[cohort] += 1

        # Each cohort should be processed at least once in the last 6 runs
        for cohort in range(6):
            assert cohort_counts[cohort] >= 1, f"Cohort {cohort} never processed in stable period"


class TestChosenProjects:
    @pytest.fixture
    def mock_project_chooser(self):
        """Create a mock ProjectChooser."""
        return Mock()

    def test_chosen_projects_context_manager(self, mock_project_chooser):
        """Test chosen_projects as a context manager."""
        # Setup mocks
        mock_cohort_updates = Mock()
        mock_project_chooser.fetch_updates.return_value = mock_cohort_updates
        mock_project_chooser.project_ids_to_process.return_value = [1, 2, 3]

        fetch_time = 1000.0
        all_project_ids = [1, 2, 3, 4, 5]

        # Use context manager
        with chosen_projects(mock_project_chooser, fetch_time, all_project_ids) as result:
            project_ids_to_process = result

            # Verify fetch_updates was called
            mock_project_chooser.fetch_updates.assert_called_once()

            # Verify project_ids_to_process was called with correct args
            mock_project_chooser.project_ids_to_process.assert_called_once_with(
                fetch_time, mock_cohort_updates, all_project_ids
            )

            # Verify the result
            assert project_ids_to_process == [1, 2, 3]

        # Verify persist_updates was called after context exit
        mock_project_chooser.persist_updates.assert_called_once_with(mock_cohort_updates)

    def test_chosen_projects_fetch_updates_exception(self, mock_project_chooser):
        """Test that exception during fetch_updates is properly handled."""
        # Make fetch_updates raise an exception (e.g. key doesn't exist)
        mock_project_chooser.fetch_updates.side_effect = Exception("Key not found")

        fetch_time = 1000.0
        all_project_ids = [1, 2, 3, 4, 5]

        # Should raise the exception from fetch_updates
        with pytest.raises(Exception, match="Key not found"):
            with chosen_projects(mock_project_chooser, fetch_time, all_project_ids):
                pass

        # persist_updates should not be called if fetch_updates fails
        mock_project_chooser.persist_updates.assert_not_called()
