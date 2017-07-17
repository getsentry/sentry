from __future__ import absolute_import

from sentry.constants import INTEGRATION_ID_TO_PLATFORM_DATA, get_integration_id_for_marketing_slug, \
    get_integration_id_for_event
from sentry.testutils import TestCase


class ConstantsTest(TestCase):
    def test_constants(self):
        # verify keys exist in other structures
        pass

    def test_load_platform_data(self):
        # verify platform data was successfully loaded into constants
        integration_id = 'java-android'
        assert integration_id in INTEGRATION_ID_TO_PLATFORM_DATA
        assert 'link' in INTEGRATION_ID_TO_PLATFORM_DATA[integration_id]
        assert 'name' in INTEGRATION_ID_TO_PLATFORM_DATA[integration_id]
        assert INTEGRATION_ID_TO_PLATFORM_DATA[integration_id]['name'] == 'Android'

    def test_marketing_slug_to_integration_id(self):
        assert get_integration_id_for_marketing_slug('java') == 'java'
        # kotlin uses the java library, too
        assert get_integration_id_for_marketing_slug('kotlin') == 'java'
        assert get_integration_id_for_marketing_slug('android') == 'java-android'
        assert get_integration_id_for_marketing_slug('foobar') is None

    def test_integration_id_for_event(self):
        assert get_integration_id_for_event('java', 'sentry-java', None) == 'java'
        assert get_integration_id_for_event('java', 'raven-java', None) == 'java'
        assert get_integration_id_for_event('java', 'raven-java:log4j', None) == 'java-log4j'
        assert get_integration_id_for_event('java', 'sentry-java', ['android']) == 'java-android'
        assert get_integration_id_for_event(
            'java', 'sentry-java', ['foobar', 'log4j2']) == 'java-log4j2'
        assert get_integration_id_for_event('foobar', 'sentry-java', None) == 'java'
        assert get_integration_id_for_event('java', 'foobar', None) == 'java'
        assert get_integration_id_for_event('foobar', 'foobar', None) is None
