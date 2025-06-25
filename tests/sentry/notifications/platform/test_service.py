from dataclasses import dataclass
from typing import Any
from unittest import mock

import pytest

from sentry.notifications.platform.service import NotificationService, NotificationServiceError
from sentry.notifications.platform.target import GenericNotificationTarget, prepare_targets
from sentry.notifications.platform.types import (
    NotificationCategory,
    NotificationData,
    NotificationProviderKey,
    NotificationRenderedTemplate,
    NotificationSource,
    NotificationStrategy,
    NotificationTarget,
    NotificationTargetResourceType,
    NotificationTemplate,
)
from sentry.testutils.cases import TestCase


@dataclass(kw_only=True, frozen=True)
class MockNotification(NotificationData):
    category = NotificationCategory.DEBUG
    source = NotificationSource.TEST
    message: str


class MockNotificationTemplate(NotificationTemplate[MockNotification]):
    def process(self, *, data: MockNotification) -> NotificationRenderedTemplate:
        return data.message


class MockStrategy(NotificationStrategy):
    def __init__(self, *, targets: list[NotificationTarget]):
        self.targets = targets

    def get_targets(self) -> list[NotificationTarget]:
        return self.targets


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
        service.notify(
            targets=[self.target],
            template=self.template,
        )

    @mock.patch("sentry.notifications.platform.service.logger")
    def test_validation_on_notify(self, mock_logger):
        service = NotificationService(data=MockNotification(message="this is a test notification"))
        with pytest.raises(
            NotificationServiceError,
            match="Must provide either a strategy or targets. Strategy is preferred.",
        ):
            service.notify(template=self.template)

        strategy = MockStrategy(targets=[])
        with pytest.raises(
            NotificationServiceError,
            match="Cannot provide both strategy and targets, only one is permitted. Strategy is preferred.",
        ):
            service.notify(strategy=strategy, targets=[self.target], template=self.template)

        service.notify(strategy=strategy, template=self.template)
        mock_logger.info.assert_called_once_with(
            "Strategy '%s' did not yield targets", strategy.__class__.__name__
        )

    def test_basic_notify_prepared_target(self):
        service = NotificationService(data=MockNotification(message="this is a test notification"))
        prepare_targets([self.target])
        service.notify_prepared_target(
            target=self.target,
            template=self.template,
        )

    def test_validation_on_notify_prepared_target(self):
        empty_data_service: NotificationService[Any] = NotificationService(data=None)
        with pytest.raises(
            NotificationServiceError,
            match="Notification service must be initialized with data before sending!",
        ):
            empty_data_service.notify_prepared_target(target=self.target, template=self.template)

        service = NotificationService(data=MockNotification(message="this is a test notification"))
        with pytest.raises(
            NotificationServiceError,
            match="Target must have `prepare_targets` called prior to sending",
        ):
            service.notify_prepared_target(
                target=self.target,
                template=self.template,
            )
