from functools import cached_property
from unittest import mock
from unittest.mock import patch

import pytest
from django.conf import settings
from django.urls import reverse

from sentry.loader.dynamic_sdk_options import DynamicSdkLoaderOption
from sentry.testutils.cases import TestCase
from sentry.utils import json


class JavaScriptSdkLoaderTest(TestCase):
    @pytest.fixture(autouse=True)
    def set_settings(self):
        settings.JS_SDK_LOADER_SDK_VERSION = "0.5.2"
        settings.JS_SDK_LOADER_DEFAULT_SDK_URL = (
            "https://s3.amazonaws.com/getsentry-cdn/@sentry/browser/%s/bundle.min.js"
        )

    @cached_property
    def path(self):
        return reverse("sentry-js-sdk-loader", args=[self.projectkey.public_key])

    def test_noop_no_pub_key(self):
        resp = self.client.get(reverse("sentry-js-sdk-loader", args=["abc"]))
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/js-sdk-loader-noop.js.tmpl")

    def test_noop(self):
        settings.JS_SDK_LOADER_DEFAULT_SDK_URL = ""
        resp = self.client.get(reverse("sentry-js-sdk-loader", args=[self.projectkey.public_key]))
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/js-sdk-loader-noop.js.tmpl")

    def test_no_replace(self):
        settings.JS_SDK_LOADER_SDK_VERSION = "0.5.2"
        settings.JS_SDK_LOADER_DEFAULT_SDK_URL = (
            "https://s3.amazonaws.com/getsentry-cdn/@sentry/browser/0.0.0/bundle.min.js"
        )
        resp = self.client.get(reverse("sentry-js-sdk-loader", args=[self.projectkey.public_key]))
        assert resp.status_code == 200
        assert settings.JS_SDK_LOADER_DEFAULT_SDK_URL.encode("utf-8") in resp.content
        self.assertTemplateUsed(resp, "sentry/js-sdk-loader.js.tmpl")

    def test_renders_js_loader(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/js-sdk-loader.js.tmpl")
        assert self.projectkey.public_key.encode("utf-8") in resp.content
        assert b"bundle.min.js" in resp.content

    def test_minified(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        min_resp = self.client.get(
            reverse("sentry-js-sdk-loader", args=[self.projectkey.public_key, ".min"])
        )
        assert min_resp.status_code == 200
        self.assertTemplateUsed(min_resp, "sentry/js-sdk-loader.min.js.tmpl")
        assert self.projectkey.public_key.encode("utf-8") in min_resp.content
        assert b"bundle.min.js" in min_resp.content
        assert len(resp.content) > len(min_resp.content)

    @mock.patch(
        "sentry.loader.browsersdkversion.load_version_from_file", return_value=["6.19.7", "7.0.0"]
    )
    @mock.patch(
        "sentry.loader.browsersdkversion.get_selected_browser_sdk_version", return_value="6.x"
    )
    def test_less_than_v7_returns_es6(
        self, load_version_from_file, get_selected_browser_sdk_version
    ):
        settings.JS_SDK_LOADER_DEFAULT_SDK_URL = "https://browser.sentry-cdn.com/%s/bundle%s.min.js"
        self.projectkey.data = {}
        self.projectkey.save()
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/js-sdk-loader.js.tmpl")
        assert b"/6.19.7/bundle.min.js" in resp.content

    @mock.patch(
        "sentry.loader.browsersdkversion.load_version_from_file", return_value=["6.19.7", "7.0.0"]
    )
    @mock.patch(
        "sentry.loader.browsersdkversion.get_selected_browser_sdk_version", return_value="7.x"
    )
    def test_equal_to_v7_returns_es5(
        self, load_version_from_file, get_selected_browser_sdk_version
    ):
        settings.JS_SDK_LOADER_DEFAULT_SDK_URL = "https://browser.sentry-cdn.com/%s/bundle%s.min.js"
        self.projectkey.data = {}
        self.projectkey.save()
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/js-sdk-loader.js.tmpl")
        assert b"/7.0.0/bundle.es5.min.js" in resp.content

    @mock.patch("sentry.loader.browsersdkversion.load_version_from_file", return_value=["7.3.15"])
    @mock.patch(
        "sentry.loader.browsersdkversion.get_selected_browser_sdk_version", return_value="7.x"
    )
    def test_greater_than_v7_returns_es5(
        self, load_version_from_file, get_selected_browser_sdk_version
    ):
        settings.JS_SDK_LOADER_DEFAULT_SDK_URL = "https://browser.sentry-cdn.com/%s/bundle%s.min.js"
        self.projectkey.data = {}
        self.projectkey.save()
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/js-sdk-loader.js.tmpl")
        assert b"/7.3.15/bundle.es5.min.js" in resp.content

    @mock.patch("sentry.loader.browsersdkversion.load_version_from_file", return_value=["7.37.0"])
    @mock.patch(
        "sentry.loader.browsersdkversion.get_selected_browser_sdk_version", return_value="7.x"
    )
    def test_returns_es6_with_defaults(
        self, load_version_from_file, get_selected_browser_sdk_version
    ):
        settings.JS_SDK_LOADER_DEFAULT_SDK_URL = "https://browser.sentry-cdn.com/%s/bundle%s.min.js"
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/js-sdk-loader.js.tmpl")
        assert b"/7.37.0/bundle.tracing.replay.min.js" in resp.content

    @mock.patch(
        "sentry.loader.browsersdkversion.load_version_from_file",
        return_value=["8.1.0", "7.1.0", "7.0.1", "6.1.0"],
    )
    @mock.patch(
        "sentry.loader.browsersdkversion.get_selected_browser_sdk_version", return_value="latest"
    )
    def test_returns_latest_pre_v8_version_when_latest_is_selected(
        self, load_version_from_file, get_selected_browser_sdk_version
    ):
        settings.JS_SDK_LOADER_DEFAULT_SDK_URL = "https://browser.sentry-cdn.com/%s/bundle%s.min.js"
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/js-sdk-loader.js.tmpl")
        assert b"/7.1.0/bundle.tracing.replay.min.js" in resp.content

    @mock.patch(
        "sentry.loader.browsersdkversion.load_version_from_file",
        return_value=["9.1.0", "8.1.0", "6.1.0", "5.0.0"],
    )
    @mock.patch(
        "sentry.loader.browsersdkversion.get_selected_browser_sdk_version", return_value="latest"
    )
    def test_returns_latest_pre_v8_version_when_latest_is_selected_with_no_available_v7_version(
        self, load_version_from_file, get_selected_browser_sdk_version
    ):
        settings.JS_SDK_LOADER_DEFAULT_SDK_URL = "https://browser.sentry-cdn.com/%s/bundle%s.min.js"
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/js-sdk-loader.js.tmpl")
        assert b"/6.1.0/bundle.min.js" in resp.content

    @mock.patch(
        "sentry.loader.browsersdkversion.load_version_from_file",
        return_value=["8.1.0", "8.0.0", "8", "8.0.0-alpha.0", "7.100.0", "6.1.0", "5.0.0"],
    )
    @mock.patch(
        "sentry.loader.browsersdkversion.get_selected_browser_sdk_version", return_value="latest"
    )
    def test_returns_latest_pre_v8_version_when_latest_is_selected_various_v8_versions_available(
        self, load_version_from_file, get_selected_browser_sdk_version
    ):
        settings.JS_SDK_LOADER_DEFAULT_SDK_URL = "https://browser.sentry-cdn.com/%s/bundle%s.min.js"
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/js-sdk-loader.js.tmpl")
        assert b"/7.100.0/bundle.tracing.replay.min.js" in resp.content

    @mock.patch(
        "sentry.loader.browsersdkversion.load_version_from_file",
        return_value=["8.0.0"],
    )
    @mock.patch(
        "sentry.loader.browsersdkversion.get_selected_browser_sdk_version", return_value="8.x"
    )
    def test_equal_to_v8_returns_default_bundle(
        self, load_version_from_file, get_selected_browser_sdk_version
    ):
        settings.JS_SDK_LOADER_DEFAULT_SDK_URL = "https://browser.sentry-cdn.com/%s/bundle%s.min.js"
        self.projectkey.data = {}
        self.projectkey.save()
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/js-sdk-loader.js.tmpl")
        assert b"/8.0.0/bundle.min.js" in resp.content

    @mock.patch(
        "sentry.loader.browsersdkversion.load_version_from_file",
        return_value=["8.1.0", "8.0.0", "8", "8.0.0-alpha.0"],
    )
    @mock.patch(
        "sentry.loader.browsersdkversion.get_selected_browser_sdk_version", return_value="8.x"
    )
    def test_returns_latest_v8_version_when_various_v8_versions_available(
        self, load_version_from_file, get_selected_browser_sdk_version
    ):
        settings.JS_SDK_LOADER_DEFAULT_SDK_URL = "https://browser.sentry-cdn.com/%s/bundle%s.min.js"
        self.projectkey.data = {}
        self.projectkey.save()
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/js-sdk-loader.js.tmpl")
        assert b"/8.1.0/bundle.min.js" in resp.content

    @mock.patch("sentry.loader.browsersdkversion.load_version_from_file", return_value=["7.37.0"])
    @mock.patch(
        "sentry.loader.browsersdkversion.get_selected_browser_sdk_version", return_value="7.x"
    )
    def test_bundle_kind_modifiers(self, load_version_from_file, get_selected_browser_sdk_version):
        settings.JS_SDK_LOADER_DEFAULT_SDK_URL = "https://browser.sentry-cdn.com/%s/bundle%s.min.js"
        settings.JS_SDK_LOADER_SDK_VERSION = "7.32.0"

        dsn = self.projectkey.get_dsn(public=True)

        for data, expected_bundle, expected_options in [
            (
                {
                    "dynamicSdkLoaderOptions": {
                        DynamicSdkLoaderOption.HAS_PERFORMANCE.value: True,
                    }
                },
                b"/7.37.0/bundle.tracing.es5.min.js",
                {"dsn": dsn, "tracesSampleRate": 1},
            ),
            (
                {
                    "dynamicSdkLoaderOptions": {
                        DynamicSdkLoaderOption.HAS_DEBUG.value: True,
                    }
                },
                b"/7.37.0/bundle.es5.debug.min.js",
                {"dsn": dsn, "debug": True},
            ),
            (
                {
                    "dynamicSdkLoaderOptions": {
                        DynamicSdkLoaderOption.HAS_REPLAY.value: True,
                    }
                },
                b"/7.37.0/bundle.replay.min.js",
                {"dsn": dsn, "replaysSessionSampleRate": 0.1, "replaysOnErrorSampleRate": 1},
            ),
            (
                {
                    "dynamicSdkLoaderOptions": {
                        DynamicSdkLoaderOption.HAS_PERFORMANCE.value: True,
                        DynamicSdkLoaderOption.HAS_REPLAY.value: True,
                    }
                },
                b"/7.37.0/bundle.tracing.replay.min.js",
                {
                    "dsn": dsn,
                    "tracesSampleRate": 1,
                    "replaysSessionSampleRate": 0.1,
                    "replaysOnErrorSampleRate": 1,
                },
            ),
            (
                {
                    "dynamicSdkLoaderOptions": {
                        DynamicSdkLoaderOption.HAS_REPLAY.value: True,
                        DynamicSdkLoaderOption.HAS_DEBUG.value: True,
                    }
                },
                b"/7.37.0/bundle.replay.debug.min.js",
                {
                    "dsn": dsn,
                    "replaysSessionSampleRate": 0.1,
                    "replaysOnErrorSampleRate": 1,
                    "debug": True,
                },
            ),
            (
                {
                    "dynamicSdkLoaderOptions": {
                        DynamicSdkLoaderOption.HAS_PERFORMANCE.value: True,
                        DynamicSdkLoaderOption.HAS_DEBUG.value: True,
                    }
                },
                b"/7.37.0/bundle.tracing.es5.debug.min.js",
                {"dsn": dsn, "tracesSampleRate": 1, "debug": True},
            ),
            (
                {
                    "dynamicSdkLoaderOptions": {
                        DynamicSdkLoaderOption.HAS_PERFORMANCE.value: True,
                        DynamicSdkLoaderOption.HAS_DEBUG.value: True,
                        DynamicSdkLoaderOption.HAS_REPLAY.value: True,
                    }
                },
                b"/7.37.0/bundle.tracing.replay.debug.min.js",
                {
                    "dsn": dsn,
                    "tracesSampleRate": 1,
                    "replaysSessionSampleRate": 0.1,
                    "replaysOnErrorSampleRate": 1,
                    "debug": True,
                },
            ),
        ]:
            self.projectkey.data = data
            self.projectkey.save()
            resp = self.client.get(self.path)
            assert resp.status_code == 200
            self.assertTemplateUsed(resp, "sentry/js-sdk-loader.js.tmpl")
            assert expected_bundle in resp.content

            for key in expected_options:
                # Convert to e.g. "option_name": 0.1
                single_option = {key: expected_options[key]}
                assert json.dumps(single_option)[1:-1].encode() in resp.content

            self.projectkey.data = {}
            self.projectkey.save()

    @patch("sentry.loader.browsersdkversion.load_version_from_file")
    def test_headers(self, mock_load_version_from_file):
        #  We want to always load the major version here since otherwise we fall back to
        #  the default value which isn't correct.
        mocked_version = "4.9.9"
        mock_load_version_from_file.return_value = [mocked_version]

        resp = self.client.get(self.path)
        assert resp.status_code == 200, resp
        assert "*" in resp["Access-Control-Allow-Origin"]
        assert "stale-if-error" in resp["Cache-Control"]
        assert "stale-while-revalidate" in resp["Cache-Control"]
        assert "s-maxage" in resp["Cache-Control"]
        assert "max-age" in resp["Cache-Control"]
        assert "project/%s" % self.projectkey.project_id in resp["Surrogate-Key"]
        assert "sdk/" in resp["Surrogate-Key"]
        assert "sdk-loader" in resp["Surrogate-Key"]
        assert "Content-Encoding" not in resp
        assert "Set-Cookie" not in resp
        assert "Vary" not in resp, f"Found Vary header: {resp['Vary']}"

    def test_absolute_url(self):
        assert (
            reverse("sentry-js-sdk-loader", args=[self.projectkey.public_key, ".min"])
            in self.projectkey.js_sdk_loader_cdn_url
        )
        settings.JS_SDK_LOADER_CDN_URL = "https://js.sentry-cdn.com/"
        assert (
            "https://js.sentry-cdn.com/%s.min.js" % self.projectkey.public_key
        ) == self.projectkey.js_sdk_loader_cdn_url
