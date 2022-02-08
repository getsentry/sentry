from sentry.notifications.class_manager import (
    NotificationClassAlreadySetException,
    get,
    manager,
    register,
)
from sentry.testutils import TestCase
from sentry.testutils.helpers.notifications import AnotherDummyNotification


class ClassManagerTest(TestCase):
    def tearDown(self):
        manager.classes.pop("AnotherDummyNotification", None)

    def test_register(self):
        register()(AnotherDummyNotification)
        assert get("AnotherDummyNotification") == AnotherDummyNotification

    def test_duplicate_register(self):
        register()(AnotherDummyNotification)
        with self.assertRaises(NotificationClassAlreadySetException):
            register()(AnotherDummyNotification)
