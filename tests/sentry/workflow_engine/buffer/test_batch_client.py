from unittest.mock import Mock

import pytest

from sentry.workflow_engine.buffer.batch_client import (
    CohortUpdates,
    DelayedWorkflowClient,
    ProjectDelayedWorkflowClient,
)
from sentry.workflow_engine.buffer.redis_hash_sorted_set_buffer import RedisHashSortedSetBuffer


class TestDelayedWorkflowClient:
    @pytest.fixture
    def mock_buffer(self) -> Mock:
        """Create a mock buffer for testing."""
        return Mock(spec=RedisHashSortedSetBuffer)

    @pytest.fixture
    def buffer_keys(self) -> list[str]:
        """Create test buffer keys."""
        return ["test_key_1", "test_key_2"]

    @pytest.fixture
    def delayed_workflow_client(self, mock_buffer: Mock) -> DelayedWorkflowClient:
        """Create a DelayedWorkflowClient with mocked buffer."""
        return DelayedWorkflowClient(buf=mock_buffer)

    @pytest.fixture
    def workflow_client_with_keys(
        self, mock_buffer: Mock, buffer_keys: list[str]
    ) -> DelayedWorkflowClient:
        """Create a DelayedWorkflowClient with mocked buffer and specific keys."""
        return DelayedWorkflowClient(buf=mock_buffer, buffer_keys=buffer_keys)

    def test_mark_project_ids_as_processed(
        self,
        workflow_client_with_keys: DelayedWorkflowClient,
        mock_buffer: Mock,
        buffer_keys: list[str],
    ) -> None:
        """Test mark_project_ids_as_processed with mocked RedisHashSortedSetBuffer."""
        # Mock the conditional_delete_from_sorted_sets return value
        # Return value is dict[str, list[int]] where keys are buffer keys and values are deleted project IDs
        mock_return_value = {
            "test_key_1": [123, 456],
            "test_key_2": [789],
        }
        mock_buffer.conditional_delete_from_sorted_sets.return_value = mock_return_value

        # Input data: project_id -> max_timestamp mapping
        project_id_max_timestamps = {
            123: 1000.5,
            456: 2000.0,
            789: 1500.75,
        }

        # Call the method
        result = workflow_client_with_keys.mark_project_ids_as_processed(project_id_max_timestamps)

        # Verify the mock was called with the correct arguments
        mock_buffer.conditional_delete_from_sorted_sets.assert_called_once_with(
            tuple(buffer_keys),  # DelayedWorkflowClient stores keys as tuple
            [(123, 1000.5), (456, 2000.0), (789, 1500.75)],
        )

        # Verify the result is the union of all deleted project IDs
        expected_result = [123, 456, 789]
        assert sorted(result) == sorted(expected_result)

    def test_mark_project_ids_as_processed_empty_input(
        self,
        workflow_client_with_keys: DelayedWorkflowClient,
        mock_buffer: Mock,
        buffer_keys: list[str],
    ) -> None:
        """Test mark_project_ids_as_processed with empty input."""
        # Mock return value for empty input
        mock_buffer.conditional_delete_from_sorted_sets.return_value = {
            "test_key_1": [],
            "test_key_2": [],
        }

        # Empty input
        project_id_max_timestamps: dict[int, float] = {}

        # Call the method
        result = workflow_client_with_keys.mark_project_ids_as_processed(project_id_max_timestamps)

        # Verify the mock was called with empty member list
        mock_buffer.conditional_delete_from_sorted_sets.assert_called_once_with(
            tuple(buffer_keys),
            [],
        )

        # Result should be empty
        assert result == []

    def test_mark_project_ids_as_processed_partial_deletion(
        self,
        workflow_client_with_keys: DelayedWorkflowClient,
        mock_buffer: Mock,
        buffer_keys: list[str],
    ) -> None:
        """Test mark_project_ids_as_processed when only some project IDs are deleted."""
        # Mock return value where only some project IDs are actually deleted
        mock_return_value = {
            "test_key_1": [123],  # Only project 123 was deleted from this key
            "test_key_2": [],  # No projects deleted from this key
        }
        mock_buffer.conditional_delete_from_sorted_sets.return_value = mock_return_value

        # Input with multiple project IDs
        project_id_max_timestamps = {
            123: 1000.5,
            456: 2000.0,  # This one won't be deleted (perhaps timestamp is too old)
        }

        # Call the method
        result = workflow_client_with_keys.mark_project_ids_as_processed(project_id_max_timestamps)

        # Verify the mock was called with all input project IDs
        mock_buffer.conditional_delete_from_sorted_sets.assert_called_once_with(
            tuple(buffer_keys),
            [(123, 1000.5), (456, 2000.0)],
        )

        # Result should only contain the actually deleted project IDs
        assert result == [123]

    def test_mark_project_ids_as_processed_deduplicates_results(
        self,
        workflow_client_with_keys: DelayedWorkflowClient,
        mock_buffer: Mock,
        buffer_keys: list[str],
    ) -> None:
        """Test that mark_project_ids_as_processed deduplicates project IDs from multiple keys."""
        # Mock return value where the same project ID appears in multiple keys
        mock_return_value = {
            "test_key_1": [123, 456],
            "test_key_2": [456, 789],  # 456 appears in both keys
        }
        mock_buffer.conditional_delete_from_sorted_sets.return_value = mock_return_value

        # Input data
        project_id_max_timestamps = {
            123: 1000.5,
            456: 2000.0,
            789: 1500.75,
        }

        # Call the method
        result = workflow_client_with_keys.mark_project_ids_as_processed(project_id_max_timestamps)

        # Verify the result deduplicates project ID 456
        expected_result = [123, 456, 789]
        assert sorted(result) == sorted(expected_result)
        assert len(result) == 3  # Should have exactly 3 unique project IDs

    def test_fetch_updates(
        self, delayed_workflow_client: DelayedWorkflowClient, mock_buffer: Mock
    ) -> None:
        """Test fetching cohort updates from buffer."""
        expected_updates = CohortUpdates(values={1: 100.0})
        mock_buffer.get_parsed_key.return_value = expected_updates

        result = delayed_workflow_client.fetch_updates()

        mock_buffer.get_parsed_key.assert_called_once_with(
            "WORKFLOW_ENGINE_COHORT_UPDATES", CohortUpdates
        )
        assert result == expected_updates

    def test_persist_updates(
        self, delayed_workflow_client: DelayedWorkflowClient, mock_buffer: Mock
    ) -> None:
        """Test persisting cohort updates to buffer."""
        updates = CohortUpdates(values={1: 100.0, 2: 200.0})

        delayed_workflow_client.persist_updates(updates)

        mock_buffer.put_parsed_key.assert_called_once_with(
            "WORKFLOW_ENGINE_COHORT_UPDATES", updates
        )

    def test_fetch_updates_missing_key(
        self, delayed_workflow_client: DelayedWorkflowClient, mock_buffer: Mock
    ) -> None:
        """Test fetching cohort updates when key doesn't exist (returns None)."""
        mock_buffer.get_parsed_key.return_value = None

        result = delayed_workflow_client.fetch_updates()

        mock_buffer.get_parsed_key.assert_called_once_with(
            "WORKFLOW_ENGINE_COHORT_UPDATES", CohortUpdates
        )
        assert isinstance(result, CohortUpdates)
        assert result.values == {}  # Should be default empty dict

    def test_add_project_ids(
        self, delayed_workflow_client: DelayedWorkflowClient, mock_buffer: Mock
    ) -> None:
        """Test adding project IDs to a random shard."""
        project_ids = [1, 2, 3]

        delayed_workflow_client.add_project_ids(project_ids)

        # Should call push_to_sorted_set with one of the buffer keys
        assert mock_buffer.push_to_sorted_set.call_count == 1
        call_args = mock_buffer.push_to_sorted_set.call_args
        assert call_args[1]["value"] == project_ids
        # Key should be one of the expected buffer keys
        called_key = call_args[1]["key"]
        expected_keys = DelayedWorkflowClient._get_buffer_keys()
        assert called_key in expected_keys

    def test_get_project_ids(
        self, delayed_workflow_client: DelayedWorkflowClient, mock_buffer: Mock
    ) -> None:
        """Test getting project IDs within score range."""
        expected_result = {1: [100.0], 2: [200.0]}
        mock_buffer.bulk_get_sorted_set.return_value = expected_result

        result = delayed_workflow_client.get_project_ids(min=0.0, max=300.0)

        mock_buffer.bulk_get_sorted_set.assert_called_once_with(
            tuple(DelayedWorkflowClient._get_buffer_keys()),
            min=0.0,
            max=300.0,
        )
        assert result == expected_result

    def test_clear_project_ids(
        self, delayed_workflow_client: DelayedWorkflowClient, mock_buffer: Mock
    ) -> None:
        """Test clearing project IDs within score range."""
        delayed_workflow_client.clear_project_ids(min=0.0, max=300.0)

        mock_buffer.delete_keys.assert_called_once_with(
            tuple(DelayedWorkflowClient._get_buffer_keys()),
            min=0.0,
            max=300.0,
        )

    def test_get_buffer_keys(self) -> None:
        """Test that buffer keys are generated correctly."""
        keys = DelayedWorkflowClient._get_buffer_keys()

        assert len(keys) == 8  # _BUFFER_SHARDS
        assert keys[0] == "workflow_engine_delayed_processing_buffer"  # shard 0
        assert keys[1] == "workflow_engine_delayed_processing_buffer:1"  # shard 1
        assert keys[7] == "workflow_engine_delayed_processing_buffer:7"  # shard 7

    def test_for_project(
        self, delayed_workflow_client: DelayedWorkflowClient, mock_buffer: Mock
    ) -> None:
        """Test creating a project-specific client."""
        project_id = 123

        project_client = delayed_workflow_client.for_project(project_id)

        assert project_client.project_id == project_id
        assert project_client._buffer == mock_buffer


