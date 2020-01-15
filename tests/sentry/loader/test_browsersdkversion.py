from __future__ import absolute_import

from sentry.utils.compat import mock

from django.conf import settings
from sentry.testutils import TestCase
from sentry.loader.browsersdkversion import (
    get_highest_browser_sdk_version,
    get_browser_sdk_version_versions,
    get_highest_selected_browser_sdk_version,
)


MOCK_VERSIONS = [
    "4.0.0-rc.1",
    "4.6.4",
    "4.7.4-beta1",
    "5.0.0",
    "5.0.1",
    "5.0.2-beta1",
    "5.1.1",
    "5.10.1",
]


class BrowserSdkVersionTestCase(TestCase):
    def test_get_browser_sdk_version_versions(self):
        assert "latest" in get_browser_sdk_version_versions()
        assert "4.x" in get_browser_sdk_version_versions()

    @mock.patch(
        "sentry.loader.browsersdkversion.load_version_from_file", return_value=MOCK_VERSIONS
    )
    def test_get_highest_browser_sdk_version_from_versions(self, load_version_from_file):
        assert get_highest_browser_sdk_version(load_version_from_file()) == "5.10.1"

    @mock.patch(
        "sentry.loader.browsersdkversion.load_version_from_file", return_value=MOCK_VERSIONS
    )
    def test_get_highest_selected_version(self, load_version_from_file):
        assert get_highest_selected_browser_sdk_version("4.x") == "4.6.4"
        assert get_highest_selected_browser_sdk_version("5.x") == "5.10.1"
        assert get_highest_selected_browser_sdk_version("latest") == "5.10.1"

    @mock.patch("sentry.loader.browsersdkversion.load_version_from_file", return_value=[])
    def test_get_highest_selected_version_no_version(self, load_version_from_file):
        assert get_highest_selected_browser_sdk_version("4.x") == settings.JS_SDK_LOADER_SDK_VERSION
        assert get_highest_selected_browser_sdk_version("5.x") == settings.JS_SDK_LOADER_SDK_VERSION
        assert (
            get_highest_selected_browser_sdk_version("latest") == settings.JS_SDK_LOADER_SDK_VERSION
        )
