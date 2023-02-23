from datetime import datetime, timezone

from freezegun import freeze_time

from sentry.dynamic_sampling.prioritise_transactions import fetch_transactions_with_total_volumes
from sentry.snuba.metrics import TransactionMRI
from sentry.testutils import BaseMetricsLayerTestCase, SnubaTestCase, TestCase

MOCK_DATETIME = datetime(2023, 8, 7, 0, 0, 0, tzinfo=timezone.utc)


@freeze_time(MOCK_DATETIME)
class PrioritiseProjectsSnubaQueryTest(BaseMetricsLayerTestCase, TestCase, SnubaTestCase):
    @property
    def now(self):
        return MOCK_DATETIME

    def test_fetch_transactions_with_total_volumes(self):
        """
        Create some transactions in some orgs and project and verify
        that they are correctly returned by fetch_transactions_with_total_volumes
        """
        expected_transactions = {}
        for org_idx in range(1, 3):
            org = self.create_organization(f"test-org{org_idx}")
            for proj_idx in range(1, 3):
                p = self.create_project(organization=org)
                # make up some unique count
                num_transactions_t1 = org_idx * 10 + proj_idx
                self.store_performance_metric(
                    name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
                    tags={"transaction": "t1"},
                    hours_before_now=1,
                    value=num_transactions_t1,
                    project_id=p.id,
                    org_id=org.id,
                )
                # make up some unique count
                num_transactions_t2 = org_idx * 10 + proj_idx + 50
                self.store_performance_metric(
                    name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
                    tags={"transaction": "t2"},
                    hours_before_now=1,
                    value=num_transactions_t2,
                    project_id=p.id,
                    org_id=org.id,
                )
                # keep the counts in a convenient dict for easy comparison
                expected_transactions[(org.id, p.id)] = {
                    "t1": num_transactions_t1,
                    "t2": num_transactions_t2,
                }

        actual_transactions = {}
        # get the transaction counts from snuba and check that they match what we put in
        for p_tran in fetch_transactions_with_total_volumes():
            if p_tran is not None:
                # transform result into a dictionary for easy comparison
                actual_transactions[(p_tran.org_id, p_tran.project_id)] = {
                    name: count for name, count in p_tran.transaction_counts
                }

        assert expected_transactions == actual_transactions
