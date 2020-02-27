from __future__ import absolute_import
import pytest

from ....sentry.lang.java.test_plugin import BasicResolvingIntegrationTest
from sentry.testutils import RelayStoreHelper, TransactionTestCase


@pytest.mark.group_relay_store
class BasicResolvingIntegrationTestRelay(
    RelayStoreHelper, TransactionTestCase, BasicResolvingIntegrationTest
):
    pass
