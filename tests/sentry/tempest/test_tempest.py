from unittest.mock import MagicMock, Mock, patch

from requests.exceptions import ConnectionError, ReadTimeout, Timeout

from sentry.locks import locks
from sentry.models.organization import Organization
from sentry.models.projectkey import ProjectKey, UseCase
from sentry.tempest.models import MessageType
from sentry.tempest.tasks import (
    fetch_items_from_tempest,
    fetch_latest_id_from_tempest,
    fetch_latest_item_id,
    poll_tempest,
    poll_tempest_crashes,
)
from sentry.testutils.cases import TestCase


class TempestTasksTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project()
        self.credentials = self.create_tempest_credentials(self.project)

    @patch("sentry.tempest.tasks.fetch_latest_id_from_tempest")
    def test_fetch_latest_item_id_task(self, mock_fetch: MagicMock) -> None:
        mock_fetch.return_value = Mock()
        mock_fetch.return_value.json.return_value = {"latest_id": 20001}

        fetch_latest_item_id(self.credentials.id)

        self.credentials.refresh_from_db()
        assert (
            self.credentials.latest_fetched_item_id == "20001"
        )  # Since the ID is stored as a string
        mock_fetch.assert_called_once()

    @patch("sentry.tempest.tasks.fetch_latest_id_from_tempest")
    def test_fetch_latest_item_id_task_no_id(self, mock_fetch: MagicMock) -> None:
        mock_fetch.return_value = Mock()
        mock_fetch.return_value.json.return_value = {"latest_id": None}

        fetch_latest_item_id(self.credentials.id)

        self.credentials.refresh_from_db()
        assert (
            self.credentials.message
            == "Connection successful. No crashes found in the crash report system yet. New crashes will appear here automatically when they occur."
        )
        assert self.credentials.message_type == MessageType.WARNING
        assert self.credentials.latest_fetched_item_id is None

    @patch("sentry.tempest.tasks.fetch_latest_id_from_tempest")
    def test_fetch_latest_item_id_error(self, mock_fetch: MagicMock) -> None:
        mock_fetch.return_value = Mock()
        mock_fetch.return_value.json.return_value = {
            "error": {"type": "invalid_credentials", "message": "..."}
        }

        fetch_latest_item_id(self.credentials.id)

        self.credentials.refresh_from_db()
        assert self.credentials.message == "Seems like the provided credentials are invalid"
        assert self.credentials.message_type == MessageType.ERROR
        assert self.credentials.latest_fetched_item_id is None

    @patch("sentry.tempest.tasks.fetch_latest_id_from_tempest")
    def test_fetch_latest_item_id_ip_not_allowlisted(self, mock_fetch: MagicMock) -> None:
        mock_fetch.return_value = Mock()
        mock_fetch.return_value.json.return_value = {
            "error": {
                "type": "ip_not_allowlisted",
                "message": "...",
            }
        }

        fetch_latest_item_id(self.credentials.id)

        self.credentials.refresh_from_db()
        assert self.credentials.message == "Seems like our IP is not allow-listed"
        assert self.credentials.message_type == MessageType.ERROR
        assert self.credentials.latest_fetched_item_id is None

    @patch("sentry.tempest.tasks.fetch_latest_id_from_tempest")
    def test_fetch_latest_item_id_unexpected_response(self, mock_fetch: MagicMock) -> None:
        mock_fetch.return_value = Mock()
        mock_fetch.return_value.json.return_value = {
            "error": {
                "type": "internal_error",
                "message": "...",
            }
        }

        fetch_latest_item_id(self.credentials.id)

        self.credentials.refresh_from_db()
        assert self.credentials.latest_fetched_item_id is None
        assert self.credentials.message == ""  # No specific message set for unexpected responses
        mock_fetch.assert_called_once()

    @patch("sentry.tempest.tasks.fetch_latest_id_from_tempest")
    def test_fetch_latest_item_id_connection_error(self, mock_fetch: MagicMock) -> None:
        mock_fetch.side_effect = Exception("Connection error")

        with self.assertLogs("sentry.tempest.tasks", level="INFO") as cm:
            fetch_latest_item_id(self.credentials.id)

        self.credentials.refresh_from_db()
        assert self.credentials.latest_fetched_item_id is None
        assert self.credentials.message == ""
        mock_fetch.assert_called_once()
        assert "Fetching the latest item id failed." in cm.output[0]

    @patch("sentry.tempest.tasks.fetch_items_from_tempest")
    def test_poll_tempest_crashes_task(self, mock_fetch: MagicMock) -> None:
        mock_fetch.return_value = Mock()
        mock_fetch.return_value.json.return_value = {"latest_id": 20002}

        # Set this value since the test assumes that there is already an ID in the DB
        self.credentials.latest_fetched_item_id = "42"
        self.credentials.save()

        poll_tempest_crashes(self.credentials.id)

        self.credentials.refresh_from_db()
        assert self.credentials.latest_fetched_item_id == "20002"
        mock_fetch.assert_called_once()

    @patch("sentry.tempest.tasks.fetch_items_from_tempest")
    def test_poll_tempest_crashes_invalid_json(self, mock_fetch: MagicMock) -> None:
        mock_fetch.return_value = Mock()
        mock_fetch.return_value.json.return_value = {"error": "Some internal server error"}

        # Set this value since the test assumes that there is already an ID in the DB
        self.credentials.latest_fetched_item_id = "42"
        self.credentials.save()

        with self.assertLogs("sentry.tempest.tasks", level="INFO") as cm:
            poll_tempest_crashes(self.credentials.id)

        mock_fetch.assert_called_once()
        assert "Fetching the crashes failed." in cm.output[0]
        self.credentials.refresh_from_db()
        # ID should be reset when JSON parsing fails since we don't want to retry the faulty crash
        assert self.credentials.latest_fetched_item_id is None

    @patch("sentry.tempest.tasks.fetch_items_from_tempest")
    def test_poll_tempest_crashes_error(self, mock_fetch: MagicMock) -> None:
        mock_fetch.side_effect = Exception("Connection error")

        # Set this value since the test assumes that there is already an ID in the DB
        self.credentials.latest_fetched_item_id = "42"
        self.credentials.save()

        with self.assertLogs("sentry.tempest.tasks", level="INFO") as cm:
            poll_tempest_crashes(self.credentials.id)

        # Should log error but not crash
        mock_fetch.assert_called_once()
        assert "Fetching the crashes failed." in cm.output[0]

    @patch("sentry.tempest.tasks.has_tempest_access")
    @patch("sentry.tempest.tasks.fetch_latest_item_id")
    @patch("sentry.tempest.tasks.poll_tempest_crashes")
    def test_poll_tempest_no_latest_id(
        self, mock_poll_crashes: MagicMock, mock_fetch_latest: MagicMock, mock_has_access: MagicMock
    ) -> None:
        mock_has_access.return_value = True
        # Ensure latest_fetched_item_id is None
        self.credentials.latest_fetched_item_id = None
        self.credentials.save()

        poll_tempest()

        # Should call fetch_latest_item_id and not poll_tempest_crashes
        mock_fetch_latest.apply_async.assert_called_once_with(
            kwargs={"credentials_id": self.credentials.id},
            headers={"sentry-propagate-traces": False},
        )
        mock_poll_crashes.apply_async.assert_not_called()

    @patch("sentry.tempest.tasks.has_tempest_access")
    @patch("sentry.tempest.tasks.fetch_latest_item_id")
    @patch("sentry.tempest.tasks.poll_tempest_crashes")
    def test_poll_tempest_with_latest_id(
        self, mock_poll_crashes: MagicMock, mock_fetch_latest: MagicMock, mock_has_access: MagicMock
    ) -> None:
        mock_has_access.return_value = True
        # Set an existing ID
        self.credentials.latest_fetched_item_id = "42"
        self.credentials.save()

        poll_tempest()

        # Should call poll_tempest_crashes and not fetch_latest_item_id
        mock_poll_crashes.apply_async.assert_called_once_with(
            kwargs={"credentials_id": self.credentials.id},
            headers={"sentry-propagate-traces": False},
        )
        mock_fetch_latest.apply_async.assert_not_called()

    def test_tempest_project_key(self) -> None:
        project = self.create_project()
        project_key_1, created = ProjectKey.objects.get_or_create(
            use_case=UseCase.TEMPEST, project=project
        )

        project_key_2, created_2 = ProjectKey.objects.get_or_create(
            use_case=UseCase.TEMPEST, project=project
        )

        assert created
        assert not created_2
        assert project_key_2.use_case == "UseCase.TEMPEST"
        assert project_key_1.id == project_key_2.id

    def test_tempest_screenshot_option(self) -> None:
        # Default should be False
        assert self.project.get_option("sentry:tempest_fetch_screenshots") is False

        self.project.update_option("sentry:tempest_fetch_screenshots", True)
        assert self.project.get_option("sentry:tempest_fetch_screenshots") is True

        self.project.update_option("sentry:tempest_fetch_screenshots", False)
        assert self.project.get_option("sentry:tempest_fetch_screenshots") is False

    @patch("sentry.tempest.tasks.schedule_invalidate_project_config")
    @patch("sentry.tempest.tasks.fetch_items_from_tempest")
    def test_poll_tempest_crashes_invalidates_config(
        self, mock_fetch: MagicMock, mock_invalidate: MagicMock
    ) -> None:
        """Test that project config is invalidated only when a new ProjectKey is created"""
        mock_fetch.return_value.json.return_value = {"latest_id": "123"}

        self.credentials.latest_fetched_item_id = "42"
        self.credentials.save()

        # First call -> should create new ProjectKey and thus invalidate config
        poll_tempest_crashes(self.credentials.id)
        mock_invalidate.assert_called_once_with(
            project_id=self.project.id, trigger="tempest:poll_tempest_crashes"
        )
        mock_invalidate.reset_mock()

        # Second call -> should reuse existing ProjectKey and thus not invalidate config
        poll_tempest_crashes(self.credentials.id)
        mock_invalidate.assert_not_called()

    @patch("sentry.tempest.tasks.has_tempest_access")
    @patch("sentry.tempest.tasks.fetch_latest_item_id")
    @patch("sentry.tempest.tasks.poll_tempest_crashes")
    def test_poll_tempest_skips_credentials_without_access(
        self, mock_poll_crashes: MagicMock, mock_fetch_latest: MagicMock, mock_has_access: MagicMock
    ) -> None:
        """Test that poll_tempest skips credentials when organization doesn't have tempest access"""
        org_with_access = self.create_organization()
        project_with_access = self.create_project(organization=org_with_access)
        credentials_with_access = self.create_tempest_credentials(project_with_access)
        credentials_with_access.latest_fetched_item_id = "42"
        credentials_with_access.save()

        org_without_access = self.create_organization()
        project_without_access = self.create_project(organization=org_without_access)
        credentials_without_access = self.create_tempest_credentials(project_without_access)
        credentials_without_access.latest_fetched_item_id = "42"
        credentials_without_access.save()

        def mock_access_check(organization: Organization | None) -> bool:
            assert organization is not None
            return organization.id == org_with_access.id

        mock_has_access.side_effect = mock_access_check

        poll_tempest()

        assert mock_has_access.call_count == 3
        mock_poll_crashes.apply_async.assert_called_once_with(
            kwargs={"credentials_id": credentials_with_access.id},
            headers={"sentry-propagate-traces": False},
        )
        mock_fetch_latest.apply_async.assert_not_called()


