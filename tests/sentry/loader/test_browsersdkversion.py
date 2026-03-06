from unittest import TestCase, mock

from django.test import override_settings

from sentry.loader.browsersdkversion import (
    get_all_browser_sdk_version_versions,
    get_highest_browser_sdk_version,
    match_selected_version_to_browser_sdk_version,
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
    "8.0.1-beta2",
    "8.1.1",
    "10.2.3",
]


class BrowserSdkVersionTestCase(TestCase):
    def test_get_all_browser_sdk_version_versions(self) -> None:
        assert "latest" in get_all_browser_sdk_version_versions()
        assert "4.x" in get_all_browser_sdk_version_versions()

    @mock.patch(
        "sentry.loader.browsersdkversion.load_version_from_file", return_value=MOCK_VERSIONS
    )
    def test_get_highest_browser_sdk_version_from_versions(
        self, load_version_from_file: mock.MagicMock
    ) -> None:
        assert str(get_highest_browser_sdk_version(load_version_from_file())) == "10.2.3"

    @mock.patch(
        "sentry.loader.browsersdkversion.load_version_from_file", return_value=MOCK_VERSIONS
    )
    def test_get_highest_selected_version(self, load_version_from_file: mock.MagicMock) -> None:
        assert str(match_selected_version_to_browser_sdk_version("4.x")) == "4.6.4"
        assert str(match_selected_version_to_browser_sdk_version("5.x")) == "5.10.1"
        assert str(match_selected_version_to_browser_sdk_version("10.x")) == "10.2.3"
        assert (
            str(match_selected_version_to_browser_sdk_version("latest")) == "5.10.1"
        )  # Should not select version 8, since v8 is the first version that doesn't support latest

    @mock.patch("sentry.loader.browsersdkversion.load_version_from_file", return_value=[])
    @override_settings(JS_SDK_LOADER_SDK_VERSION="0.5.2")
    def test_get_highest_selected_version_no_version(
        self, load_version_from_file: mock.MagicMock
    ) -> None:
        assert str(match_selected_version_to_browser_sdk_version("4.x")) == "0.5.2"
        assert str(match_selected_version_to_browser_sdk_version("5.x")) == "0.5.2"
        assert str(match_selected_version_to_browser_sdk_version("latest")) == "0.5.2"
