from sentry.testutils.cases import TestCase
from sentry.utils.not_set import NOT_SET, default_if_not_set


class ClearFlagTest(TestCase):
    def test(self):
        assert default_if_not_set(1, NOT_SET) == 1
        assert default_if_not_set(1, 2) == 2