class TestProjectDelayedWorkflowClient:
    @pytest.fixture
    def mock_buffer(self) -> Mock:
        """Create a mock buffer for testing."""
        return Mock(spec=RedisHashSortedSetBuffer)

    @pytest.fixture
    def project_client(self, mock_buffer: Mock) -> ProjectDelayedWorkflowClient:
        """Create a ProjectDelayedWorkflowClient with mocked buffer."""
        return DelayedWorkflowClient(buf=mock_buffer).for_project(123)

    def test_filters_without_batch_key(self, project_client: ProjectDelayedWorkflowClient) -> None:
        """Test filters generation without batch key."""
        filters = project_client._filters(batch_key=None)
        assert filters == {"project_id": 123}

    def test_filters_with_batch_key(self, project_client: ProjectDelayedWorkflowClient) -> None:
        """Test filters generation with batch key."""
        filters = project_client._filters(batch_key="test-batch")
        assert filters == {"project_id": 123, "batch_key": "test-batch"}

    def test_delete_hash_fields(
        self, project_client: ProjectDelayedWorkflowClient, mock_buffer: Mock
    ) -> None:
        """Test deleting specific fields from workflow hash."""
        fields = ["field1", "field2"]

        project_client.delete_hash_fields(batch_key=None, fields=fields)

        from sentry.workflow_engine.models import Workflow

        mock_buffer.delete_hash.assert_called_once_with(
            model=Workflow, filters={"project_id": 123}, fields=fields
        )

    def test_get_hash_length(
        self, project_client: ProjectDelayedWorkflowClient, mock_buffer: Mock
    ) -> None:
        """Test getting hash length."""
        mock_buffer.get_hash_length.return_value = 5

        result = project_client.get_hash_length(batch_key=None)

        from sentry.workflow_engine.models import Workflow

        mock_buffer.get_hash_length.assert_called_once_with(
            model=Workflow, filters={"project_id": 123}
        )
        assert result == 5

    def test_get_hash_data(
        self, project_client: ProjectDelayedWorkflowClient, mock_buffer: Mock
    ) -> None:
        """Test fetching hash data."""
        expected_data = {"key1": "value1", "key2": "value2"}
        mock_buffer.get_hash.return_value = expected_data

        result = project_client.get_hash_data(batch_key="test-batch")

        from sentry.workflow_engine.models import Workflow

        mock_buffer.get_hash.assert_called_once_with(
            model=Workflow, filters={"project_id": 123, "batch_key": "test-batch"}
        )
        assert result == expected_data

    def test_push_to_hash(
        self, project_client: ProjectDelayedWorkflowClient, mock_buffer: Mock
    ) -> None:
        """Test pushing data to hash in bulk."""
        data = {"key1": "value1", "key2": "value2"}

        project_client.push_to_hash(batch_key="test-batch", data=data)

        from sentry.workflow_engine.models import Workflow

        mock_buffer.push_to_hash_bulk.assert_called_once_with(
            model=Workflow, filters={"project_id": 123, "batch_key": "test-batch"}, data=data
        )
