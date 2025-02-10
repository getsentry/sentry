from sentry.testutils.cases import TestCase
from sentry.utils.not_set import NOT_SET, get_current_value_if_not_set


class ClearFlagTest(TestCase):
    def test(self):
        assert get_current_value_if_not_set(1, NOT_SET) == 1
        assert get_current_value_if_not_set(1, 2) == 2
