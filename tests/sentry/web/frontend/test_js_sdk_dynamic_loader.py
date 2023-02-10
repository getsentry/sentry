from django.conf import settings
from django.urls import reverse

from sentry.testutils import TestCase


class JavaScriptSdkLoaderTest(TestCase):
    def test_absolute_url(self):
        assert (
            reverse("sentry-js-sdk-dynamic-loader", args=[self.projectkey.public_key, ".min"])
            in self.projectkey.js_sdk_dynamic_loader_cdn_url
        )
        settings.JS_SDK_LOADER_CDN_URL = "https://js.sentry-cdn.com/"
        assert (
            "https://js.sentry-cdn.com/dynamic/%s.min.js" % self.projectkey.public_key
        ) == self.projectkey.js_sdk_dynamic_loader_cdn_url
