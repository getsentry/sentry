import pytest
from django.conf import settings

from sentry.testutils import TestCase


class JavaScriptSdkDynamicLoaderTest(TestCase):
    @pytest.fixture(autouse=True)
    def set_settings(self):
        settings.JS_SDK_LOADER_SDK_VERSION = "7.36.0"
        settings.JS_SDK_LOADER_DEFAULT_SDK_URL = "https://browser.sentry-cdn.com/%s/bundle%s.min.js"

    def test_noop_no_pub_key(self):
        # When given no public key, respond with the noop template
        pass

    def test_noop(self):
        # When given a public key, but no default SDK URL, respond with the noop template
        pass

    def test_no_replace(self):
        # When given a public key, and a default SDK URL, but the SDK version is not set, respond with the noop template
        pass

    def test_renders_js_loader(self):
        # When given a public key, and a default SDK URL, and the SDK version is set, respond with the js loader template
        pass

    def test_minified(self):
        # When given a public key, and a default SDK URL, and the SDK version is set, respond with the minified js loader template
        pass
