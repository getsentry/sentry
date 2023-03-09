from datetime import datetime, timezone

from freezegun import freeze_time

from sentry.dynamic_sampling.prioritise_transactions import (
    fetch_transactions_with_total_volumes,
    get_orgs_with_project_counts,
    merge_transactions,
    transactions_zip,
)
from sentry.snuba.metrics import TransactionMRI
from sentry.testutils import BaseMetricsLayerTestCase, SnubaTestCase, TestCase

MOCK_DATETIME = datetime(2023, 8, 7, 0, 0, 0, tzinfo=timezone.utc)


@freeze_time(MOCK_DATETIME)
class PrioritiseProjectsSnubaQueryTest(BaseMetricsLayerTestCase, TestCase, SnubaTestCase):
    @property
    def now(self):
        return MOCK_DATETIME

    def setUp(self):
        super().setUp()
        self.orgs_info = []
        num_orgs = 3
        num_proj_per_org = 3
        for org_idx in range(num_orgs):
            org = self.create_organization(f"test-org{org_idx}")
            org_info = {"org_id": org.id, "project_ids": []}
            self.orgs_info.append(org_info)
            for proj_idx in range(num_proj_per_org):
                p = self.create_project(organization=org)
                org_info["project_ids"].append(p.id)
                # create 5 transaction types
                for name in ["ts1", "ts2", "tm3", "tl4", "tl5"]:
                    # make up some unique count
                    idx = org_idx * num_orgs + proj_idx
                    num_transactions = self.get_count_for_transaction(idx, name)
                    self.store_performance_metric(
                        name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
                        tags={"transaction": name},
                        hours_before_now=1,
                        value=num_transactions,
                        project_id=p.id,
                        org_id=org.id,
                    )
        self.org_ids = [org["org_id"] for org in self.orgs_info]

    def get_count_for_transaction(self, idx: int, name: str):
        """
        Create some known count based on transaction name and the order (based on org and project)
        """
        counts = {
            "ts1": 1,
            "ts2": 100,
            "tm3": 1000,
            "tl4": 2000,
            "tl5": 3000,
        }
        return idx + counts[name]

    def test_get_orgs_with_transactions_respects_max_orgs(self):
        with self.options({"dynamic-sampling.prioritise_transactions.load_rate": 1.0}):
            actual = list(get_orgs_with_project_counts(2, 20))

        orgs = self.org_ids
        # we should return groups of 2 orgs at a time
        assert actual == [[orgs[0], orgs[1]], [orgs[2]]]

    def test_get_orgs_with_transactions_respects_max_projs(self):
        with self.options({"dynamic-sampling.prioritise_transactions.load_rate": 1.0}):
            actual = list(get_orgs_with_project_counts(10, 5))

        orgs = [org["org_id"] for org in self.orgs_info]
        # since each org has 3 projects and we have a limit of 5 proj
        # we should return 2 orgs at a time
        assert actual == [[orgs[0], orgs[1]], [orgs[2]]]

    def test_fetch_transactions_with_total_volumes_large(self):
        """
        Create some transactions in some orgs and project and verify
        that they are correctly returned by fetch_transactions_with_total_volumes
        """

        # get the transaction counts from snuba and check that they match what we put in
        orgs = self.org_ids

        expected_names = {"tm3", "tl5", "tl4"}
        for idx, p_tran in enumerate(fetch_transactions_with_total_volumes(orgs, True, 3)):
            if p_tran is not None:
                assert len(p_tran["transaction_counts"]) == 3
                for name, count in p_tran["transaction_counts"]:
                    assert name in expected_names
                    assert count == self.get_count_for_transaction(idx, name)

    def test_fetch_transactions_with_total_volumes_small(self):
        """
        Create some transactions in some orgs and project and verify
        that they are correctly returned by fetch_transactions_with_total_volumes
        """

        # get the transaction counts from snuba and check that they match what we put in
        orgs = self.org_ids

        expected_names = {"ts1", "ts2"}
        for idx, p_tran in enumerate(fetch_transactions_with_total_volumes(orgs, False, 2)):
            assert len(p_tran["transaction_counts"]) == 2
            if p_tran is not None:
                for name, count in p_tran["transaction_counts"]:
                    assert name in expected_names
                    assert count == self.get_count_for_transaction(idx, name)


def test_merge_transactions():
    t1 = {"project_id": 1, "org_id": 2, "transaction_counts": [("ts1", 10), ("tm2", 100)]}
    t2 = {"project_id": 1, "org_id": 2, "transaction_counts": [("tm2", 100), ("tl3", 1000)]}

    actual = merge_transactions(t1, t2)

    expected = {
        "project_id": 1,
        "org_id": 2,
        "transaction_counts": [("ts1", 10), ("tm2", 100), ("tl3", 1000)],
    }

    assert actual == expected


def test_transactions_zip():
    high = 1
    low = 2
    both = 3

    def pt(org_id: int, proj_id: int, what: int):
        if what == high:
            transaction_counts = [("tm2", 100), ("tl3", 1000)]
        elif what == low:
            transaction_counts = [("ts1", 10), ("tm2", 100)]
        else:
            transaction_counts = [("ts1", 10), ("tm2", 100), ("tl3", 1000)]
        return {
            "project_id": proj_id,
            "org_id": org_id,
            "transaction_counts": transaction_counts,  # not relevant in zipping
        }

    trans_low = [pt(1, 1, low), pt(1, 2, low), pt(2, 1, low), pt(2, 3, low), pt(3, 2, low)]
    trans_high = [pt(2, 1, high), (pt(2, 2, high)), pt(3, 1, high), pt(3, 2, high), pt(3, 3, high)]

    expected = [
        pt(1, 1, low),
        pt(1, 2, low),
        pt(2, 1, both),
        pt(2, 2, high),
        pt(2, 3, low),
        pt(3, 1, high),
        pt(3, 2, both),
        pt(3, 3, high),
    ]

    actual = list(transactions_zip((x for x in trans_low), (x for x in trans_high)))

    assert actual == expected
