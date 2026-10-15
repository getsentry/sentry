import uuid
from unittest import mock

from sentry.digests.types import IdentifierKey, Notification


class TestNotificationTuple:
    def test_default_identifier_key(self) -> None:
        notification = Notification(mock.sentinel.event)
        assert notification.identifier_key == IdentifierKey.WORKFLOW

    def test_pickle_shape_remains_compatible(self) -> None:
        notification = Notification(mock.sentinel.event, [mock.sentinel.workflow_id])
        assert len(notification) == 4

    def test_missing_notification_uuid(self) -> None:
        notification = Notification(mock.sentinel.rule, mock.sentinel.group)
        assert notification.notification_uuid is None

    def test_notification_uuid(self) -> None:
        notification = Notification(
            mock.sentinel.rule, mock.sentinel.group, notification_uuid=str(uuid.uuid4())
        )
        assert notification.notification_uuid is not None
