from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType


class BaseTestCase(TestCase):
    def setUp(self) -> None:
        self.activity.type = ActivityType.CREATE_ISSUE
