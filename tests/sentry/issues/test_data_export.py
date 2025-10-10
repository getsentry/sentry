import gzip
from queue import Queue
from unittest.mock import Mock, patch
from uuid import uuid4

import pytest

from sentry.issues.data_export import (
    add_events_to_upload_queue,
    background_uploader,
    export_errors_data,
    export_project_errors_async,
    get_event_batches,
    process_event_batch,
    process_event_batches,
)
from sentry.services import eventstore
from sentry.services.eventstore.models import Event
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils import json


def set_up_gcs_mocks(mock_storage_client):
    mock_blob = Mock()
    mock_bucket = Mock()
    mock_bucket.blob.return_value = mock_blob
    mock_client_instance = Mock()
    mock_client_instance.bucket.return_value = mock_bucket
    mock_storage_client.return_value = mock_client_instance

    return {
        "storage_client": mock_storage_client,
        "client_instance": mock_client_instance,
        "bucket": mock_bucket,
        "blob": mock_blob,
    }


@patch("sentry.issues.data_export.Client")
class BackgroundUploaderTest(TestCase):
    def test_background_uploader_processes_queue(self, mock_storage_client):
        gcs = set_up_gcs_mocks(mock_storage_client)

        upload_queue: Queue[bytes | None] = Queue()
        test_data1 = b"compressed_data_1"
        test_data2 = b"compressed_data_2"
        upload_queue.put(test_data1)
        upload_queue.put(test_data2)
        upload_queue.put(None)  # Stop signal

        background_uploader(upload_queue, "test-bucket", "test-prefix")

        gcs["client_instance"].bucket.assert_called_once_with("test-bucket")

        assert gcs["bucket"].blob.call_count == 2
        gcs["bucket"].blob.assert_any_call("test-prefix/events_000001.jsonl.gz")
        gcs["bucket"].blob.assert_any_call("test-prefix/events_000002.jsonl.gz")

        assert gcs["blob"].upload_from_string.call_count == 2

    def test_background_uploader_stops_on_none(self, mock_storage_client):
        gcs = set_up_gcs_mocks(mock_storage_client)

        upload_queue: Queue[bytes | None] = Queue()
        upload_queue.put(None)  # Immediate stop signal

        background_uploader(upload_queue, "test-bucket", "test-prefix")

        assert gcs["bucket"].blob.call_count == 0


class EventsUploadQueueTest(TestCase):
    def test_add_events_to_upload_queue_with_data(self):
        upload_queue: Queue[bytes | None] = Queue()
        events_data: list[dict] = [
            {"event_id": "a" * 32, "message": "Error 1"},
            {"event_id": "b" * 32, "message": "Error 2"},
        ]

        add_events_to_upload_queue(events_data, upload_queue)
        assert upload_queue.qsize() == 1

        compressed_data = upload_queue.get()
        assert compressed_data is not None
        decompressed = gzip.decompress(compressed_data).decode("utf-8")
        lines = decompressed.strip().split("\n")
        assert len(lines) == 2
        assert json.loads(lines[0]) == {"event_id": "a" * 32, "message": "Error 1"}
        assert json.loads(lines[1]) == {"event_id": "b" * 32, "message": "Error 2"}

    def test_add_events_to_upload_queue_empty_list(self):
        upload_queue: Queue[bytes | None] = Queue()
        events_data: list[dict] = []

        add_events_to_upload_queue(events_data, upload_queue)
        assert upload_queue.qsize() == 0


class ProcessEventBatchTest(TestCase):
    def test_process_event_batch_with_valid_events(self):
        event1 = Mock(spec=Event)
        event1.event_id = "a" * 32
        event1.data = {"event_id": "a" * 32, "message": "Test error 1"}

        event2 = Mock(spec=Event)
        event2.event_id = "b" * 32
        event2.data = {"event_id": "b" * 32, "message": "Test error 2"}

        events = [event1, event2]
        result = process_event_batch(events)  # type: ignore[arg-type]

        assert len(result) == 2
        assert result[0] == {"event_id": "a" * 32, "message": "Test error 1"}
        assert result[1] == {"event_id": "b" * 32, "message": "Test error 2"}

    def test_process_event_batch_with_missing_data(self):
        event1 = Mock(spec=Event)
        event1.event_id = "a" * 32
        event1.data = {"event_id": "a" * 32, "message": "Test error"}

        event2 = Mock(spec=Event)
        event2.event_id = "b" * 32
        event2.data = None

        events = [event1, event2]
        result = process_event_batch(events)  # type: ignore[arg-type]

        assert len(result) == 1
        assert result[0] == {"event_id": "a" * 32, "message": "Test error"}

    def test_process_event_batch_empty_list(self):
        result = process_event_batch([])
        assert result == []


