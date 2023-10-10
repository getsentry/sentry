from unittest import mock

from django.conf import settings

from sentry.loader.browsersdkversion import (
    get_all_browser_sdk_version_versions,
    get_highest_browser_sdk_version,
    match_selected_version_to_browser_sdk_version,
)
from sentry.testutils.cases import TestCase

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
    def test_get_all_browser_sdk_version_versions(self):
        assert "latest" in get_all_browser_sdk_version_versions()
        assert "4.x" in get_all_browser_sdk_version_versions()

    @mock.patch(
        "sentry.loader.browsersdkversion.load_version_from_file", return_value=MOCK_VERSIONS
    )
    def test_get_highest_browser_sdk_version_from_versions(self, load_version_from_file):
        assert str(get_highest_browser_sdk_version(load_version_from_file())) == "5.10.1"

    @mock.patch(
        "sentry.loader.browsersdkversion.load_version_from_file", return_value=MOCK_VERSIONS
    )
    def test_get_highest_selected_version(self, load_version_from_file):
        assert str(match_selected_version_to_browser_sdk_version("4.x")) == "4.6.4"
        assert str(match_selected_version_to_browser_sdk_version("5.x")) == "5.10.1"
        assert str(match_selected_version_to_browser_sdk_version("latest")) == "5.10.1"

    @mock.patch("sentry.loader.browsersdkversion.load_version_from_file", return_value=[])
    def test_get_highest_selected_version_no_version(self, load_version_from_file):
        settings.JS_SDK_LOADER_SDK_VERSION = "0.5.2"
        assert (
            str(match_selected_version_to_browser_sdk_version("4.x"))
            == settings.JS_SDK_LOADER_SDK_VERSION
        )
        assert (
            str(match_selected_version_to_browser_sdk_version("5.x"))
            == settings.JS_SDK_LOADER_SDK_VERSION
        )
        assert (
            str(match_selected_version_to_browser_sdk_version("latest"))
            == settings.JS_SDK_LOADER_SDK_VERSION
        )
