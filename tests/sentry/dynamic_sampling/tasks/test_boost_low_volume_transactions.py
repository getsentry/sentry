from datetime import timedelta

from django.utils import timezone

from sentry.dynamic_sampling.tasks.boost_low_volume_transactions import (
    FetchProjectTransactionTotals,
    FetchProjectTransactionVolumes,
    ProjectIdentity,
    ProjectTransactions,
    ProjectTransactionsTotals,
    is_project_identity_before,
    is_same_project,
    merge_transactions,
    next_totals,
    transactions_zip,
)
from sentry.dynamic_sampling.tasks.common import GetActiveOrgs
from sentry.snuba.metrics.naming_layer.mri import TransactionMRI
from sentry.testutils.cases import BaseMetricsLayerTestCase, SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import freeze_time

MOCK_DATETIME = (timezone.now() - timedelta(days=1)).replace(
    hour=0, minute=0, second=0, microsecond=0
)


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
                        minutes_before_now=30,
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

    def get_total_counts_for_project(self, idx: int):
        """
        Get the total number of transactions and the number of transaction classes for a proj_idx
        """
        return 1 + 100 + 1000 + 2000 + 3000 + idx * 5, 5

    def test_get_orgs_with_transactions_respects_max_orgs(self):
        actual = list(GetActiveOrgs(2, 20))

        orgs = self.org_ids
        # we should return groups of 2 orgs at a time
        assert actual == [[orgs[0], orgs[1]], [orgs[2]]]

    def test_get_orgs_with_transactions_respects_max_projs(self):
        actual = list(GetActiveOrgs(10, 5))

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
        for idx, p_tran in enumerate(FetchProjectTransactionVolumes(orgs, True, 3)):
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
        for idx, p_tran in enumerate(FetchProjectTransactionVolumes(orgs, False, 2)):
            assert len(p_tran["transaction_counts"]) == 2
            if p_tran is not None:
                for name, count in p_tran["transaction_counts"]:
                    assert name in expected_names
                    assert count == self.get_count_for_transaction(idx, name)

    def test_fetch_transactions_with_total_volumes(self):
        """
        Create some transactions in some orgs and project and verify
        that the total counts and total transaction types per project are
        correctly returned
        """

        orgs = self.org_ids

        for idx, totals in enumerate(FetchProjectTransactionTotals(orgs)):
            total_counts, num_classes = self.get_total_counts_for_project(idx)
            assert totals["total_num_transactions"] == total_counts
            assert totals["total_num_classes"] == num_classes


def test_merge_transactions_full():
    t1: ProjectTransactions = {
        "project_id": 1,
        "org_id": 2,
        "transaction_counts": [("ts1", 10), ("tm2", 100)],
        "total_num_transactions": None,
        "total_num_classes": None,
    }
    t2: ProjectTransactions = {
        "project_id": 1,
        "org_id": 2,
        "transaction_counts": [("tm2", 100), ("tl3", 1000)],
        "total_num_transactions": None,
        "total_num_classes": None,
    }
    counts: ProjectTransactionsTotals = {
        "project_id": 1,
        "org_id": 2,
        "total_num_transactions": 5555,
        "total_num_classes": 20,
    }
    actual = merge_transactions(t1, t2, counts)

    expected = {
        "project_id": 1,
        "org_id": 2,
        "transaction_counts": [("ts1", 10), ("tm2", 100), ("tl3", 1000)],
        "total_num_transactions": 5555,
        "total_num_classes": 20,
    }

    assert actual == expected


def test_merge_transactions_missing_totals():
    t1: ProjectTransactions = {
        "project_id": 1,
        "org_id": 2,
        "transaction_counts": [("ts1", 10), ("tm2", 100)],
        "total_num_transactions": None,
        "total_num_classes": None,
    }
    t2: ProjectTransactions = {
        "project_id": 1,
        "org_id": 2,
        "transaction_counts": [("tm2", 100), ("tl3", 1000)],
        "total_num_transactions": None,
        "total_num_classes": None,
    }

    actual = merge_transactions(t1, t2, None)

    expected: ProjectTransactions = {
        "project_id": 1,
        "org_id": 2,
        "transaction_counts": [("ts1", 10), ("tm2", 100), ("tl3", 1000)],
        "total_num_transactions": None,
        "total_num_classes": None,
    }

    assert actual == expected


def test_merge_transactions_missing_right():
    t1: ProjectTransactions = {
        "project_id": 1,
        "org_id": 2,
        "transaction_counts": [("ts1", 10), ("tm2", 100)],
        "total_num_transactions": None,
        "total_num_classes": None,
    }
    counts: ProjectTransactionsTotals = {
        "project_id": 1,
        "org_id": 2,
        "total_num_transactions": 5555,
        "total_num_classes": 20,
    }
    actual = merge_transactions(t1, None, counts)

    expected: ProjectTransactions = {
        "project_id": 1,
        "org_id": 2,
        "transaction_counts": [("ts1", 10), ("tm2", 100)],
        "total_num_transactions": 5555,
        "total_num_classes": 20,
    }

    assert actual == expected


