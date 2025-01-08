from unittest.mock import Mock, patch

from sentry.tempest.models import MessageType
from sentry.tempest.tasks import fetch_latest_item_id, poll_tempest, poll_tempest_crashes
from sentry.testutils.cases import TestCase


class TempestTasksTest(TestCase):
    def setUp(self):
        super().setUp()
        self.project = self.create_project()
        self.credentials = self.create_tempest_credentials(self.project)

    @patch("sentry.tempest.tasks.fetch_latest_id_from_tempest")
    def test_fetch_latest_item_id_task(self, mock_fetch):
        mock_response = Mock()
        mock_response.text = "20001"
        mock_fetch.return_value = mock_response

        fetch_latest_item_id(self.credentials.id)

        self.credentials.refresh_from_db()
        assert (
            self.credentials.latest_fetched_item_id == "20001"
        )  # Since the ID is stored as a string
        mock_fetch.assert_called_once()

    @patch("sentry.tempest.tasks.fetch_latest_id_from_tempest")
    def test_fetch_latest_item_id_error(self, mock_fetch):
        mock_response = Mock()
        mock_response.text = "Invalid credentials"
        mock_fetch.return_value = mock_response

        fetch_latest_item_id(self.credentials.id)

        self.credentials.refresh_from_db()
        assert self.credentials.message == "Seems like the provided credentials are invalid"
        assert self.credentials.message_type == MessageType.ERROR
        assert self.credentials.latest_fetched_item_id is None

    @patch("sentry.tempest.tasks.fetch_latest_id_from_tempest")
    def test_fetch_latest_item_id_ip_not_allowlisted(self, mock_fetch):
        mock_response = Mock()
        mock_response.text = "IP address not allow-listed"
        mock_fetch.return_value = mock_response

        fetch_latest_item_id(self.credentials.id)

        self.credentials.refresh_from_db()
        assert self.credentials.message == "Seems like our IP is not allow-listed"
        assert self.credentials.message_type == MessageType.ERROR
        assert self.credentials.latest_fetched_item_id is None

    @patch("sentry.tempest.tasks.fetch_latest_id_from_tempest")
    def test_fetch_latest_item_id_unexpected_response(self, mock_fetch):
        mock_fetch.return_value = "Some other error"

        fetch_latest_item_id(self.credentials.id)

        self.credentials.refresh_from_db()
        assert self.credentials.latest_fetched_item_id is None
        assert self.credentials.message == ""  # No specific message set for unexpected responses
        mock_fetch.assert_called_once()

    @patch("sentry.tempest.tasks.fetch_latest_id_from_tempest")
    def test_fetch_latest_item_id_connection_error(self, mock_fetch):
        mock_fetch.side_effect = Exception("Connection error")

        with self.assertLogs("sentry.tempest.tasks", level="INFO") as cm:
            fetch_latest_item_id(self.credentials.id)

        self.credentials.refresh_from_db()
        assert self.credentials.latest_fetched_item_id is None
        assert self.credentials.message == ""
        mock_fetch.assert_called_once()
        assert "Fetching the latest item id failed." in cm.output[0]

    @patch("sentry.tempest.tasks.fetch_items_from_tempest")
    def test_poll_tempest_crashes_task(self, mock_fetch):
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
    def test_poll_tempest_crashes_invalid_json(self, mock_fetch):
        mock_fetch.return_value = Mock()
        mock_fetch.return_value.json.return_value = "no valid json"

        # Set this value since the test assumes that there is already an ID in the DB
        self.credentials.latest_fetched_item_id = "42"
        self.credentials.save()

        with self.assertLogs("sentry.tempest.tasks", level="INFO") as cm:
            poll_tempest_crashes(self.credentials.id)

        self.credentials.refresh_from_db()
        # ID should remain unchanged when JSON parsing fails
        assert self.credentials.latest_fetched_item_id == "42"
        mock_fetch.assert_called_once()
        assert "Fetching the crashes failed." in cm.output[0]

    @patch("sentry.tempest.tasks.fetch_items_from_tempest")
    def test_poll_tempest_crashes_error(self, mock_fetch):
        mock_fetch.side_effect = Exception("Connection error")

        # Set this value since the test assumes that there is already an ID in the DB
        self.credentials.latest_fetched_item_id = "42"
        self.credentials.save()

        with self.assertLogs("sentry.tempest.tasks", level="INFO") as cm:
            poll_tempest_crashes(self.credentials.id)

        # Should log error but not crash
        mock_fetch.assert_called_once()
        assert "Fetching the crashes failed." in cm.output[0]

    @patch("sentry.tempest.tasks.fetch_latest_item_id")
    @patch("sentry.tempest.tasks.poll_tempest_crashes")
    def test_poll_tempest_no_latest_id(self, mock_poll_crashes, mock_fetch_latest):
        # Ensure latest_fetched_item_id is None
        self.credentials.latest_fetched_item_id = None
        self.credentials.save()

        poll_tempest()

        # Should call fetch_latest_item_id.delay() and not poll_tempest_crashes
        mock_fetch_latest.delay.assert_called_once_with(self.credentials.id)
        mock_poll_crashes.delay.assert_not_called()

    @patch("sentry.tempest.tasks.fetch_latest_item_id")
    @patch("sentry.tempest.tasks.poll_tempest_crashes")
    def test_poll_tempest_with_latest_id(self, mock_poll_crashes, mock_fetch_latest):
        # Set an existing ID
        self.credentials.latest_fetched_item_id = "42"
        self.credentials.save()

        poll_tempest()

        # Should call poll_tempest_crashes.delay() and not fetch_latest_item_id
        mock_poll_crashes.delay.assert_called_once_with(self.credentials.id)
        mock_fetch_latest.delay.assert_not_called()
