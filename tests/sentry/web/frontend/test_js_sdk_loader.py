from __future__ import absolute_import

from sentry.utils.compat.mock import patch
from exam import fixture
from django.conf import settings
from django.core.urlresolvers import reverse

from sentry.testutils import TestCase


class JavaScriptSdkLoaderTest(TestCase):
    @fixture
    def path(self):
        settings.JS_SDK_LOADER_SDK_VERSION = "0.5.2"
        settings.JS_SDK_LOADER_DEFAULT_SDK_URL = (
            "https://s3.amazonaws.com/getsentry-cdn/@sentry/browser/%s/bundle.min.js"
        )
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
        assert "Vary" not in resp

    def test_absolute_url(self):
        assert (
            reverse("sentry-js-sdk-loader", args=[self.projectkey.public_key, ".min"])
            in self.projectkey.js_sdk_loader_cdn_url
        )
        settings.JS_SDK_LOADER_CDN_URL = "https://js.sentry-cdn.com/"
        assert (
            "https://js.sentry-cdn.com/%s.min.js" % self.projectkey.public_key
        ) == self.projectkey.js_sdk_loader_cdn_url
