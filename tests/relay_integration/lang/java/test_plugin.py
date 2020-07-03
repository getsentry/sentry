from __future__ import absolute_import
import pytest

from tests.sentry.lang.java.test_plugin import BasicResolvingIntegrationTest
from sentry.testutils import RelayStoreHelper, TransactionTestCase


@pytest.mark.relay_store_integration
class BasicResolvingIntegrationTestRelay(
    RelayStoreHelper, TransactionTestCase, BasicResolvingIntegrationTest
):
    pass
