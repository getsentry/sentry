from unittest.mock import patch

from sentry.notifications.class_manager import manager, register
from sentry.notifications.utils.tasks import _send_notification, async_execute
from sentry.testutils import TestCase
from sentry.testutils.helpers.notifications import AnotherDummyNotification


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
            async_execute(AnotherDummyNotification, self.organization, "some_value")

        assert notification.call_args.args == (self.organization, "some_value")
        notification.return_value.send.assert_called_once_with()

    @patch("sentry.notifications.utils.tasks._send_notification.delay")
    def test_call_task(self, mock_delay):
        async_execute(AnotherDummyNotification, self.organization, "some_value")
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
