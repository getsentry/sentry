from __future__ import absolute_import

import pytest

from sentry.testutils import RelayStoreHelper, TransactionTestCase

from ....sentry.lang.javascript.test_example import ExampleTestCase


@pytest.mark.relay_store_integration
class ExampleTestCaseRelay(RelayStoreHelper, TransactionTestCase, ExampleTestCase):
    pass
