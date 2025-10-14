from unittest import mock

import pytest

from sentry.integrations.types import EventLifecycleOutcome
from sentry.notifications.platform.service import NotificationService, NotificationServiceError
from sentry.notifications.platform.target import (
    GenericNotificationTarget,
    IntegrationNotificationTarget,
)
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationTargetResourceType,
)
from sentry.shared_integrations.exceptions import ApiError
from sentry.testutils.asserts import assert_count_of_metric
from sentry.testutils.cases import TestCase
from sentry.testutils.notifications.platform import (
    MockNotification,
    MockNotificationTemplate,
    MockStrategy,
)


class NotificationServiceTest(TestCase):
    def setUp(self) -> None:
        self.target = GenericNotificationTarget(
            provider_key=NotificationProviderKey.EMAIL,
            resource_type=NotificationTargetResourceType.EMAIL,
            resource_id="test@example.com",
        )

        self.slack_integration = self.create_integration(
            organization=self.organization, provider="slack", external_id="ext-123"
        )
        self.integration_target = IntegrationNotificationTarget(
            provider_key=NotificationProviderKey.SLACK,
            resource_type=NotificationTargetResourceType.CHANNEL,
            resource_id="C1234567890",
            integration_id=self.slack_integration.id,
            organization_id=self.organization.id,
        )
        self.template = MockNotificationTemplate()

    def test_basic_notify(self) -> None:
        service = NotificationService(data=MockNotification(message="this is a test notification"))
        service.notify(targets=[self.target], sync_send=True)

    @mock.patch("sentry.notifications.platform.service.logger")
    def test_validation_on_notify(self, mock_logger: mock.MagicMock) -> None:
        service = NotificationService(data=MockNotification(message="this is a test notification"))
        with pytest.raises(
            NotificationServiceError,
            match="Must provide either a strategy or targets. Strategy is preferred.",
        ):
            service.notify()

        strategy = MockStrategy(targets=[])
        with pytest.raises(
            NotificationServiceError,
            match="Cannot provide both strategy and targets, only one is permitted. Strategy is preferred.",
        ):
            service.notify(strategy=strategy, targets=[self.target])

        service.notify(strategy=strategy)
        mock_logger.info.assert_called_once_with(
            "Strategy '%s' did not yield targets", strategy.__class__.__name__
        )

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_basic_notify_target_async(self, mock_record: mock.MagicMock) -> None:
        service = NotificationService(data=MockNotification(message="this is a test notification"))
        with self.tasks():
            service.notify(targets=[self.target], sync_send=False)

        # slo asserts
        assert_count_of_metric(mock_record, EventLifecycleOutcome.STARTED, 1)
        assert_count_of_metric(mock_record, EventLifecycleOutcome.SUCCESS, 1)

    @mock.patch("sentry.notifications.platform.email.provider.EmailNotificationProvider.send")
    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_notify_target_async_with_api_error(
        self, mock_record: mock.MagicMock, mock_send: mock.MagicMock
    ) -> None:
        mock_send.side_effect = ApiError("API request failed", 400)
        service = NotificationService(data=MockNotification(message="this is a test notification"))
        with self.tasks():
            service.notify(targets=[self.target], sync_send=False)

        # slo asserts
        assert_count_of_metric(mock_record, EventLifecycleOutcome.STARTED, 1)
        assert_count_of_metric(mock_record, EventLifecycleOutcome.FAILURE, 1)

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @mock.patch("sentry.notifications.platform.slack.provider.SlackNotificationProvider.send")
    def test_basic_notify_integration_target_async(
        self, mock_slack_send: mock.MagicMock, mock_record: mock.MagicMock
    ) -> None:
        service = NotificationService(data=MockNotification(message="this is a test notification"))
        with self.tasks():
            service.notify(targets=[self.integration_target], sync_send=False)

        # slo asserts
        assert_count_of_metric(mock_record, EventLifecycleOutcome.STARTED, 1)
        assert_count_of_metric(mock_record, EventLifecycleOutcome.SUCCESS, 1)

    @mock.patch("sentry.notifications.platform.slack.provider.SlackNotificationProvider.send")
    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_notify_integration_target_async_with_api_error(
        self, mock_record: mock.MagicMock, mock_send: mock.MagicMock
    ) -> None:
        mock_send.side_effect = ApiError("Slack API request failed", 400)
        service = NotificationService(data=MockNotification(message="this is a test notification"))
        with self.tasks():
            service.notify(targets=[self.integration_target], sync_send=False)

        # slo asserts
        assert_count_of_metric(mock_record, EventLifecycleOutcome.STARTED, 1)
        assert_count_of_metric(mock_record, EventLifecycleOutcome.FAILURE, 1)

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @mock.patch("sentry.notifications.platform.slack.provider.SlackNotificationProvider.send")
    @mock.patch("sentry.notifications.platform.email.provider.EmailNotificationProvider.send")
    def test_notify_mixed_targets_async(
        self,
        mock_email_send: mock.MagicMock,
        mock_slack_send: mock.MagicMock,
        mock_record: mock.MagicMock,
    ) -> None:
        """Test sending notifications to both generic and integration targets"""
        service = NotificationService(data=MockNotification(message="this is a test notification"))
        with self.tasks():
            service.notify(targets=[self.target, self.integration_target], sync_send=False)

        # slo asserts - should have 2 notifications sent
        assert_count_of_metric(mock_record, EventLifecycleOutcome.STARTED, 2)
        assert_count_of_metric(mock_record, EventLifecycleOutcome.SUCCESS, 2)
