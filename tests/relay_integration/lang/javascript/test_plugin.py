from __future__ import absolute_import

import pytest

from sentry.testutils import RelayStoreHelper, TransactionTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format

from ....sentry.lang.javascript.test_plugin import JavascriptIntegrationTest


@pytest.mark.relay_store_integration
class JavascriptIntegrationTestRelay(
    RelayStoreHelper, TransactionTestCase, JavascriptIntegrationTest
):
    def setUp(self):
        super(JavascriptIntegrationTestRelay, self).setUp()
        self.min_ago = iso_format(before_now(minutes=1))
