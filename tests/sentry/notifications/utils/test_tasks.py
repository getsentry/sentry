from unittest.mock import patch

import pytest

from sentry.notifications.class_manager import NotificationClassNotSetException, manager, register
from sentry.notifications.utils.tasks import _send_notification, async_send_notification
from sentry.testutils.cases import TestCase
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
        mock_delay.assert_called_with(
            "AnotherDummyNotification",
            [
                {
                    "type": "model",
                    "app_label": "sentry",
                    "model_name": "organization",
                    "pk": self.organization.pk,
                    "key": None,
                },
                {"type": "other", "value": "some_value", "key": None},
            ],
        )

    @patch("sentry.notifications.utils.tasks._send_notification.delay")
    def test_call_task_with_kwargs(self, mock_delay):
        register()(AnotherDummyNotification)
        async_send_notification(
            AnotherDummyNotification, "some_value", organization=self.organization, foo="bar"
        )
        mock_delay.assert_called_with(
            "AnotherDummyNotification",
            [
                {"type": "other", "value": "some_value", "key": None},
                {
                    "type": "model",
                    "app_label": "sentry",
                    "model_name": "organization",
                    "pk": self.organization.pk,
                    "key": "organization",
                },
                {"type": "other", "value": "bar", "key": "foo"},
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
                {"type": "other", "value": "some_value", "key": None},
                {
                    "type": "model",
                    "app_label": "sentry",
                    "model_name": "organization",
                    "pk": self.organization.pk,
                    "key": "organization",
                },
                {"type": "other", "value": "bar", "key": "foo"},
            ],
        )
        assert notification.call_args.args == ("some_value",)
        assert list(notification.call_args.kwargs.keys()) == ["organization", "foo"]
        notification.return_value.send.assert_called_once_with()

    def test_invalid_notification(self):
        with pytest.raises(NotificationClassNotSetException):
            async_send_notification(DummyNotification, self.organization, "some_value")
