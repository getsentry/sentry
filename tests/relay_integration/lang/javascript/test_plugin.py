from __future__ import absolute_import
import pytest

from tests.sentry.lang.javascript.test_plugin import JavascriptIntegrationTest
from sentry.testutils import RelayStoreHelper, TransactionTestCase
from sentry.testutils.helpers.datetime import iso_format, before_now


@pytest.mark.relay_store_integration
class JavascriptIntegrationTestRelay(
    RelayStoreHelper, TransactionTestCase, JavascriptIntegrationTest
):
    def setUp(self):
        super(JavascriptIntegrationTestRelay, self).setUp()
        self.min_ago = iso_format(before_now(minutes=1))
