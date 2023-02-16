from functools import cached_property

import pytest
from django.conf import settings
from django.urls import reverse

from sentry.testutils import TestCase


class JavaScriptSdkLoaderTest(TestCase):
    @pytest.fixture(autouse=True)
    def set_settings(self):
        settings.JS_SDK_LOADER_SDK_VERSION = "0.5.2"
        settings.JS_SDK_LOADER_DEFAULT_SDK_URL = "https://browser.sentry-cdn.com/%s/bundle%s.min.js"

    @cached_property
    def path(self):
        return reverse("sentry-js-sdk-dynamic-loader", args=[self.projectkey.public_key])

    def test_noop_no_pub_key(self):
        resp = self.client.get(reverse("sentry-js-sdk-dynamic-loader", args=["abc"]))
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/js-sdk-loader-noop.js.tmpl")

    def test_noop(self):
        settings.JS_SDK_LOADER_DEFAULT_SDK_URL = ""
        resp = self.client.get(
            reverse("sentry-js-sdk-dynamic-loader", args=[self.projectkey.public_key])
        )
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/js-sdk-loader-noop.js.tmpl")

    def test_absolute_url(self):
        assert (
            reverse("sentry-js-sdk-dynamic-loader", args=[self.projectkey.public_key, ".min"])
            in self.projectkey.js_sdk_dynamic_loader_cdn_url
        )
        settings.JS_SDK_LOADER_CDN_URL = "https://js.sentry-cdn.com/"
        assert (
            "https://js.sentry-cdn.com/dynamic/%s.min.js" % self.projectkey.public_key
        ) == self.projectkey.js_sdk_dynamic_loader_cdn_url