class TempestTasksLockingTest(TestCase):
    """Tests for task locking to prevent overlapping execution."""

    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project()
        self.credentials = self.create_tempest_credentials(self.project)

    @patch("sentry.tempest.tasks.metrics")
    @patch("sentry.tempest.tasks.fetch_latest_id_from_tempest")
    def test_fetch_latest_item_id_skips_when_lock_held(
        self, mock_fetch: MagicMock, mock_metrics: MagicMock
    ) -> None:
        """Test that fetch_latest_item_id skips execution when lock is already held."""
        # Acquire the lock manually to simulate another task in progress
        lock = locks.get(
            f"tempest:fetch_latest_id:{self.credentials.id}",
            duration=60,
            name="tempest_fetch_latest_id",
        )

        with lock.acquire():
            # Call the task while lock is held - should skip
            fetch_latest_item_id(self.credentials.id)

        # The actual fetch should not have been called
        mock_fetch.assert_not_called()

        # Metric should be recorded for skipped task
        mock_metrics.incr.assert_called_with(
            "tempest.latest_id.skipped", tags={"reason": "lock_held"}
        )

    @patch("sentry.tempest.tasks.metrics")
    @patch("sentry.tempest.tasks.fetch_items_from_tempest")
    def test_poll_tempest_crashes_skips_when_lock_held(
        self, mock_fetch: MagicMock, mock_metrics: MagicMock
    ) -> None:
        """Test that poll_tempest_crashes skips execution when lock is already held."""
        self.credentials.latest_fetched_item_id = "42"
        self.credentials.save()

        # Acquire the lock manually to simulate another task in progress
        lock = locks.get(
            f"tempest:poll_crashes:{self.credentials.id}",
            duration=60,
            name="tempest_poll_crashes",
        )

        with lock.acquire():
            # Call the task while lock is held - should skip
            poll_tempest_crashes(self.credentials.id)

        # The actual fetch should not have been called
        mock_fetch.assert_not_called()

        # Metric should be recorded for skipped task
        mock_metrics.incr.assert_called_with(
            "tempest.crashes.skipped", tags={"reason": "lock_held"}
        )

    @patch("sentry.tempest.tasks.fetch_latest_id_from_tempest")
    def test_fetch_latest_item_id_executes_when_lock_available(self, mock_fetch: MagicMock) -> None:
        """Test that fetch_latest_item_id executes normally when lock is available."""
        mock_fetch.return_value = Mock()
        mock_fetch.return_value.json.return_value = {"latest_id": 12345}

        # Call without holding the lock
        fetch_latest_item_id(self.credentials.id)

        # Should have executed
        mock_fetch.assert_called_once()

        self.credentials.refresh_from_db()
        assert self.credentials.latest_fetched_item_id == "12345"

    @patch("sentry.tempest.tasks.fetch_items_from_tempest")
    def test_poll_tempest_crashes_executes_when_lock_available(self, mock_fetch: MagicMock) -> None:
        """Test that poll_tempest_crashes executes normally when lock is available."""
        mock_fetch.return_value = Mock()
        mock_fetch.return_value.json.return_value = {"latest_id": 54321}

        self.credentials.latest_fetched_item_id = "42"
        self.credentials.save()

        # Call without holding the lock
        poll_tempest_crashes(self.credentials.id)

        # Should have executed
        mock_fetch.assert_called_once()

        self.credentials.refresh_from_db()
        assert self.credentials.latest_fetched_item_id == "54321"

    @patch("sentry.tempest.tasks.fetch_latest_id_from_tempest")
    def test_fetch_latest_item_id_different_credentials_not_blocked(
        self, mock_fetch: MagicMock
    ) -> None:
        """Test that locks are per-credential: different credentials can run in parallel."""
        mock_fetch.return_value = Mock()
        mock_fetch.return_value.json.return_value = {"latest_id": 99999}

        # Create another credential
        other_project = self.create_project()
        other_credentials = self.create_tempest_credentials(other_project)

        # Hold the lock for the first credential
        lock = locks.get(
            f"tempest:fetch_latest_id:{self.credentials.id}",
            duration=60,
            name="tempest_fetch_latest_id",
        )

        with lock.acquire():
            # The other credential should still be able to run
            fetch_latest_item_id(other_credentials.id)

        # Should have executed for the other credential
        mock_fetch.assert_called_once()

        other_credentials.refresh_from_db()
        assert other_credentials.latest_fetched_item_id == "99999"

    @patch("sentry.tempest.tasks.options")
    @patch("sentry.tempest.tasks.locks")
    @patch("sentry.tempest.tasks._fetch_latest_item_id_impl")
    def test_fetch_latest_item_id_lock_duration_configurable(
        self, mock_impl: MagicMock, mock_locks: MagicMock, mock_options: MagicMock
    ) -> None:
        """Test that lock duration is calculated from configurable options."""
        # Configure options
        mock_options.get.side_effect = lambda key: {
            "tempest.task-deadline-seconds": 120,
            "tempest.lock-buffer-seconds": 45,
        }[key]

        # Setup mock lock
        mock_lock = MagicMock()
        mock_lock.acquire.return_value.__enter__ = MagicMock()
        mock_lock.acquire.return_value.__exit__ = MagicMock(return_value=False)
        mock_locks.get.return_value = mock_lock

        fetch_latest_item_id(self.credentials.id)

        # Verify lock was created with correct duration (120 + 45 = 165)
        mock_locks.get.assert_called_once_with(
            f"tempest:fetch_latest_id:{self.credentials.id}",
            duration=165,
            name="tempest_fetch_latest_id",
        )

    @patch("sentry.tempest.tasks.options")
    @patch("sentry.tempest.tasks.locks")
    @patch("sentry.tempest.tasks._poll_tempest_crashes_impl")
    def test_poll_tempest_crashes_lock_duration_configurable(
        self, mock_impl: MagicMock, mock_locks: MagicMock, mock_options: MagicMock
    ) -> None:
        """Test that lock duration is calculated from configurable options."""
        # Configure options
        mock_options.get.side_effect = lambda key: {
            "tempest.task-deadline-seconds": 180,
            "tempest.lock-buffer-seconds": 60,
        }[key]

        # Setup mock lock
        mock_lock = MagicMock()
        mock_lock.acquire.return_value.__enter__ = MagicMock()
        mock_lock.acquire.return_value.__exit__ = MagicMock(return_value=False)
        mock_locks.get.return_value = mock_lock

        poll_tempest_crashes(self.credentials.id)

        # Verify lock was created with correct duration (180 + 60 = 240)
        mock_locks.get.assert_called_once_with(
            f"tempest:poll_crashes:{self.credentials.id}",
            duration=240,
            name="tempest_poll_crashes",
        )