@patch("sentry.issues.data_export.threading.Thread")
class ProcessEventBatchesTest(TestCase):
    def test_process_event_batches_calls_uploader(self, mock_thread):
        mock_thread_instance = Mock()
        mock_thread.return_value = mock_thread_instance

        event1 = Mock(spec=Event)
        event1.event_id = "a" * 32
        event1.data = {"event_id": "a" * 32, "message": "Test"}

        event_batches = iter([[event1]])

        with patch("sentry.issues.data_export.Queue") as mock_queue_class:
            mock_queue = Mock()
            mock_queue_class.return_value = mock_queue

            process_event_batches(event_batches, "test-bucket", "test-prefix")  # type: ignore[arg-type]

            mock_thread_instance.start.assert_called_once()
            mock_queue.put.assert_called()
            mock_thread_instance.join.assert_called_once_with(timeout=300)


@django_db_all
@pytest.mark.snuba
class GetEventBatchesTest(TestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.project = self.create_project()
        self.organization = self.project.organization

    def test_get_event_batches_with_events(self):
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "Test error 1",
                "timestamp": before_now(minutes=1).isoformat(),
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "Test error 2",
                "timestamp": before_now(minutes=2).isoformat(),
            },
            project_id=self.project.id,
        )

        event_filter = eventstore.Filter(
            project_ids=[self.project.id],
            start=None,
            end=None,
        )
        event_batches = list(get_event_batches(self.organization.id, event_filter))

        assert len(event_batches) == 1
        assert len(event_batches[0]) == 2

    def test_get_event_batches_no_events(self):
        event_filter = eventstore.Filter(
            project_ids=[self.project.id],
            start=None,
            end=None,
        )
        event_batches = list(get_event_batches(self.organization.id, event_filter))
        assert len(event_batches) == 0

    @patch("sentry.issues.data_export.BATCH_SIZE", 2)
    def test_get_event_batches_pagination(self):
        for i in range(5):
            self.store_event(
                data={
                    "event_id": uuid4().hex,
                    "message": f"Test error {i}",
                    "timestamp": before_now(minutes=i + 1).isoformat(),
                },
                project_id=self.project.id,
            )

        event_filter = eventstore.Filter(
            project_ids=[self.project.id],
            start=None,
            end=None,
        )
        event_batches = list(get_event_batches(self.organization.id, event_filter))

        assert len(event_batches) == 3
        assert len(event_batches[0]) == 2
        assert len(event_batches[1]) == 2
        assert len(event_batches[2]) == 1


@django_db_all
@pytest.mark.snuba
class ExportProjectErrorsAsyncTest(TestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.project = self.create_project()
        self.organization = self.project.organization

    @patch("sentry.issues.data_export.process_event_batches")
    @patch("sentry.issues.data_export.get_event_batches")
    def test_export_project_errors_async(self, mock_get_batches, mock_process_batches):
        mock_event = Mock(spec=Event)
        mock_event.event_id = "a" * 32
        mock_event.data = {"event_id": "a" * 32}
        mock_get_batches.return_value = iter([[mock_event]])

        export_project_errors_async(
            project_id=self.project.id,
            organization_id=self.organization.id,
            destination_bucket="test-bucket",
            gcs_prefix="test-prefix",
        )

        mock_get_batches.assert_called_once()
        call_args = mock_get_batches.call_args
        assert call_args[0][0] == self.organization.id
        event_filter = call_args[0][1]
        assert event_filter.project_ids == [self.project.id]
        assert event_filter.start is None
        assert event_filter.end is None

        mock_process_batches.assert_called_once()

    @patch("sentry.issues.data_export.process_event_batches")
    def test_export_project_errors_async_with_real_events(self, mock_process_batches):
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "Test error",
                "timestamp": before_now(minutes=1).isoformat(),
            },
            project_id=self.project.id,
        )

        export_project_errors_async(
            project_id=self.project.id,
            organization_id=self.organization.id,
            destination_bucket="test-bucket",
            gcs_prefix="test-prefix",
        )

        mock_process_batches.assert_called_once()
        call_args = mock_process_batches.call_args
        assert call_args[0][1] == "test-bucket"
        assert call_args[0][2] == "test-prefix"


