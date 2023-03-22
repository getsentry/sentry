from datetime import timedelta
from unittest.mock import patch

import pytest
from django.utils import timezone
from freezegun import freeze_time

from sentry.dynamic_sampling import generate_rules
from sentry.dynamic_sampling.rules.helpers.prioritize_transactions import (
    get_transactions_resampling_rates,
)
from sentry.dynamic_sampling.tasks import prioritise_projects, prioritise_transactions
from sentry.snuba.metrics import TransactionMRI
from sentry.testutils import BaseMetricsLayerTestCase, SnubaTestCase, TestCase

MOCK_DATETIME = (timezone.now() - timedelta(days=1)).replace(
    hour=0, minute=0, second=0, microsecond=0
)


@freeze_time(MOCK_DATETIME)
class TestPrioritiseProjectsTask(BaseMetricsLayerTestCase, TestCase, SnubaTestCase):
    @property
    def now(self):
        return MOCK_DATETIME

    def create_project_and_add_metrics(self, name, count, org):
        # Create 4 projects
        proj = self.create_project(name=name, organization=org)

        # disable all biases
        proj.update_option(
            "sentry:dynamic_sampling_biases",
            [
                {"id": "boostEnvironments", "active": False},
                {"id": "ignoreHealthChecks", "active": False},
                {"id": "boostLatestRelease", "active": False},
                {"id": "boostKeyTransactions", "active": False},
            ],
        )
        # Store performance metrics for proj A
        self.store_performance_metric(
            name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
            tags={"transaction": "foo_transaction"},
            minutes_before_now=30,
            value=count,
            project_id=proj.id,
            org_id=org.id,
        )
        return proj

    @patch("sentry.dynamic_sampling.rules.base.quotas.get_blended_sample_rate")
    def test_prioritise_projects_simple(self, get_blended_sample_rate):
        get_blended_sample_rate.return_value = 0.25
        # Create a org
        test_org = self.create_organization(name="sample-org")

        # Create 4 projects
        proj_a = self.create_project_and_add_metrics("a", 9, test_org)
        proj_b = self.create_project_and_add_metrics("b", 7, test_org)
        proj_c = self.create_project_and_add_metrics("c", 3, test_org)
        proj_d = self.create_project_and_add_metrics("d", 1, test_org)

        with self.options({"dynamic-sampling.prioritise_projects.sample_rate": 1.0}):
            with self.tasks():
                prioritise_projects()

        # we expect only uniform rule
        # also we test here that `generate_rules` can handle trough redis long floats
        assert generate_rules(proj_a)[0]["samplingValue"] == {
            "type": "sampleRate",
            "value": pytest.approx(0.14814814814814817),
        }
        assert generate_rules(proj_b)[0]["samplingValue"] == {
            "type": "sampleRate",
            "value": pytest.approx(0.1904761904761905),
        }
        assert generate_rules(proj_c)[0]["samplingValue"] == {
            "type": "sampleRate",
            "value": pytest.approx(0.4444444444444444),
        }
        assert generate_rules(proj_d)[0]["samplingValue"] == {"type": "sampleRate", "value": 1.0}


@freeze_time(MOCK_DATETIME)
class TestPrioritiseTransactionsTask(BaseMetricsLayerTestCase, TestCase, SnubaTestCase):
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

    @patch("sentry.dynamic_sampling.rules.base.quotas.get_blended_sample_rate")
    def test_prioritise_transactions_simple(self, get_blended_sample_rate):
        """
        Create orgs projects & transactions and then check that the task creates rebalancing data
        in Redis
        """
        get_blended_sample_rate.return_value = 0.25

        with self.options({"dynamic-sampling.prioritise_transactions.load_rate": 1.0}):
            with self.feature({"organizations:ds-prioritise-by-transaction-bias": True}):
                with self.tasks():
                    prioritise_transactions()

        # now redis should contain rebalancing data for our projects
        for org in self.orgs_info:
            org_id = org["org_id"]
            for proj_id in org["project_ids"]:
                tran_rate, global_rate = get_transactions_resampling_rates(
                    org_id=org_id, proj_id=proj_id, default_rate=0.1
                )
                for transaction_name in ["ts1", "ts2", "tm3", "tl4", "tl5"]:
                    assert (
                        transaction_name in tran_rate
                    )  # check we have some rate calculated for each transaction
