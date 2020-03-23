from __future__ import absolute_import

import pytest

from tests.sentry.lang.javascript.test_example import ExampleTestCase
from sentry.testutils import RelayStoreHelper, TransactionTestCase


@pytest.mark.relay_store_integration
class ExampleTestCaseRelay(RelayStoreHelper, TransactionTestCase, ExampleTestCase):
    pass
