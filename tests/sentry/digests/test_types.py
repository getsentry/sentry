from typing import int
import uuid
from unittest import mock

from sentry.digests.types import Notification


class TestNotificationTuple:
    def test_missing_notification_uuid(self) -> None:
        notification = Notification(mock.sentinel.rule, mock.sentinel.group)
        assert notification.notification_uuid is None

    def test_notification_uuid(self) -> None:
        notification = Notification(
            mock.sentinel.rule, mock.sentinel.group, notification_uuid=str(uuid.uuid4())
        )
        assert notification.notification_uuid is not None
