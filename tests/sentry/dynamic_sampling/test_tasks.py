from datetime import timedelta
from unittest.mock import patch

import pytest
from django.utils import timezone
from freezegun import freeze_time

from sentry.dynamic_sampling import generate_rules, get_redis_client_for_ds
from sentry.dynamic_sampling.rules.biases.recalibration_bias import RecalibrationBias
from sentry.dynamic_sampling.rules.helpers.prioritize_transactions import (
    get_transactions_resampling_rates,
)
from sentry.dynamic_sampling.rules.utils import RuleType, generate_cache_key_rebalance_factor
from sentry.dynamic_sampling.tasks import (
    prioritise_projects,
    prioritise_transactions,
    recalibrate_orgs,
    sliding_window,
    sliding_window_org,
)
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

    def create_project_and_add_metrics(self, name, count, org, tags=None):
        if tags is None:
            tags = {"transaction": "foo_transaction"}
        # Create 4 projects
        proj = self.create_project(name=name, organization=org)

        # disable all biases
        proj.update_option(
            "sentry:dynamic_sampling_biases",
            [
                {"id": RuleType.BOOST_ENVIRONMENTS_RULE.value, "active": False},
                {"id": RuleType.IGNORE_HEALTH_CHECKS_RULE.value, "active": False},
                {"id": RuleType.BOOST_LATEST_RELEASES_RULE.value, "active": False},
                {"id": RuleType.BOOST_KEY_TRANSACTIONS_RULE.value, "active": False},
                {"id": RuleType.BOOST_LOW_VOLUME_TRANSACTIONS.value, "active": False},
                {"id": RuleType.BOOST_REPLAY_ID_RULE.value, "active": False},
            ],
        )
        # Store performance metrics for proj A
        self.store_performance_metric(
            name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
            tags=tags,
            minutes_before_now=30,
            value=count,
            project_id=proj.id,
            org_id=org.id,
        )
        return proj

    @staticmethod
    def sampling_tier_side_effect(*args, **kwargs):
        volume = args[1]

        if volume == 20:
            return 100_000, 0.25
        # We want to also hardcode the error case, to test how the system reacts to errors.
        elif volume == 0:
            return None

        return volume, 1.0

    @staticmethod
    def forecasted_volume_side_effect(*args, **kwargs):
        return kwargs["volume"]

    @patch("sentry.dynamic_sampling.rules.base.quotas.get_blended_sample_rate")
    def test_prioritise_projects_simple(
        self,
        get_blended_sample_rate,
    ):
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
                sliding_window_org()
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

    @patch("sentry.dynamic_sampling.rules.base.quotas.get_blended_sample_rate")
    @patch("sentry.dynamic_sampling.rules.base.quotas.get_transaction_sampling_tier_for_volume")
    @patch("sentry.dynamic_sampling.tasks.extrapolate_monthly_volume")
    def test_prioritise_projects_simple_with_sliding_window_org_from_cache(
        self,
        extrapolate_monthly_volume,
        get_transaction_sampling_tier_for_volume,
        get_blended_sample_rate,
    ):
        extrapolate_monthly_volume.side_effect = self.forecasted_volume_side_effect
        get_transaction_sampling_tier_for_volume.side_effect = self.sampling_tier_side_effect
        get_blended_sample_rate.return_value = 1.0
        # Create a org
        test_org = self.create_organization(name="sample-org")

        # Create 4 projects
        proj_a = self.create_project_and_add_metrics("a", 9, test_org)
        proj_b = self.create_project_and_add_metrics("b", 7, test_org)
        proj_c = self.create_project_and_add_metrics("c", 3, test_org)
        proj_d = self.create_project_and_add_metrics("d", 1, test_org)

        with self.options({"dynamic-sampling.prioritise_projects.sample_rate": 1.0}):
            with self.feature("organizations:ds-sliding-window-org"):
                with self.tasks():
                    sliding_window_org()
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

    @patch("sentry.dynamic_sampling.rules.base.quotas.get_blended_sample_rate")
    @patch("sentry.dynamic_sampling.rules.base.quotas.get_transaction_sampling_tier_for_volume")
    @patch("sentry.dynamic_sampling.tasks.extrapolate_monthly_volume")
    def test_prioritise_projects_simple_with_sliding_window_org_from_sync(
        self,
        extrapolate_monthly_volume,
        get_transaction_sampling_tier_for_volume,
        get_blended_sample_rate,
    ):
        extrapolate_monthly_volume.side_effect = self.forecasted_volume_side_effect
        get_transaction_sampling_tier_for_volume.side_effect = self.sampling_tier_side_effect
        get_blended_sample_rate.return_value = 1.0
        # Create a org
        test_org = self.create_organization(name="sample-org")

        # Create 4 projects
        proj_a = self.create_project_and_add_metrics("a", 9, test_org)
        proj_b = self.create_project_and_add_metrics("b", 7, test_org)
        proj_c = self.create_project_and_add_metrics("c", 3, test_org)
        proj_d = self.create_project_and_add_metrics("d", 1, test_org)

        with self.options({"dynamic-sampling.prioritise_projects.sample_rate": 1.0}):
            with self.feature("organizations:ds-sliding-window-org"):
                with self.tasks():
                    # We are testing whether the sliding window org sample rate will be synchronously computed
                    # since the cache value is not there.
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

        with self.options(
            {
                "dynamic-sampling.prioritise_transactions.load_rate": 1.0,
            }
        ):
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

    @patch("sentry.dynamic_sampling.rules.base.quotas.get_blended_sample_rate")
    def test_prioritise_transactions_partial(self, get_blended_sample_rate):
        """
        Test the V2 algorithm is used, only specified projects are balanced and the
        rest get a global rate

        Create orgs projects & transactions and then check that the task creates rebalancing data
        in Redis
        """
        BLENDED_RATE = 0.25
        get_blended_sample_rate.return_value = BLENDED_RATE

        with self.options(
            {
                "dynamic-sampling.prioritise_transactions.load_rate": 1.0,
                "dynamic-sampling.prioritise_transactions.num_explicit_large_transactions": 1,
                "dynamic-sampling.prioritise_transactions.num_explicit_small_transactions": 1,
                "dynamic-sampling.prioritise_transactions.rebalance_intensity": 0.7,
            }
        ):
            with self.tasks():
                prioritise_transactions()

        # now redis should contain rebalancing data for our projects
        for org in self.orgs_info:
            org_id = org["org_id"]
            for proj_id in org["project_ids"]:
                tran_rate, implicit_rate = get_transactions_resampling_rates(
                    org_id=org_id, proj_id=proj_id, default_rate=0.1
                )
                # explicit transactions
                for transaction_name in ["ts1", "tl5"]:
                    assert (
                        transaction_name in tran_rate
                    )  # check we have some rate calculated for each transaction
                # implicit transactions
                for transaction_name in ["ts2", "tm3", "tl4"]:
                    assert (
                        transaction_name not in tran_rate
                    )  # check we have some rate calculated for each transaction
                # we do have some different rate for implicit transactions
                assert implicit_rate != BLENDED_RATE


