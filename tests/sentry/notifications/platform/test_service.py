from typing import Any
from unittest import mock

import pytest

from sentry.notifications.platform.service import NotificationService, NotificationServiceError
from sentry.notifications.platform.target import GenericNotificationTarget, prepare_targets
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationTargetResourceType,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.notifications.platform import (
    MockNotification,
    MockNotificationTemplate,
    MockStrategy,
)


class NotificationServiceTest(TestCase):
    def setUp(self):
        self.target = GenericNotificationTarget(
            provider_key=NotificationProviderKey.EMAIL,
            resource_type=NotificationTargetResourceType.EMAIL,
            resource_id="test@example.com",
        )
        self.template = MockNotificationTemplate()

    def test_basic_notify(self):
        service = NotificationService(data=MockNotification(message="this is a test notification"))
        service.notify(targets=[self.target])

    @mock.patch("sentry.notifications.platform.service.logger")
    def test_validation_on_notify(self, mock_logger):
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

    def test_basic_notify_prepared_target(self):
        service = NotificationService(data=MockNotification(message="this is a test notification"))
        prepare_targets([self.target])
        service.notify_prepared_target(target=self.target)

    def test_validation_on_notify_prepared_target(self):
        empty_data_service: NotificationService[Any] = NotificationService(data=None)
        with pytest.raises(
            NotificationServiceError,
            match="Notification service must be initialized with data before sending!",
        ):
            empty_data_service.notify_prepared_target(target=self.target)

        service = NotificationService(data=MockNotification(message="this is a test notification"))
        with pytest.raises(
            NotificationServiceError,
            match="Target must have `prepare_targets` called prior to sending",
        ):
            service.notify_prepared_target(target=self.target)
