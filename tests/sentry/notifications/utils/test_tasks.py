from unittest.mock import patch

from sentry.notifications.class_manager import NotificationClassNotSetException, manager, register
from sentry.notifications.utils.tasks import _send_notification, async_send_notification
from sentry.testutils import TestCase
from sentry.testutils.helpers.notifications import AnotherDummyNotification, DummyNotification


class NotificationTaskTests(TestCase):
    def tearDown(self):
        manager.classes.pop("AnotherDummyNotification", None)

    @patch(
        "sentry.testutils.helpers.notifications.AnotherDummyNotification",
    )
    def test_end_to_end(self, notification):
        notification.__name__ = "AnotherDummyNotification"
        register()(notification)
        with self.tasks():
            async_send_notification(AnotherDummyNotification, self.organization, "some_value")

        assert notification.call_args.args == (self.organization, "some_value")
        notification.return_value.send.assert_called_once_with()

    @patch("sentry.notifications.utils.tasks._send_notification.delay")
    def test_call_task(self, mock_delay):
        register()(AnotherDummyNotification)
        async_send_notification(AnotherDummyNotification, self.organization, "some_value")
        assert mock_delay.called_with(
            "AnotherDummyNotification",
            [
                {
                    "type": "model",
                    "app_label": "sentry",
                    "model_name": "organization",
                    "pk": self.organization.pk,
                },
                {"type": "other", "value": "some_value"},
            ],
        )

    @patch(
        "sentry.testutils.helpers.notifications.AnotherDummyNotification",
    )
    def test_send_notification(self, notification):
        notification.__name__ = "AnotherDummyNotification"
        register()(notification)

        _send_notification(
            "AnotherDummyNotification",
            [
                {
                    "type": "model",
                    "app_label": "sentry",
                    "model_name": "organization",
                    "pk": self.organization.pk,
                },
                {"type": "other", "value": "some_value"},
            ],
        )
        assert notification.call_args.args == (self.organization, "some_value")
        notification.return_value.send.assert_called_once_with()

    def test_invalid_notification(self):
        with self.assertRaises(NotificationClassNotSetException):
            async_send_notification(DummyNotification, self.organization, "some_value")
