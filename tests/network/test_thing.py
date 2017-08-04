from __future__ import absolute_import

from sentry.constants import INTEGRATION_ID_TO_PLATFORM_DATA
from sentry.testutils import TestCase


class ThingTest(TestCase):
    def test_thing(self):
        assert len(INTEGRATION_ID_TO_PLATFORM_DATA) > 0
