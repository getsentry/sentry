from unittest.mock import Mock

from sentry.testutils.cases import TestCase
from sentry.workflow_engine.buffer.batch_client import DelayedWorkflowClient


class TestDelayedWorkflowClient(TestCase):
    def setUp(self) -> None:
        self.mock_buffer = Mock()
        self.buffer_keys = ["test_key_1", "test_key_2"]
        self.workflow_client = DelayedWorkflowClient(
            buf=self.mock_buffer, buffer_keys=self.buffer_keys
        )

    def test_mark_project_ids_as_processed(self) -> None:
        """Test mark_project_ids_as_processed with mocked RedisHashSortedSetBuffer."""
        # Mock the conditional_delete_from_sorted_sets return value
        # Return value is dict[str, list[int]] where keys are buffer keys and values are deleted project IDs
        mock_return_value = {
            "test_key_1": [123, 456],
            "test_key_2": [789],
        }
        self.mock_buffer.conditional_delete_from_sorted_sets.return_value = mock_return_value

        # Input data: project_id -> max_timestamp mapping
        project_id_max_timestamps = {
            123: 1000.5,
            456: 2000.0,
            789: 1500.75,
        }

        # Call the method
        result = self.workflow_client.mark_project_ids_as_processed(project_id_max_timestamps)

        # Verify the mock was called with the correct arguments
        self.mock_buffer.conditional_delete_from_sorted_sets.assert_called_once_with(
            tuple(self.buffer_keys),  # DelayedWorkflowClient stores keys as tuple
            [(123, 1000.5), (456, 2000.0), (789, 1500.75)],
        )

        # Verify the result is the union of all deleted project IDs
        expected_result = [123, 456, 789]
        assert sorted(result) == sorted(expected_result)

    def test_mark_project_ids_as_processed_empty_input(self) -> None:
        """Test mark_project_ids_as_processed with empty input."""
        # Mock return value for empty input
        self.mock_buffer.conditional_delete_from_sorted_sets.return_value = {
            "test_key_1": [],
            "test_key_2": [],
        }

        # Empty input
        project_id_max_timestamps: dict[int, float] = {}

        # Call the method
        result = self.workflow_client.mark_project_ids_as_processed(project_id_max_timestamps)

        # Verify the mock was called with empty member list
        self.mock_buffer.conditional_delete_from_sorted_sets.assert_called_once_with(
            tuple(self.buffer_keys),
            [],
        )

        # Result should be empty
        assert result == []

    def test_mark_project_ids_as_processed_partial_deletion(self) -> None:
        """Test mark_project_ids_as_processed when only some project IDs are deleted."""
        # Mock return value where only some project IDs are actually deleted
        mock_return_value = {
            "test_key_1": [123],  # Only project 123 was deleted from this key
            "test_key_2": [],  # No projects deleted from this key
        }
        self.mock_buffer.conditional_delete_from_sorted_sets.return_value = mock_return_value

        # Input with multiple project IDs
        project_id_max_timestamps = {
            123: 1000.5,
            456: 2000.0,  # This one won't be deleted (perhaps timestamp is too old)
        }

        # Call the method
        result = self.workflow_client.mark_project_ids_as_processed(project_id_max_timestamps)

        # Verify the mock was called with all input project IDs
        self.mock_buffer.conditional_delete_from_sorted_sets.assert_called_once_with(
            tuple(self.buffer_keys),
            [(123, 1000.5), (456, 2000.0)],
        )

        # Result should only contain the actually deleted project IDs
        assert result == [123]

    def test_mark_project_ids_as_processed_deduplicates_results(self) -> None:
        """Test that mark_project_ids_as_processed deduplicates project IDs from multiple keys."""
        # Mock return value where the same project ID appears in multiple keys
        mock_return_value = {
            "test_key_1": [123, 456],
            "test_key_2": [456, 789],  # 456 appears in both keys
        }
        self.mock_buffer.conditional_delete_from_sorted_sets.return_value = mock_return_value

        # Input data
        project_id_max_timestamps = {
            123: 1000.5,
            456: 2000.0,
            789: 1500.75,
        }

        # Call the method
        result = self.workflow_client.mark_project_ids_as_processed(project_id_max_timestamps)

        # Verify the result deduplicates project ID 456
        expected_result = [123, 456, 789]
        assert sorted(result) == sorted(expected_result)
        assert len(result) == 3  # Should have exactly 3 unique project IDs
