from __future__ import absolute_import

import pytest

from ....sentry.lang.javascript.test_example import ExampleTestCase
from sentry.testutils import RelayStoreHelper, TransactionTestCase


@pytest.mark.group_relay_store
class ExampleTestCaseRelay(RelayStoreHelper, TransactionTestCase, ExampleTestCase):
    pass