@freeze_time(MOCK_DATETIME)
class TestRecalibrateOrganisationsTask(BaseMetricsLayerTestCase, TestCase, SnubaTestCase):
    @property
    def now(self):
        return MOCK_DATETIME

    def setUp(self):
        super().setUp()
        self.orgs_info = []
        self.orgs = []
        self.num_proj = 2
        self.orgs_sampling = [10, 20, 40]
        # create some orgs, projects and transactions
        for org_rate in self.orgs_sampling:
            org = self.create_organization(f"test-org-{org_rate}")
            org_info = {"org_id": org.id, "project_ids": []}
            self.orgs_info.append(org_info)
            self.orgs.append(org)
            for proj_idx in range(self.num_proj):
                p = self.create_project(organization=org)
                org_info["project_ids"].append(p.id)
                # keep 10% + 10%*org_idx of the transactions
                keep = org_rate
                drop = 100 - keep
                self.store_performance_metric(
                    name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
                    tags={"transaction": "trans-x", "decision": "drop"},
                    minutes_before_now=2,
                    value=drop,
                    project_id=p.id,
                    org_id=org.id,
                )
                self.store_performance_metric(
                    name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
                    tags={"transaction": "trans-x", "decision": "keep"},
                    minutes_before_now=2,
                    value=keep,
                    project_id=p.id,
                    org_id=org.id,
                )

    @patch("sentry.dynamic_sampling.rules.base.quotas.get_blended_sample_rate")
    def test_rebalance_orgs(self, get_blended_sample_rate):
        """
        Test that the org are going to be rebalanced at 20%

        The first org is 10%, so we should increase the sampling
        The second org is at 20%, so we are spot on
        The third is at 30%, so we should decrease the sampling
        """
        BLENDED_RATE = 0.20
        get_blended_sample_rate.return_value = BLENDED_RATE
        redis_client = get_redis_client_for_ds()

        with self.tasks():
            recalibrate_orgs()

        for idx, org in enumerate(self.orgs):
            cache_key = generate_cache_key_rebalance_factor(org.id)
            val = redis_client.get(cache_key)

            if idx == 0:
                # we sampled at 10% half of what we want so we should adjust by 2
                assert float(val) == 2.0
            elif idx == 1:
                # we sampled at 20% we should be spot on (no adjustment)
                assert val is None
            elif idx == 2:
                # we sampled at 40% twice as much as we wanted we should adjust by 0.5
                assert float(val) == 0.5

        # now if we run it again (with the same data in the database, the algorithm
        # should double down... the previous factor didn't do anything so apply it again)
        with self.tasks():
            recalibrate_orgs()

        for idx, org in enumerate(self.orgs):
            cache_key = generate_cache_key_rebalance_factor(org.id)
            val = redis_client.get(cache_key)

            if idx == 0:
                # we sampled at 10% when already having a factor of two half of what we want so we
                # should double the current factor to 4
                assert float(val) == 4.0
            elif idx == 1:
                # we sampled at 20% we should be spot on (no adjustment)
                assert val is None
            elif idx == 2:
                # we sampled at 40% twice as much as we wanted we already have a factor of 0.5
                # half it again to 0.25
                assert float(val) == 0.25

    @patch("sentry.dynamic_sampling.rules.base.quotas.get_blended_sample_rate")
    def test_rebalance_rules(self, get_blended_sample_rate):
        """
        Test that we pass rebalancing values all the way to the rules

        (An integration test)
        """
        BLENDED_RATE = 0.20
        get_blended_sample_rate.return_value = BLENDED_RATE

        with self.tasks():
            recalibrate_orgs()

        for org_idx, org in enumerate(self.orgs):
            for project in org.project_set.all():
                rules = RecalibrationBias().generate_rules(project, base_sample_rate=0.5)
                if org_idx == 0:
                    # we sampled at 10% half of what we want so we should adjust by 2
                    assert rules == [
                        {
                            "samplingValue": {"type": "factor", "value": 2.0},
                            "type": "trace",
                            "condition": {"op": "and", "inner": []},
                            "id": 1004,
                        }
                    ]
                elif org_idx == 1:
                    # we sampled at 20% we should be spot on (no rule)
                    assert rules == []
                elif org_idx == 2:
                    # we sampled at 40% twice as much as we wanted we should adjust by 0.5
                    assert rules == [
                        {
                            "samplingValue": {"type": "factor", "value": 0.5},
                            "type": "trace",
                            "condition": {"op": "and", "inner": []},
                            "id": 1004,
                        }
                    ]