class TempestTasksTimeoutTest(TestCase):
    """Tests for timeout handling and error metrics."""

    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project()
        self.credentials = self.create_tempest_credentials(self.project)

    @patch("sentry.tempest.tasks.metrics")
    @patch("sentry.tempest.tasks.fetch_latest_id_from_tempest")
    def test_fetch_latest_item_id_timeout_records_metrics(
        self, mock_fetch: MagicMock, mock_metrics: MagicMock
    ) -> None:
        """Test that timeout exceptions record appropriate metrics."""
        mock_fetch.side_effect = Timeout("Connection timed out")

        with self.assertLogs("sentry.tempest.tasks", level="ERROR"):
            fetch_latest_item_id(self.credentials.id)

        # Check that error metric was recorded with timeout type
        mock_metrics.incr.assert_any_call(
            "tempest.latest_id.error",
            tags={
                "org_id": str(self.project.organization_id),
                "project_id": str(self.project.id),
                "error_type": "timeout",
            },
        )

        # Check that timing was recorded
        mock_metrics.timing.assert_called()

    @patch("sentry.tempest.tasks.metrics")
    @patch("sentry.tempest.tasks.fetch_latest_id_from_tempest")
    def test_fetch_latest_item_id_read_timeout_records_metrics(
        self, mock_fetch: MagicMock, mock_metrics: MagicMock
    ) -> None:
        """Test that ReadTimeout exceptions record appropriate metrics."""
        mock_fetch.side_effect = ReadTimeout("Read timed out")

        with self.assertLogs("sentry.tempest.tasks", level="ERROR"):
            fetch_latest_item_id(self.credentials.id)

        # Check that error metric was recorded with timeout type
        mock_metrics.incr.assert_any_call(
            "tempest.latest_id.error",
            tags={
                "org_id": str(self.project.organization_id),
                "project_id": str(self.project.id),
                "error_type": "timeout",
            },
        )

    @patch("sentry.tempest.tasks.metrics")
    @patch("sentry.tempest.tasks.fetch_latest_id_from_tempest")
    def test_fetch_latest_item_id_connection_error_records_metrics(
        self, mock_fetch: MagicMock, mock_metrics: MagicMock
    ) -> None:
        """Test that ConnectionError exceptions record appropriate metrics."""
        mock_fetch.side_effect = ConnectionError("Connection refused")

        with self.assertLogs("sentry.tempest.tasks", level="ERROR"):
            fetch_latest_item_id(self.credentials.id)

        # Check that error metric was recorded with connection_error type
        mock_metrics.incr.assert_any_call(
            "tempest.latest_id.error",
            tags={
                "org_id": str(self.project.organization_id),
                "project_id": str(self.project.id),
                "error_type": "connection_error",
            },
        )

    @patch("sentry.tempest.tasks.metrics")
    @patch("sentry.tempest.tasks.fetch_latest_id_from_tempest")
    def test_fetch_latest_item_id_success_records_metrics(
        self, mock_fetch: MagicMock, mock_metrics: MagicMock
    ) -> None:
        """Test that successful fetch records appropriate metrics."""
        mock_response = Mock()
        mock_response.json.return_value = {"latest_id": 12345}
        mock_response.content = b'{"latest_id": 12345}'
        mock_fetch.return_value = mock_response

        fetch_latest_item_id(self.credentials.id)

        # Check that success metric was recorded
        mock_metrics.incr.assert_any_call(
            "tempest.latest_id.success",
            tags={
                "org_id": str(self.project.organization_id),
                "project_id": str(self.project.id),
                "result": "found",
            },
        )

        # Check that timing was recorded
        mock_metrics.timing.assert_called()

        # Check that response size was recorded
        mock_metrics.distribution.assert_called()

    @patch("sentry.tempest.tasks.metrics")
    @patch("sentry.tempest.tasks.fetch_items_from_tempest")
    def test_poll_tempest_crashes_timeout_records_metrics(
        self, mock_fetch: MagicMock, mock_metrics: MagicMock
    ) -> None:
        """Test that timeout in poll_tempest_crashes records metrics and preserves state."""
        self.credentials.latest_fetched_item_id = "42"
        self.credentials.save()

        mock_fetch.side_effect = Timeout("Connection timed out")

        with self.assertLogs("sentry.tempest.tasks", level="ERROR"):
            poll_tempest_crashes(self.credentials.id)

        # Check that error metric was recorded
        mock_metrics.incr.assert_any_call(
            "tempest.crashes.error",
            tags={
                "org_id": str(self.project.organization_id),
                "project_id": str(self.project.id),
                "error_type": "timeout",
            },
        )

        # Verify that latest_fetched_item_id is NOT reset on timeout
        # (we want to retry from the same offset)
        self.credentials.refresh_from_db()
        assert self.credentials.latest_fetched_item_id == "42"

    @patch("sentry.tempest.tasks.metrics")
    @patch("sentry.tempest.tasks.fetch_items_from_tempest")
    def test_poll_tempest_crashes_connection_error_preserves_state(
        self, mock_fetch: MagicMock, mock_metrics: MagicMock
    ) -> None:
        """Test that ConnectionError preserves latest_fetched_item_id for retry."""
        self.credentials.latest_fetched_item_id = "42"
        self.credentials.save()

        mock_fetch.side_effect = ConnectionError("Connection refused")

        with self.assertLogs("sentry.tempest.tasks", level="ERROR"):
            poll_tempest_crashes(self.credentials.id)

        # Verify that latest_fetched_item_id is NOT reset on connection error
        self.credentials.refresh_from_db()
        assert self.credentials.latest_fetched_item_id == "42"

    @patch("sentry.tempest.tasks.metrics")
    @patch("sentry.tempest.tasks.fetch_items_from_tempest")
    def test_poll_tempest_crashes_generic_error_resets_state(
        self, mock_fetch: MagicMock, mock_metrics: MagicMock
    ) -> None:
        """Test that generic exceptions reset latest_fetched_item_id to avoid stuck state."""
        self.credentials.latest_fetched_item_id = "42"
        self.credentials.save()

        mock_fetch.side_effect = ValueError("Unexpected data format")

        with self.assertLogs("sentry.tempest.tasks", level="ERROR"):
            poll_tempest_crashes(self.credentials.id)

        # Verify that latest_fetched_item_id IS reset on generic error
        # (to re-fetch latest ID and skip problematic crash)
        self.credentials.refresh_from_db()
        assert self.credentials.latest_fetched_item_id is None

    @patch("sentry.tempest.tasks.metrics")
    @patch("sentry.tempest.tasks.fetch_items_from_tempest")
    def test_poll_tempest_crashes_success_records_batch_metrics(
        self, mock_fetch: MagicMock, mock_metrics: MagicMock
    ) -> None:
        """Test that successful crash fetch records batch size metrics."""
        self.credentials.latest_fetched_item_id = "42"
        self.credentials.save()

        mock_response = Mock()
        mock_response.json.return_value = {
            "latest_id": 100,
            "crash_count": 5,
            "crash_fails": 1,
        }
        mock_response.content = b'{"latest_id": 100}'
        mock_fetch.return_value = mock_response

        poll_tempest_crashes(self.credentials.id)

        # Check that batch size metric was recorded
        mock_metrics.distribution.assert_any_call(
            "tempest.crashes.batch_size",
            5,
            tags={
                "org_id": str(self.project.organization_id),
                "project_id": str(self.project.id),
            },
        )

        # Check that failure count was recorded
        mock_metrics.incr.assert_any_call(
            "tempest.crashes.batch_failures",
            amount=1,
            tags={
                "org_id": str(self.project.organization_id),
                "project_id": str(self.project.id),
            },
        )


