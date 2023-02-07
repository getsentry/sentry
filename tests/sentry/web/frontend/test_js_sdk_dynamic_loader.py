# import pytest

from sentry.testutils import TestCase


class JavaScriptSdkDynamicLoaderTest(TestCase):
    def test_noop_no_pub_key(self):
        # When given no public key, respond with the noop template
        pass

    def test_noop(self):
        # When given a public key, but no default SDK URL, respond with the noop template
        pass
