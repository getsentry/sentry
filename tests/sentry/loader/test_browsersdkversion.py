from __future__ import absolute_import

from sentry.testutils import TestCase
from sentry.loader.browsersdkversion import (
    get_highest_browser_sdk_version,
    get_browser_sdk_version_versions
)


class BrowserSdkVersionTestCase(TestCase):
    def test_get_browser_sdk_version_versions(self):
        assert 'latest' in get_browser_sdk_version_versions()
        assert '4.x' in get_browser_sdk_version_versions()

    def test_get_highest_browser_sdk_version(self):
        assert get_highest_browser_sdk_version() == '4.x'
