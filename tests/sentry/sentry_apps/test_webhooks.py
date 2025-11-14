from typing import int, Any
from unittest.mock import Mock, patch

import pytest

from sentry.sentry_apps.metrics import SentryAppEventType
from sentry.sentry_apps.tasks.sentry_apps import broadcast_webhooks_for_organization
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class BroadcastWebhooksForOrganizationTest(TestCase):
    def setUp(self) -> None:
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)

        # Create sentry apps with different event subscriptions
        self.sentry_app_1 = self.create_sentry_app(
            name="App1",
            organization=self.organization,
            events=["seer.root_cause_started", "issue.created"],
        )
        self.sentry_app_2 = self.create_sentry_app(
            name="App2", organization=self.organization, events=["error.created", "issue.assigned"]
        )
        self.sentry_app_3 = self.create_sentry_app(
            name="App3", organization=self.organization, events=["metric_alert.open"]
        )

        # Create installations
        self.installation_1 = self.create_sentry_app_installation(
            organization=self.organization, slug=self.sentry_app_1.slug
        )
        self.installation_2 = self.create_sentry_app_installation(
            organization=self.organization, slug=self.sentry_app_2.slug
        )
        self.installation_3 = self.create_sentry_app_installation(
            organization=self.organization, slug=self.sentry_app_3.slug
        )

    @patch("sentry.sentry_apps.tasks.sentry_apps.send_resource_change_webhook")
    @patch("sentry.sentry_apps.tasks.sentry_apps.app_service.installations_for_organization")
    def test_broadcast_valid_event_to_relevant_installations(
        self, mock_installations, mock_send_webhook
    ):
        """Test that webhooks are sent to relevant installations for valid events."""
        mock_installations.return_value = [
            self.installation_1
        ]  # Only installation_1 subscribes to issue events

        payload = {"test": "data"}

        broadcast_webhooks_for_organization(
            resource_name="issue",
            event_name="created",
            organization_id=self.organization.id,
            payload=payload,
        )

        # Verify installations were fetched
        mock_installations.assert_called_once_with(organization_id=self.organization.id)

        # Verify webhook task was queued for installation_1 (subscribed to issue events)
        mock_send_webhook.delay.assert_called_once_with(
            self.installation_1.id, "issue.created", payload
        )

    @patch("sentry.sentry_apps.tasks.sentry_apps.send_resource_change_webhook")
    @patch("sentry.sentry_apps.tasks.sentry_apps.app_service.installations_for_organization")
    def test_broadcast_sends_to_multiple_relevant_installations(
        self, mock_installations, mock_send_webhook
    ):
        """Test that webhooks are sent to all relevant installations."""
        # Both apps subscribe to issue events
        sentry_app_4 = self.create_sentry_app(
            name="App4", organization=self.organization, events=["issue.created", "issue.assigned"]
        )
        installation_4 = self.create_sentry_app_installation(
            organization=self.organization, slug=sentry_app_4.slug
        )

        mock_installations.return_value = [self.installation_1, installation_4]

        payload = {"event": "data"}

        broadcast_webhooks_for_organization(
            resource_name="issue",
            event_name="created",
            organization_id=self.organization.id,
            payload=payload,
        )

        # Verify both installations had webhook tasks queued
        assert mock_send_webhook.delay.call_count == 2
        mock_send_webhook.delay.assert_any_call(self.installation_1.id, "issue.created", payload)
        mock_send_webhook.delay.assert_any_call(installation_4.id, "issue.created", payload)

    @patch("sentry.sentry_apps.tasks.sentry_apps.send_resource_change_webhook")
    @patch("sentry.sentry_apps.tasks.sentry_apps.app_service.installations_for_organization")
    @patch("sentry.sentry_apps.tasks.sentry_apps.logger")
    def test_broadcast_no_relevant_installations(
        self, mock_logger, mock_installations, mock_send_webhook
    ):
        """Test that no webhooks are sent when no installations subscribe to the event."""
        mock_installations.return_value = [
            self.installation_3
        ]  # Only subscribes to metric_alert events

        payload = {"event": "data"}

        broadcast_webhooks_for_organization(
            resource_name="issue",
            event_name="created",
            organization_id=self.organization.id,
            payload=payload,
        )

        # Verify no webhook tasks were queued
        mock_send_webhook.delay.assert_not_called()

    @patch("sentry.sentry_apps.tasks.sentry_apps.app_service.installations_for_organization")
    def test_broadcast_invalid_event_type_raises_error(self, mock_installations):
        """Test that invalid event types raise SentryAppSentryError."""
        from sentry.sentry_apps.utils.errors import SentryAppSentryError

        mock_installations.return_value = []

        payload = {"event": "data"}

        # Invalid event types should raise SentryAppSentryError
        with pytest.raises(SentryAppSentryError) as exc_info:
            broadcast_webhooks_for_organization(
                resource_name="invalid_resource",
                event_name="invalid_event",
                organization_id=self.organization.id,
                payload=payload,
            )

        assert "Invalid event type: invalid_resource.invalid_event" in str(exc_info.value.message)

    @patch("sentry.sentry_apps.tasks.sentry_apps.send_resource_change_webhook")
    @patch("sentry.sentry_apps.tasks.sentry_apps.app_service.installations_for_organization")
    def test_broadcast_filters_by_consolidated_events(self, mock_installations, mock_send_webhook):
        """Test that installations are filtered based on consolidated events."""
        # Create an app that doesn't subscribe to the event resource
        sentry_app_5 = self.create_sentry_app(
            name="App5",
            organization=self.organization,
            events=["metric_alert.open"],  # Different resource
        )
        installation_5 = self.create_sentry_app_installation(
            organization=self.organization, slug=sentry_app_5.slug
        )

        mock_installations.return_value = [self.installation_1, installation_5]

        payload = {"event": "data"}

        broadcast_webhooks_for_organization(
            resource_name="issue",
            event_name="created",
            organization_id=self.organization.id,
            payload=payload,
        )

        # Only installation_1 should have webhook task queued (subscribes to issue events)
        mock_send_webhook.delay.assert_called_once_with(
            self.installation_1.id, "issue.created", payload
        )

    def test_valid_event_types_accepted(self):
        """Test that all valid SentryAppEventType values are accepted."""
        valid_combinations = [
            ("error", "created"),
            ("issue", "created"),
            ("event_alert", "triggered"),
            ("external_issue", "created"),
            ("external_issue", "linked"),
            ("select_options", "requested"),
            ("alert_rule_action", "requested"),
            ("metric_alert", "open"),
            ("metric_alert", "resolved"),
            ("metric_alert", "critical"),
            ("metric_alert", "warning"),
        ]

        for resource_name, event_name in valid_combinations:
            event_type = f"{resource_name}.{event_name}"
            # This should not raise ValueError
            SentryAppEventType(event_type)

    @patch("sentry.sentry_apps.tasks.sentry_apps.send_resource_change_webhook")
    @patch("sentry.sentry_apps.tasks.sentry_apps.app_service.installations_for_organization")
    def test_broadcast_different_event_types(self, mock_installations, mock_send_webhook):
        """Test broadcasting different valid event types."""
        mock_installations.return_value = [self.installation_2]

        payload = {"event": "data"}

        # Test error.created event
        broadcast_webhooks_for_organization(
            resource_name="error",
            event_name="created",
            organization_id=self.organization.id,
            payload=payload,
        )

        mock_send_webhook.delay.assert_called_with(self.installation_2.id, "error.created", payload)

    @patch("sentry.sentry_apps.tasks.sentry_apps.send_resource_change_webhook")
    @patch("sentry.sentry_apps.tasks.sentry_apps.app_service.installations_for_organization")
    def test_broadcast_empty_installations_list(self, mock_installations, mock_send_webhook):
        """Test broadcasting when no installations are returned."""
        mock_installations.return_value = []

        payload = {"event": "data"}

        broadcast_webhooks_for_organization(
            resource_name="issue",
            event_name="created",
            organization_id=self.organization.id,
            payload=payload,
        )

        # No webhook tasks should be queued
        mock_send_webhook.delay.assert_not_called()

    @patch("sentry.sentry_apps.tasks.sentry_apps.send_resource_change_webhook")
    @patch("sentry.sentry_apps.tasks.sentry_apps.app_service.installations_for_organization")
    def test_broadcast_consolidate_events_integration(self, mock_installations, mock_send_webhook):
        """Test that consolidate_events function is used correctly for filtering."""
        # Mock installation with specific events
        mock_installation = Mock()
        mock_installation.sentry_app.events = ["issue.created", "issue.assigned"]
        mock_installations.return_value = [mock_installation]

        payload = {"event": "data"}

        # Mock consolidate_events to return the expected resource categories
        with patch("sentry.sentry_apps.logic.consolidate_events") as mock_consolidate:
            mock_consolidate.return_value = ["issue"]

            broadcast_webhooks_for_organization(
                resource_name="issue",
                event_name="created",
                organization_id=self.organization.id,
                payload=payload,
            )

            # Verify consolidate_events was called with the installation's events
            mock_consolidate.assert_called_once_with(mock_installation.sentry_app.events)

            # Webhook task should be queued since "issue" is in consolidated events
            mock_send_webhook.delay.assert_called_once_with(
                mock_installation.id, "issue.created", payload
            )

    @patch("sentry.sentry_apps.tasks.sentry_apps.send_resource_change_webhook")
    @patch("sentry.sentry_apps.tasks.sentry_apps.app_service.installations_for_organization")
    def test_broadcast_payload_passed_correctly(self, mock_installations, mock_send_webhook):
        """Test that payload data is passed correctly to send_webhooks."""
        mock_installations.return_value = [self.installation_1]

        complex_payload = {
            "event_id": "12345",
            "timestamp": "2023-01-01T00:00:00Z",
            "issue_data": {
                "id": 67890,
                "title": "Test Issue",
                "metadata": {"type": "error", "value": "Test Error"},
            },
            "nested_list": [1, 2, 3],
            "nested_dict": {"key": "value"},
        }

        broadcast_webhooks_for_organization(
            resource_name="issue",
            event_name="created",
            organization_id=self.organization.id,
            payload=complex_payload,
        )

        # Verify the complete payload is passed to webhook task
        mock_send_webhook.delay.assert_called_once_with(
            self.installation_1.id, "issue.created", complex_payload
        )

    @patch("sentry.sentry_apps.tasks.sentry_apps.send_resource_change_webhook")
    @patch("sentry.sentry_apps.tasks.sentry_apps.app_service.installations_for_organization")
    def test_broadcast_different_organization_ids(self, mock_installations, mock_send_webhook):
        """Test that the correct organization_id is used to fetch installations."""
        different_org = self.create_organization()
        mock_installations.return_value = []

        payload = {"event": "data"}

        broadcast_webhooks_for_organization(
            resource_name="issue",
            event_name="created",
            organization_id=different_org.id,
            payload=payload,
        )

        # Verify installations were fetched for the correct organization
        mock_installations.assert_called_once_with(organization_id=different_org.id)

    def test_event_type_construction(self):
        """Test that event types are constructed correctly."""
        test_cases = [
            ("issue", "created", "issue.created"),
            ("error", "created", "error.created"),
            ("metric_alert", "open", "metric_alert.open"),
            ("event_alert", "triggered", "event_alert.triggered"),
        ]

        for resource_name, event_name, expected_event_type in test_cases:
            constructed_event_type = f"{resource_name}.{event_name}"
            assert constructed_event_type == expected_event_type
            # Verify it's a valid SentryAppEventType
            SentryAppEventType(constructed_event_type)

    @patch("sentry.sentry_apps.tasks.sentry_apps.send_resource_change_webhook")
    @patch("sentry.sentry_apps.tasks.sentry_apps.app_service.installations_for_organization")
    def test_broadcast_handles_send_webhook_exception(self, mock_installations, mock_send_webhook):
        """Test that exceptions from send_resource_change_webhook are properly handled."""
        mock_installations.return_value = [self.installation_1]
        mock_send_webhook.delay.side_effect = Exception("Webhook task failed")

        payload = {"event": "data"}

        # The function should raise the exception from send_resource_change_webhook
        with pytest.raises(Exception, match="Webhook task failed"):
            broadcast_webhooks_for_organization(
                resource_name="issue",
                event_name="created",
                organization_id=self.organization.id,
                payload=payload,
            )

    @patch("sentry.sentry_apps.tasks.sentry_apps.send_resource_change_webhook")
    @patch("sentry.sentry_apps.tasks.sentry_apps.app_service.installations_for_organization")
    def test_broadcast_with_special_characters_in_payload(
        self, mock_installations, mock_send_webhook
    ):
        """Test broadcasting with special characters and unicode in payload."""
        mock_installations.return_value = [self.installation_1]

        payload = {
            "message": "Test with special chars: äöü αβγ 🚀",
            "code": "console.log('Hello \"World\"');",
            "html": "<script>alert('xss')</script>",
            "unicode": "Iñtërnâtiônàlizætiøn",
        }

        broadcast_webhooks_for_organization(
            resource_name="issue",
            event_name="created",
            organization_id=self.organization.id,
            payload=payload,
        )

        mock_send_webhook.delay.assert_called_once_with(
            self.installation_1.id, "issue.created", payload
        )

    @patch("sentry.sentry_apps.tasks.sentry_apps.send_resource_change_webhook")
    @patch("sentry.sentry_apps.tasks.sentry_apps.app_service.installations_for_organization")
    def test_broadcast_with_large_payload(self, mock_installations, mock_send_webhook):
        """Test broadcasting with a large payload."""
        mock_installations.return_value = [self.installation_1]

        # Create a large payload
        large_data = "x" * 10000  # 10KB of data
        payload = {
            "large_field": large_data,
            "array_field": list(range(1000)),
            "nested": {"deep": {"data": large_data}},
        }

        broadcast_webhooks_for_organization(
            resource_name="issue",
            event_name="created",
            organization_id=self.organization.id,
            payload=payload,
        )

        mock_send_webhook.delay.assert_called_once_with(
            self.installation_1.id, "issue.created", payload
        )

    @patch("sentry.sentry_apps.tasks.sentry_apps.send_resource_change_webhook")
    @patch("sentry.sentry_apps.tasks.sentry_apps.app_service.installations_for_organization")
    def test_broadcast_case_sensitive_event_validation(self, mock_installations, mock_send_webhook):
        """Test that event type validation is case sensitive."""
        from sentry.sentry_apps.utils.errors import SentryAppSentryError

        mock_installations.return_value = []

        payload = {"event": "data"}

        # Test case sensitivity - invalid event types should raise exception
        with pytest.raises(SentryAppSentryError):
            broadcast_webhooks_for_organization(
                resource_name="Issue",  # Wrong case
                event_name="Created",  # Wrong case
                organization_id=self.organization.id,
                payload=payload,
            )

    @patch("sentry.sentry_apps.tasks.sentry_apps.send_resource_change_webhook")
    @patch("sentry.sentry_apps.tasks.sentry_apps.app_service.installations_for_organization")
    def test_broadcast_with_empty_payload(self, mock_installations, mock_send_webhook):
        """Test broadcasting with an empty payload."""
        mock_installations.return_value = [self.installation_1]

        empty_payload: dict[str, Any] = {}

        broadcast_webhooks_for_organization(
            resource_name="issue",
            event_name="created",
            organization_id=self.organization.id,
            payload=empty_payload,
        )

        mock_send_webhook.delay.assert_called_once_with(
            self.installation_1.id, "issue.created", empty_payload
        )

    @patch("sentry.sentry_apps.tasks.sentry_apps.send_resource_change_webhook")
    @patch("sentry.sentry_apps.tasks.sentry_apps.app_service.installations_for_organization")
    def test_broadcast_none_values_in_payload(self, mock_installations, mock_send_webhook):
        """Test broadcasting with None values in payload."""
        mock_installations.return_value = [self.installation_1]

        payload = {
            "normal_field": "value",
            "none_field": None,
            "nested": {"also_none": None, "normal": "value"},
        }

        broadcast_webhooks_for_organization(
            resource_name="issue",
            event_name="created",
            organization_id=self.organization.id,
            payload=payload,
        )

        mock_send_webhook.delay.assert_called_once_with(
            self.installation_1.id, "issue.created", payload
        )

    @patch("sentry.sentry_apps.tasks.sentry_apps.app_service.installations_for_organization")
    def test_broadcast_app_service_exception(self, mock_installations):
        """Test handling of exceptions from app_service.installations_for_organization."""
        mock_installations.side_effect = Exception("App service unavailable")

        payload = {"event": "data"}

        with pytest.raises(Exception, match="App service unavailable"):
            broadcast_webhooks_for_organization(
                resource_name="issue",
                event_name="created",
                organization_id=self.organization.id,
                payload=payload,
            )

    @patch("sentry.sentry_apps.tasks.sentry_apps.send_resource_change_webhook")
    @patch("sentry.sentry_apps.tasks.sentry_apps.app_service.installations_for_organization")
    @patch("sentry.sentry_apps.logic.consolidate_events")
    def test_broadcast_consolidate_events_exception(
        self, mock_consolidate, mock_installations, mock_send_webhook
    ):
        """Test handling of exceptions from consolidate_events."""
        mock_installations.return_value = [self.installation_1]
        mock_consolidate.side_effect = Exception("Consolidation failed")

        payload = {"event": "data"}

        with pytest.raises(Exception, match="Consolidation failed"):
            broadcast_webhooks_for_organization(
                resource_name="issue",
                event_name="created",
                organization_id=self.organization.id,
                payload=payload,
            )

    @patch("sentry.sentry_apps.tasks.sentry_apps.send_resource_change_webhook")
    @patch("sentry.sentry_apps.tasks.sentry_apps.app_service.installations_for_organization")
    def test_broadcast_with_negative_organization_id(self, mock_installations, mock_send_webhook):
        """Test broadcasting with negative organization ID."""
        mock_installations.return_value = []

        payload = {"event": "data"}

        broadcast_webhooks_for_organization(
            resource_name="issue", event_name="created", organization_id=-1, payload=payload
        )

        mock_installations.assert_called_once_with(organization_id=-1)

    @patch("sentry.sentry_apps.tasks.sentry_apps.send_resource_change_webhook")
    @patch("sentry.sentry_apps.tasks.sentry_apps.app_service.installations_for_organization")
    def test_broadcast_with_zero_organization_id(self, mock_installations, mock_send_webhook):
        """Test broadcasting with zero organization ID."""
        mock_installations.return_value = []

        payload = {"event": "data"}

        broadcast_webhooks_for_organization(
            resource_name="issue", event_name="created", organization_id=0, payload=payload
        )

        mock_installations.assert_called_once_with(organization_id=0)

    @patch("sentry.sentry_apps.tasks.sentry_apps.send_resource_change_webhook")
    @patch("sentry.sentry_apps.tasks.sentry_apps.app_service.installations_for_organization")
    def test_broadcast_queues_tasks_asynchronously(self, mock_installations, mock_send_webhook):
        """Test that webhook sending is queued as tasks, not executed synchronously."""
        mock_installations.return_value = [self.installation_1, self.installation_2]

        payload = {"test": "data"}

        broadcast_webhooks_for_organization(
            resource_name="issue",
            event_name="created",
            organization_id=self.organization.id,
            payload=payload,
        )

        # Verify .delay() was called (async task queuing), not direct function calls
        assert mock_send_webhook.delay.call_count == 2

        # Verify the regular function was never called directly
        mock_send_webhook.assert_not_called()

        # Verify each installation had a task queued with correct parameters
        mock_send_webhook.delay.assert_any_call(self.installation_1.id, "issue.created", payload)
        mock_send_webhook.delay.assert_any_call(self.installation_2.id, "issue.created", payload)