@django_db_all
@pytest.mark.snuba
@patch("sentry.issues.data_export.Client")
class ExportErrorsDataIntegrationTest(TestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.organization = self.create_organization()
        self.project1 = self.create_project(organization=self.organization)
        self.project2 = self.create_project(organization=self.organization)

    def test_export_errors_data_full_flow(self, mock_storage_client):
        gcs = set_up_gcs_mocks(mock_storage_client)

        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "Error from project 1",
                "timestamp": before_now(minutes=1).isoformat(),
            },
            project_id=self.project1.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "Error from project 2",
                "timestamp": before_now(minutes=2).isoformat(),
            },
            project_id=self.project2.id,
        )

        with self.tasks():
            export_errors_data(
                organization_id=self.organization.id,
                destination_bucket="test-bucket",
                gcs_prefix="test-prefix",
            )

        # Each project spawns a task that creates a storage client
        assert gcs["storage_client"].call_count == 2
        assert gcs["client_instance"].bucket.call_count == 2
        # One upload per project (one event each)
        assert gcs["blob"].upload_from_string.call_count == 2
        # Two blob names created (one per upload)
        assert gcs["bucket"].blob.call_count == 2

        blob_calls = gcs["bucket"].blob.call_args_list
        for call in blob_calls:
            blob_name = call[0][0]
            assert blob_name.startswith("test-prefix/events_")
            assert blob_name.endswith(".jsonl.gz")

    @patch("sentry.issues.data_export.BATCH_SIZE", 3)
    def test_export_errors_data_with_multiple_events(self, mock_storage_client):
        gcs = set_up_gcs_mocks(mock_storage_client)

        for i in range(8):
            self.store_event(
                data={
                    "event_id": uuid4().hex,
                    "message": f"Test error {i}",
                    "timestamp": before_now(minutes=i + 1).isoformat(),
                },
                project_id=self.project1.id,
            )

        with self.tasks():
            export_errors_data(
                organization_id=self.organization.id,
                destination_bucket="test-bucket",
                gcs_prefix="test-prefix",
            )

        # With BATCH_SIZE=3 and 8 events, we get 3 batches: [3, 3, 2]
        assert gcs["blob"].upload_from_string.call_count == 3
        assert gcs["bucket"].blob.call_count == 3

        # First batch: 3 events
        first_upload_data = gcs["blob"].upload_from_string.call_args_list[0][0][0]
        first_decompressed = gzip.decompress(first_upload_data).decode("utf-8")
        first_lines = first_decompressed.strip().split("\n")
        assert len(first_lines) == 3

        # Second batch: 3 events
        second_upload_data = gcs["blob"].upload_from_string.call_args_list[1][0][0]
        second_decompressed = gzip.decompress(second_upload_data).decode("utf-8")
        second_lines = second_decompressed.strip().split("\n")
        assert len(second_lines) == 3

        # Third batch: 2 events
        third_upload_data = gcs["blob"].upload_from_string.call_args_list[2][0][0]
        third_decompressed = gzip.decompress(third_upload_data).decode("utf-8")
        third_lines = third_decompressed.strip().split("\n")
        assert len(third_lines) == 2

        # Verify all events are unique and valid JSON
        all_lines = first_lines + second_lines + third_lines
        event_ids = set()
        for line in all_lines:
            event_data = json.loads(line)
            assert "event_id" in event_data
            event_ids.add(event_data["event_id"])

        assert len(event_ids) == 8

    def test_export_errors_data_invalid_organization(self, mock_storage_client):
        result = export_errors_data(
            organization_id=99999,  # Non-existent organization
            destination_bucket="test-bucket",
            gcs_prefix="test-prefix",
        )
        assert result is None

    def test_export_errors_data_no_projects(self, mock_storage_client):
        empty_org = self.create_organization()
        result = export_errors_data(
            organization_id=empty_org.id,
            destination_bucket="test-bucket",
            gcs_prefix="test-prefix",
        )
        assert result is None

    def test_export_errors_data_no_events(self, mock_storage_client):
        gcs = set_up_gcs_mocks(mock_storage_client)

        with self.tasks():
            export_errors_data(
                organization_id=self.organization.id,
                destination_bucket="test-bucket",
                gcs_prefix="test-prefix",
            )

        # Tasks are scheduled for both projects, but no uploads occur (no events)
        assert gcs["storage_client"].call_count == 2
        assert gcs["blob"].upload_from_string.call_count == 0

    def test_export_errors_data_schedules_tasks_for_all_projects(self, mock_storage_client):
        gcs = set_up_gcs_mocks(mock_storage_client)

        self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": before_now(minutes=1).isoformat(),
            },
            project_id=self.project1.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "timestamp": before_now(minutes=2).isoformat(),
            },
            project_id=self.project2.id,
        )

        with self.tasks():
            export_errors_data(
                organization_id=self.organization.id,
                destination_bucket="test-bucket",
                gcs_prefix="test-prefix",
            )

        # Two separate tasks (one per project) each create a storage client
        assert gcs["storage_client"].call_count == 2
        # One upload per project (one event each)
        assert gcs["blob"].upload_from_string.call_count == 2