@freeze_time(MOCK_DATETIME)
class TestSlidingWindowTask(BaseMetricsLayerTestCase, TestCase, SnubaTestCase):
    @property
    def now(self):
        return MOCK_DATETIME

    def create_project_and_add_metrics(self, name, count, org, tags=None):
        if tags is None:
            tags = {"transaction": "foo_transaction"}

        proj = self.create_project(name=name, organization=org)

        proj.update_option(
            "sentry:dynamic_sampling_biases",
            [
                {"id": RuleType.BOOST_ENVIRONMENTS_RULE.value, "active": False},
                {"id": RuleType.IGNORE_HEALTH_CHECKS_RULE.value, "active": False},
                {"id": RuleType.BOOST_LATEST_RELEASES_RULE.value, "active": False},
                {"id": RuleType.BOOST_KEY_TRANSACTIONS_RULE.value, "active": False},
                {"id": RuleType.BOOST_LOW_VOLUME_TRANSACTIONS.value, "active": False},
                {"id": RuleType.BOOST_REPLAY_ID_RULE.value, "active": False},
            ],
        )

        self.store_performance_metric(
            name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
            tags=tags,
            minutes_before_now=30,
            value=count,
            project_id=proj.id,
            org_id=org.id,
        )

        return proj

    @staticmethod
    def sampling_tier_side_effect(*args, **kwargs):
        volume = args[1]

        if volume == 1000:
            return 1000, 0.8
        elif volume == 10_000:
            return 10_000, 0.4
        elif volume == 100_000:
            return 100_000, 0.2
        # We want to also hardcode the error case, to test how the system reacts to errors.
        elif volume == 0:
            return None

        return volume, 1.0

    @staticmethod
    def forecasted_volume_side_effect(*args, **kwargs):
        return kwargs["volume"] * 1000

    @patch("sentry.dynamic_sampling.rules.base.quotas.get_blended_sample_rate")
    @patch("sentry.dynamic_sampling.rules.base.quotas.get_transaction_sampling_tier_for_volume")
    @patch("sentry.dynamic_sampling.tasks.extrapolate_monthly_volume")
    def test_sliding_window_with_multiple_projects(
        self,
        extrapolate_monthly_volume,
        get_transaction_sampling_tier_for_volume,
        get_blended_sample_rate,
    ):
        extrapolate_monthly_volume.side_effect = self.forecasted_volume_side_effect
        get_transaction_sampling_tier_for_volume.side_effect = self.sampling_tier_side_effect
        get_blended_sample_rate.return_value = 1.0

        org = self.create_organization(name="sample-org")

        project_a = self.create_project_and_add_metrics("a", 1, org)
        project_b = self.create_project_and_add_metrics("b", 10, org)
        project_c = self.create_project_and_add_metrics("c", 100, org)

        with self.tasks():
            sliding_window()

        with self.feature("organizations:ds-sliding-window"):
            assert generate_rules(project_a)[0]["samplingValue"] == {
                "type": "sampleRate",
                "value": 0.8,
            }
            assert generate_rules(project_b)[0]["samplingValue"] == {
                "type": "sampleRate",
                "value": 0.4,
            }
            assert generate_rules(project_c)[0]["samplingValue"] == {
                "type": "sampleRate",
                "value": 0.2,
            }

    @patch("sentry.dynamic_sampling.rules.base.quotas.get_blended_sample_rate")
    @patch("sentry.dynamic_sampling.rules.base.quotas.get_transaction_sampling_tier_for_volume")
    @patch("sentry.dynamic_sampling.tasks.extrapolate_monthly_volume")
    def test_sliding_window_with_none_sampling_tier(
        self,
        extrapolate_monthly_volume,
        get_transaction_sampling_tier_for_volume,
        get_blended_sample_rate,
    ):
        extrapolate_monthly_volume.side_effect = self.forecasted_volume_side_effect
        get_transaction_sampling_tier_for_volume.side_effect = self.sampling_tier_side_effect
        get_blended_sample_rate.return_value = 1.0

        org = self.create_organization(name="sample-org")

        project_a = self.create_project_and_add_metrics("a", 1, org)
        # In this case we expect that the base sample rate will be used from "get_blended_sample_rate".
        project_b = self.create_project_and_add_metrics("b", 0, org)

        with self.tasks():
            sliding_window()

        with self.feature("organizations:ds-sliding-window"):
            assert generate_rules(project_a)[0]["samplingValue"] == {
                "type": "sampleRate",
                "value": 0.8,
            }
            assert generate_rules(project_b)[0]["samplingValue"] == {
                "type": "sampleRate",
                "value": 1.0,
            }

    @patch("sentry.dynamic_sampling.rules.base.quotas.get_blended_sample_rate")
    @patch("sentry.dynamic_sampling.tasks.extrapolate_monthly_volume")
    def test_sliding_window_with_forecasting_error(
        self, extrapolate_monthly_volume, get_blended_sample_rate
    ):
        # We want to make the forecasting call fail and return None.
        extrapolate_monthly_volume.return_value = None
        get_blended_sample_rate.return_value = 0.9

        org = self.create_organization(name="sample-org")

        project_a = self.create_project_and_add_metrics("a", 100, org)

        with self.tasks():
            sliding_window()

        with self.feature("organizations:ds-sliding-window"):
            # In case we have an error we fully sample, even though we should be more explicit about its handling.
            assert generate_rules(project_a)[0]["samplingValue"] == {
                "type": "sampleRate",
                "value": 1.0,
            }

    def test_sliding_window_with_none_window_size(self):
        org = self.create_organization(name="sample-org")

        project = self.create_project_and_add_metrics("a", 100, org)

        with self.tasks():
            sliding_window()

        with self.feature("organizations:ds-sliding-window"):
            with self.options({"dynamic-sampling:sliding_window.size": None}):
                assert len(generate_rules(project)) == 0