def test_transactions_zip():
    high = 1
    low = 2
    both = 3

    def pt(org_id: int, proj_id: int, what: int, add_totals: bool = False):
        if what == high:
            transaction_counts = [("tm2", 100), ("tl3", 1000)]
        elif what == low:
            transaction_counts = [("ts1", 10), ("tm2", 100)]
        else:  # what == both
            transaction_counts = [("ts1", 10), ("tm2", 100), ("tl3", 1000)]
        return {
            "project_id": proj_id,
            "org_id": org_id,
            "transaction_counts": transaction_counts,
            "total_num_transactions": 5000 if add_totals else None,
            "total_num_classes": 5 if add_totals else None,
        }

    def tot(org_id, proj_id):
        return {
            "project_id": proj_id,
            "org_id": org_id,
            "total_num_transactions": 5000,
            "total_num_classes": 5,
        }

    trans_low = [pt(1, 1, low), pt(1, 2, low), pt(2, 1, low), pt(2, 3, low), pt(3, 2, low)]
    trans_high = [pt(2, 1, high), (pt(2, 2, high)), pt(3, 1, high), pt(3, 2, high), pt(3, 3, high)]
    totals = [tot(1, 0), tot(1, 2), tot(1, 3), tot(2, 1), tot(2, 4), tot(3, 1), tot(3, 3)]

    expected = [
        pt(1, 1, low),
        pt(1, 2, low, True),
        pt(2, 1, both, True),
        pt(2, 2, high),
        pt(2, 3, low),
        pt(3, 1, high, True),
        pt(3, 2, both),
        pt(3, 3, high, True),
    ]

    actual = list(
        transactions_zip((x for x in totals), (x for x in trans_low), (x for x in trans_high))
    )

    assert actual == expected


def test_same_project():
    p1: ProjectIdentity = {"project_id": 1, "org_id": 2}
    p1bis: ProjectIdentity = {"project_id": 1, "org_id": 2}
    p2: ProjectIdentity = {"project_id": 1, "org_id": 3}
    p3: ProjectIdentity = {"project_id": 2, "org_id": 1}
    p4: ProjectIdentity = {"project_id": 3, "org_id": 4}

    assert is_same_project(p1, p1bis)
    assert not is_same_project(p1, p2)
    assert not is_same_project(p1, p3)
    assert not is_same_project(p1, p4)


def test_project_before():
    p1: ProjectIdentity = {"project_id": 1, "org_id": 2}
    p1bis: ProjectIdentity = {"project_id": 1, "org_id": 2}
    p2: ProjectIdentity = {"project_id": 1, "org_id": 3}
    p3: ProjectIdentity = {"project_id": 2, "org_id": 2}
    p4: ProjectIdentity = {"project_id": 2, "org_id": 1}

    # same project
    assert not is_project_identity_before(p1, p1bis)
    assert not is_project_identity_before(p1bis, p1)

    # different project_id
    assert is_project_identity_before(p1, p2)
    assert not is_project_identity_before(p2, p1)

    # different org_id
    assert is_project_identity_before(p1, p3)
    assert not is_project_identity_before(p3, p1)

    # just different
    assert is_project_identity_before(p4, p1)
    assert not is_project_identity_before(p1, p4)


def test_next_totals():
    def ct(org_id: int, project_id: int) -> ProjectTransactionsTotals:
        return {
            "project_id": project_id,
            "org_id": org_id,
            "total_num_transactions": 123,
            "total_num_classes": 5,
        }

    def pi(org_id: int, project_id: int) -> ProjectIdentity:
        return {
            "project_id": project_id,
            "org_id": org_id,
        }

    my_totals = iter([ct(1, 2), ct(1, 4), ct(1, 5), ct(1, 6), ct(1, 9), ct(2, 1)])

    get_totals = next_totals(my_totals)

    # current should be 1,2
    # ask for something before 1,2
    assert get_totals(pi(0, 1)) is None
    assert get_totals(pi(0, 2)) is None
    assert get_totals(pi(1, 1)) is None

    # ask for 1.2
    assert get_totals(pi(1, 2)) == ct(1, 2)
    # ask again
    assert get_totals(pi(1, 2)) is None
    # jump a few totals
    assert get_totals(pi(1, 6)) == ct(1, 6)
    # make sure we don't go back
    assert get_totals(pi(1, 5)) is None
    # forcing it to go forward jumps just enough
    assert get_totals(pi(1, 10)) is None
    # but not too much
    assert get_totals(pi(1, 11)) is None
    assert get_totals(pi(1, 12)) is None
    assert get_totals(pi(2, 1)) == ct(2, 1)
    # and from now on we return None
    assert get_totals(pi(3, 1)) is None
    assert get_totals(pi(3, 2)) is None
    assert get_totals(pi(3, 3)) is None
