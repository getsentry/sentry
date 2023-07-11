from sentry.db.postgres.transactions import in_test_assert_no_transaction
from sentry.testutils import TestCase
from sentry.testutils.silo import control_silo_test, region_silo_test


@control_silo_test(stable=True)
class ControlTransactionTestCase(TestCase):
    def test_no_transaction(self):
        in_test_assert_no_transaction("unexpected transaction")


@region_silo_test(stable=True)
class RegionTransactionTestCase(TestCase):
    def test_no_transaction(self):
        in_test_assert_no_transaction("unexpected transaction")
