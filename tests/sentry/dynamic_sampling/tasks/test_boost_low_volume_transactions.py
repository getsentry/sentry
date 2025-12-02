from datetime import timedelta

from django.utils import timezone

from sentry.dynamic_sampling.tasks.boost_low_volume_transactions import (
    FetchProjectTransactionTotals,
    FetchProjectTransactionVolumes,
    ProjectIdentity,
    is_project_identity_before,
    is_same_project,
)
from sentry.dynamic_sampling.tasks.common import GetActiveOrgs
from sentry.snuba.metrics.naming_layer.mri import SpanMRI
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

    def setUp(self) -> None:
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
                        name=SpanMRI.COUNT_PER_ROOT_PROJECT.value,
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

    def test_get_orgs_with_transactions_respects_max_orgs(self) -> None:
        actual = list(GetActiveOrgs(2, 20))

        orgs = self.org_ids
        # we should return groups of 2 orgs at a time
        assert actual == [[orgs[0], orgs[1]], [orgs[2]]]

    def test_get_orgs_with_transactions_respects_max_projs(self) -> None:
        actual = list(GetActiveOrgs(10, 5))

        orgs = [org["org_id"] for org in self.orgs_info]
        # since each org has 3 projects and we have a limit of 5 proj
        # we should return 2 orgs at a time
        assert actual == [[orgs[0], orgs[1]], [orgs[2]]]

    def test_fetch_transactions_with_total_volumes_large(self) -> None:
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

    def test_fetch_transactions_with_total_volumes_small(self) -> None:
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

    def test_fetch_transactions_with_total_volumes(self) -> None:
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


def test_same_project() -> None:
    p1: ProjectIdentity = {"project_id": 1, "org_id": 2}
    p1bis: ProjectIdentity = {"project_id": 1, "org_id": 2}
    p2: ProjectIdentity = {"project_id": 1, "org_id": 3}
    p3: ProjectIdentity = {"project_id": 2, "org_id": 1}
    p4: ProjectIdentity = {"project_id": 3, "org_id": 4}

    assert is_same_project(p1, p1bis)
    assert not is_same_project(p1, p2)
    assert not is_same_project(p1, p3)
    assert not is_same_project(p1, p4)


def test_project_before() -> None:
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