class TempestTasksConfigurableTimeoutTest(TestCase):
    """Tests for configurable timeout options."""

    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project()
        self.credentials = self.create_tempest_credentials(self.project)

    @patch("sentry.tempest.tasks.requests")
    @patch("sentry.tempest.tasks.options")
    def test_fetch_latest_id_uses_configurable_timeout(
        self, mock_options: MagicMock, mock_requests: MagicMock
    ) -> None:
        """Test that fetch_latest_id_from_tempest uses the configured timeout."""
        mock_options.get.return_value = 30  # 30 second timeout

        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.content = b'{"latest_id": 123}'
        mock_response.text = '{"latest_id": 123}'
        mock_requests.post.return_value = mock_response

        fetch_latest_id_from_tempest(
            org_id=1,
            project_id=2,
            client_id="test_client",
            client_secret="test_secret",
        )

        # Verify that the configured timeout was used
        mock_options.get.assert_called_with("tempest.latest-id-timeout")
        mock_requests.post.assert_called_once()
        call_kwargs = mock_requests.post.call_args[1]
        assert call_kwargs["timeout"] == 30

    @patch("sentry.tempest.tasks.requests")
    @patch("sentry.tempest.tasks.options")
    def test_fetch_items_uses_configurable_timeout(
        self, mock_options: MagicMock, mock_requests: MagicMock
    ) -> None:
        """Test that fetch_items_from_tempest uses the configured timeout."""
        mock_options.get.return_value = 45  # 45 second timeout

        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.content = b'{"latest_id": 123}'
        mock_response.text = '{"latest_id": 123}'
        mock_requests.post.return_value = mock_response

        fetch_items_from_tempest(
            org_id=1,
            project_id=2,
            client_id="test_client",
            client_secret="test_secret",
            dsn="https://key@sentry.io/123",
            offset=100,
            limit=10,
        )

        # Verify that the configured timeout was used
        mock_options.get.assert_called_with("tempest.crashes-timeout")
        mock_requests.post.assert_called_once()
        call_kwargs = mock_requests.post.call_args[1]
        assert call_kwargs["timeout"] == 45

    @patch("sentry.tempest.tasks.metrics")
    @patch("sentry.tempest.tasks.fetch_latest_id_from_tempest")
    def test_fetch_latest_item_id_invalid_credentials_error(
        self, mock_fetch: MagicMock, mock_metrics: MagicMock
    ) -> None:
        """Test that invalid_credentials error is recorded in metrics."""
        mock_response = Mock()
        mock_response.json.return_value = {
            "error": {"type": "invalid_credentials", "message": "Bad credentials"}
        }
        mock_response.status_code = 401
        mock_response.content = b'{"error": {"type": "invalid_credentials"}}'
        mock_fetch.return_value = mock_response

        fetch_latest_item_id(self.credentials.id)

        # Check that error metric was recorded with correct type
        mock_metrics.incr.assert_any_call(
            "tempest.latest_id.error",
            tags={
                "org_id": str(self.project.organization_id),
                "project_id": str(self.project.id),
                "error_type": "invalid_credentials",
                "status_code": "401",
            },
        )

        # Verify credentials message was set
        self.credentials.refresh_from_db()
        assert self.credentials.message == "Seems like the provided credentials are invalid"
        assert self.credentials.message_type == MessageType.ERROR

    @patch("sentry.tempest.tasks.metrics")
    @patch("sentry.tempest.tasks.fetch_latest_id_from_tempest")
    def test_fetch_latest_item_id_ip_not_allowlisted_error(
        self, mock_fetch: MagicMock, mock_metrics: MagicMock
    ) -> None:
        """Test that ip_not_allowlisted error is recorded in metrics."""
        mock_response = Mock()
        mock_response.json.return_value = {
            "error": {"type": "ip_not_allowlisted", "message": "IP not allowed"}
        }
        mock_response.status_code = 403
        mock_response.content = b'{"error": {"type": "ip_not_allowlisted"}}'
        mock_fetch.return_value = mock_response

        fetch_latest_item_id(self.credentials.id)

        # Check that error metric was recorded with correct type
        mock_metrics.incr.assert_any_call(
            "tempest.latest_id.error",
            tags={
                "org_id": str(self.project.organization_id),
                "project_id": str(self.project.id),
                "error_type": "ip_not_allowlisted",
                "status_code": "403",
            },
        )

        # Verify credentials message was set
        self.credentials.refresh_from_db()
        assert self.credentials.message == "Seems like our IP is not allow-listed"
        assert self.credentials.message_type == MessageType.ERROR
