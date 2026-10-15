import pickle
import uuid
from unittest import mock

from sentry.digests.types import IdentifierKey, Notification


class TestNotificationTuple:
    def test_default_identifier_key(self) -> None:
        notification = Notification(mock.sentinel.event)
        assert notification.identifier_key == IdentifierKey.WORKFLOW

    def test_pickle_shape_remains_compatible(self) -> None:
        values = (mock.sentinel.event, [123], "notification-uuid", IdentifierKey.WORKFLOW)

        class PickledNotificationTuple(tuple):
            def __reduce__(self) -> tuple[type[Notification], tuple[object, ...]]:
                # Pickle reconstructs a NamedTuple by passing its values positionally. Returning
                # Notification here simulates loading the four-field representation already in
                # Redis without relying on an opaque snapshot of historical pickle bytes.
                return Notification, tuple(self)

        payload = pickle.dumps(PickledNotificationTuple(values))
        try:
            notification = pickle.loads(payload)
        except TypeError as error:
            raise AssertionError(
                "Notification can no longer deserialize its deployed four-field pickle shape"
            ) from error

        assert notification._fields == (
            "event",
            "rules",
            "notification_uuid",
            "identifier_key",
        ), "Notification's field order changed; this breaks pickle compatibility"
        assert tuple(notification) == values, (
            "Notification's field count changed; this breaks pickle compatibility"
        )

    def test_missing_notification_uuid(self) -> None:
        notification = Notification(mock.sentinel.rule, mock.sentinel.group)
        assert notification.notification_uuid is None

    def test_notification_uuid(self) -> None:
        notification = Notification(
            mock.sentinel.rule, mock.sentinel.group, notification_uuid=str(uuid.uuid4())
        )
        assert notification.notification_uuid is not None
