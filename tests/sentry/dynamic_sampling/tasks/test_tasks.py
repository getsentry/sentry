from collections.abc import Callable
from datetime import timedelta
from unittest.mock import patch

import pytest
from django.utils import timezone

from sentry.dynamic_sampling import RuleType, generate_rules, get_redis_client_for_ds
from sentry.dynamic_sampling.rules.base import NEW_MODEL_THRESHOLD_IN_MINUTES
from sentry.dynamic_sampling.rules.biases.recalibration_bias import RecalibrationBias
from sentry.dynamic_sampling.tasks.boost_low_volume_projects import boost_low_volume_projects
from sentry.dynamic_sampling.tasks.boost_low_volume_transactions import (
    boost_low_volume_transactions,
)
from sentry.dynamic_sampling.tasks.helpers.boost_low_volume_projects import (
    generate_boost_low_volume_projects_cache_key,
)
from sentry.dynamic_sampling.tasks.helpers.boost_low_volume_transactions import (
    get_transactions_resampling_rates,
)
from sentry.dynamic_sampling.tasks.helpers.recalibrate_orgs import (
    generate_recalibrate_orgs_cache_key,
    generate_recalibrate_projects_cache_key,
)
from sentry.dynamic_sampling.tasks.helpers.sliding_window import (
    generate_sliding_window_org_cache_key,
    mark_sliding_window_org_executed,
)
from sentry.dynamic_sampling.tasks.recalibrate_orgs import recalibrate_orgs
from sentry.dynamic_sampling.tasks.sliding_window_org import sliding_window_org
from sentry.dynamic_sampling.types import DynamicSamplingMode
from sentry.snuba.metrics.naming_layer.mri import SpanMRI, TransactionMRI
from sentry.testutils.cases import BaseMetricsLayerTestCase, SnubaTestCase, TestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.helpers.datetime import freeze_time

MOCK_DATETIME = (timezone.now() - timedelta(days=1)).replace(
    hour=0, minute=0, second=0, microsecond=0
)


class TasksTestCase(BaseMetricsLayerTestCase, TestCase, SnubaTestCase):
    @staticmethod
    def old_date():
        return timezone.now() - timedelta(minutes=NEW_MODEL_THRESHOLD_IN_MINUTES + 1)

    @staticmethod
    def disable_all_biases(project):
        project.update_option(
            "sentry:dynamic_sampling_biases",
            [
                {"id": RuleType.BOOST_ENVIRONMENTS_RULE.value, "active": False},
                {"id": RuleType.IGNORE_HEALTH_CHECKS_RULE.value, "active": False},
                {"id": RuleType.BOOST_LATEST_RELEASES_RULE.value, "active": False},
                {"id": RuleType.BOOST_KEY_TRANSACTIONS_RULE.value, "active": False},
                {"id": RuleType.BOOST_LOW_VOLUME_TRANSACTIONS_RULE.value, "active": False},
                {"id": RuleType.BOOST_REPLAY_ID_RULE.value, "active": False},
            ],
        )

    def create_old_organization(self, name):
        return self.create_organization(name=name, date_added=self.old_date())

    def create_old_project(self, name, organization):
        return self.create_project(name=name, organization=organization, date_added=self.old_date())

    def create_project_and_add_metrics(self, name, count, org, tags=None, is_old=True):
        if tags is None:
            tags = {"transaction": "foo_transaction"}

        if is_old:
            proj = self.create_old_project(name=name, organization=org)
        else:
            proj = self.create_project(name=name, organization=org)

        self.disable_all_biases(project=proj)

        self.store_performance_metric(
            name=TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
            tags=tags,
            minutes_before_now=30,
            value=count,
            project_id=proj.id,
            org_id=org.id,
        )

        return proj

    def create_project_without_metrics(self, name, org, is_old=True):
        if is_old:
            proj = self.create_old_project(name=name, organization=org)
        else:
            proj = self.create_project(name=name, organization=org)

        self.disable_all_biases(project=proj)

        return proj


@freeze_time(MOCK_DATETIME)
class TestBoostLowVolumeProjectsTasks(TasksTestCase):
    @property
    def now(self):
        return MOCK_DATETIME

    @staticmethod
    def add_sample_rate_per_project(org_id: int, project_id: int, sample_rate: float):
        redis_client = get_redis_client_for_ds()
        redis_client.hset(
            name=generate_boost_low_volume_projects_cache_key(org_id),
            key=str(project_id),
            value=sample_rate,
        )

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

    @patch("sentry.dynamic_sampling.tasks.boost_low_volume_projects.model_factory")
    @patch("sentry.quotas.backend.get_blended_sample_rate")
    def test_boost_low_volume_projects_with_no_dynamic_sampling(
        self, get_blended_sample_rate, model_factory
    ):
        get_blended_sample_rate.return_value = 0.25
        test_org = self.create_old_organization(name="sample-org")

        self.create_project_and_add_metrics("a", 9, test_org)
        self.create_project_and_add_metrics("b", 7, test_org)
        self.create_project_and_add_metrics("c", 3, test_org)
        self.create_project_and_add_metrics("d", 1, test_org)

        with self.tasks():
            sliding_window_org()
            boost_low_volume_projects()

        model_factory.assert_not_called()

    @with_feature("organizations:dynamic-sampling")
    @patch("sentry.quotas.backend.get_blended_sample_rate")
    def test_boost_low_volume_projects_simple(
        self,
        get_blended_sample_rate,
    ):
        get_blended_sample_rate.return_value = 0.25
        # Create a org
        test_org = self.create_old_organization(name="sample-org")

        # Create 4 projects
        proj_a = self.create_project_and_add_metrics("a", 9, test_org)
        proj_b = self.create_project_and_add_metrics("b", 7, test_org)
        proj_c = self.create_project_and_add_metrics("c", 3, test_org)
        proj_d = self.create_project_and_add_metrics("d", 1, test_org)

        with self.tasks():
            sliding_window_org()
            boost_low_volume_projects()

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

    @with_feature("organizations:dynamic-sampling")
    @patch("sentry.quotas.backend.get_blended_sample_rate")
    def test_boost_low_volume_projects_simple_with_empty_project(
        self,
        get_blended_sample_rate,
    ):
        get_blended_sample_rate.return_value = 0.25
        test_org = self.create_old_organization(name="sample-org")

        proj_a = self.create_project_and_add_metrics("a", 9, test_org)
        proj_b = self.create_project_and_add_metrics("b", 7, test_org)
        proj_c = self.create_project_and_add_metrics("c", 3, test_org)
        proj_d = self.create_project_and_add_metrics("d", 1, test_org)
        proj_e = self.create_project_without_metrics("e", test_org)

        with self.tasks():
            sliding_window_org()
            boost_low_volume_projects()

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
        assert generate_rules(proj_e)[0]["samplingValue"] == {"type": "sampleRate", "value": 1.0}

    @with_feature("organizations:dynamic-sampling")
    @patch("sentry.quotas.backend.get_blended_sample_rate")
    @patch("sentry.quotas.backend.get_transaction_sampling_tier_for_volume")
    @patch("sentry.dynamic_sampling.tasks.common.extrapolate_monthly_volume")
    def test_boost_low_volume_projects_simple_with_sliding_window_org_from_cache(
        self,
        extrapolate_monthly_volume,
        get_transaction_sampling_tier_for_volume,
        get_blended_sample_rate,
    ):
        extrapolate_monthly_volume.side_effect = self.forecasted_volume_side_effect
        get_transaction_sampling_tier_for_volume.side_effect = self.sampling_tier_side_effect
        get_blended_sample_rate.return_value = 0.8

        test_org = self.create_old_organization(name="sample-org")

        proj_a = self.create_project_and_add_metrics("a", 9, test_org)
        proj_b = self.create_project_and_add_metrics("b", 7, test_org)
        proj_c = self.create_project_and_add_metrics("c", 3, test_org)
        proj_d = self.create_project_and_add_metrics("d", 1, test_org)

        with self.tasks():
            sliding_window_org()
            boost_low_volume_projects()

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

    @with_feature("organizations:dynamic-sampling")
    @patch(
        "sentry.dynamic_sampling.tasks.boost_low_volume_projects.schedule_invalidate_project_config"
    )
    @patch("sentry.quotas.backend.get_blended_sample_rate")
    @patch("sentry.quotas.backend.get_transaction_sampling_tier_for_volume")
    @patch("sentry.dynamic_sampling.tasks.common.extrapolate_monthly_volume")
    def test_config_invalidation_when_sample_rates_change(
        self,
        extrapolate_monthly_volume,
        get_transaction_sampling_tier_for_volume,
        get_blended_sample_rate,
        schedule_invalidate_project_config,
    ):
        extrapolate_monthly_volume.side_effect = self.forecasted_volume_side_effect
        get_transaction_sampling_tier_for_volume.side_effect = self.sampling_tier_side_effect
        get_blended_sample_rate.return_value = 0.8

        test_org = self.create_old_organization(name="sample-org")

        proj_a = self.create_project_and_add_metrics("a", 9, test_org)
        proj_b = self.create_project_and_add_metrics("b", 7, test_org)

        self.add_sample_rate_per_project(org_id=test_org.id, project_id=proj_a.id, sample_rate=0.1)
        self.add_sample_rate_per_project(org_id=test_org.id, project_id=proj_b.id, sample_rate=0.2)

        with self.tasks():
            sliding_window_org()
            boost_low_volume_projects()

        assert schedule_invalidate_project_config.call_count == 2

    @with_feature("organizations:dynamic-sampling")
    @patch(
        "sentry.dynamic_sampling.tasks.boost_low_volume_projects.schedule_invalidate_project_config"
    )
    @patch("sentry.quotas.backend.get_blended_sample_rate")
    @patch("sentry.quotas.backend.get_transaction_sampling_tier_for_volume")
    @patch("sentry.dynamic_sampling.tasks.common.extrapolate_monthly_volume")
    def test_config_invalidation_when_sample_rates_do_not_change(
        self,
        extrapolate_monthly_volume,
        get_transaction_sampling_tier_for_volume,
        get_blended_sample_rate,
        schedule_invalidate_project_config,
    ):
        extrapolate_monthly_volume.side_effect = self.forecasted_volume_side_effect
        get_transaction_sampling_tier_for_volume.side_effect = self.sampling_tier_side_effect
        get_blended_sample_rate.return_value = 1.0

        test_org = self.create_old_organization(name="sample-org")

        proj_a = self.create_project_and_add_metrics("a", 9, test_org)
        proj_b = self.create_project_and_add_metrics("b", 7, test_org)

        self.add_sample_rate_per_project(org_id=test_org.id, project_id=proj_a.id, sample_rate=1.0)
        self.add_sample_rate_per_project(org_id=test_org.id, project_id=proj_b.id, sample_rate=1.0)

        with self.tasks():
            boost_low_volume_projects()

        schedule_invalidate_project_config.assert_not_called()


@freeze_time(MOCK_DATETIME)
class TestBoostLowVolumeTransactionsTasks(TasksTestCase):
    @property
    def now(self):
        return MOCK_DATETIME

    def setUp(self):
        super().setUp()
        self.orgs_info = []
        num_orgs = 3
        num_proj_per_org = 3
        for org_idx in range(num_orgs):
            org = self.create_old_organization(f"test-org{org_idx}")
            org_info = {"org_id": org.id, "project_ids": []}
            self.orgs_info.append(org_info)
            for proj_idx in range(num_proj_per_org):
                p = self.create_old_project(name=f"test-project-{proj_idx}", organization=org)
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

    @staticmethod
    def flush_redis():
        get_redis_client_for_ds().flushdb()

    @staticmethod
    def set_boost_low_volume_projects_cache_entry(org_id: int, project_id: int, value: str):
        redis = get_redis_client_for_ds()
        cache_key = generate_boost_low_volume_projects_cache_key(org_id=org_id)
        redis.hset(name=cache_key, key=str(project_id), value=value)

    def set_boost_low_volume_projects_sample_rate(
        self, org_id: int, project_id: int, sample_rate: float
    ):
        self.set_boost_low_volume_projects_cache_entry(org_id, project_id, str(sample_rate))

    def set_prioritise_by_project_invalid(self, org_id: int, project_id: int):
        # We want also to test for this case in order to verify the fallback to the `get_blended_sample_rate`.
        self.set_boost_low_volume_projects_cache_entry(org_id, project_id, "invalid")

    def for_all_orgs_and_projects(self, block: Callable[[int, int], None]):
        for org in self.orgs_info:
            org_id = org["org_id"]
            for project_id in org["project_ids"]:
                block(org_id, project_id)

    def set_boost_low_volume_projects_invalid_for_all(self):
        self.for_all_orgs_and_projects(
            lambda org_id, project_id: self.set_prioritise_by_project_invalid(org_id, project_id)
        )

    def set_boost_low_volume_projects_for_all(self, sample_rate: float):
        self.for_all_orgs_and_projects(
            lambda org_id, project_id: self.set_boost_low_volume_projects_sample_rate(
                org_id, project_id, sample_rate
            )
        )

    @patch("sentry.dynamic_sampling.tasks.boost_low_volume_transactions.model_factory")
    @patch("sentry.quotas.backend.get_blended_sample_rate")
    def test_boost_low_volume_transactions_with_blended_sample_rate_and_no_dynamic_sampling(
        self, get_blended_sample_rate, model_factory
    ):
        """
        Create orgs projects & transactions and then check that the rebalancing model is not called because dynamic
        sampling is disabled
        """
        BLENDED_RATE = 0.25
        get_blended_sample_rate.return_value = BLENDED_RATE

        with self.tasks():
            boost_low_volume_transactions()

        model_factory.assert_not_called()

    @with_feature("organizations:dynamic-sampling")
    @patch("sentry.quotas.backend.get_blended_sample_rate")
    def test_boost_low_volume_transactions_with_blended_sample_rate(self, get_blended_sample_rate):
        """
        Create orgs projects & transactions and then check that the task creates rebalancing data
        in Redis.
        """
        BLENDED_RATE = 0.25
        get_blended_sample_rate.return_value = BLENDED_RATE

        with self.tasks():
            boost_low_volume_transactions()

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
                assert global_rate == BLENDED_RATE

    @with_feature("organizations:dynamic-sampling")
    @patch("sentry.quotas.backend.get_blended_sample_rate")
    def test_boost_low_volume_transactions_with_sliding_window_org(self, get_blended_sample_rate):
        """
        Create orgs projects & transactions and then check that the task creates rebalancing data
        in Redis with the sliding window per org enabled.
        """
        BLENDED_RATE = 0.25
        get_blended_sample_rate.return_value = BLENDED_RATE

        for sliding_window_step, used_sample_rate in ((1, 1.0), (2, BLENDED_RATE), (3, 0.5)):
            # We flush redis after each run, to make sure no data persists.
            self.flush_redis()

            # No value in cache and sliding window org executed.
            if sliding_window_step == 1:
                mark_sliding_window_org_executed()
            # Invalid value in cache.
            elif sliding_window_step == 2:
                self.set_boost_low_volume_projects_invalid_for_all()
            # Value in cache.
            elif sliding_window_step == 3:
                self.set_boost_low_volume_projects_for_all(used_sample_rate)

            with self.tasks():
                boost_low_volume_transactions()

            # now redis should contain rebalancing data for our projects
            for org in self.orgs_info:
                org_id = org["org_id"]
                for proj_id in org["project_ids"]:
                    tran_rate, global_rate = get_transactions_resampling_rates(
                        org_id=org_id, proj_id=proj_id, default_rate=0.1
                    )

                    if sliding_window_step == 1:
                        # If the sample rate is 100%, we will not find anything in cache, since we don't
                        # need to run and store the rebalancing.
                        assert tran_rate == {}
                    else:
                        # If the sample rate is < 100%, we want to check that in cache we have a value with
                        # the correct global rate.
                        for transaction_name in ["ts1", "ts2", "tm3", "tl4", "tl5"]:
                            assert (
                                transaction_name in tran_rate
                            )  # check we have some rate calculated for each transaction

                        assert global_rate == used_sample_rate

    @with_feature("organizations:dynamic-sampling")
    @patch("sentry.quotas.backend.get_blended_sample_rate")
    def test_boost_low_volume_transactions_partial(self, get_blended_sample_rate):
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
                "dynamic-sampling.prioritise_transactions.num_explicit_large_transactions": 1,
                "dynamic-sampling.prioritise_transactions.num_explicit_small_transactions": 1,
                "dynamic-sampling.prioritise_transactions.rebalance_intensity": 0.7,
            }
        ):
            with self.tasks():
                boost_low_volume_transactions()

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
class TestRecalibrateOrgsTasks(TasksTestCase):
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
            org = self.create_old_organization(f"test-org-{org_rate}")
            org_info = {"org_id": org.id, "project_ids": [], "projects": []}
            self.orgs_info.append(org_info)
            self.orgs.append(org)
            for proj_idx in range(self.num_proj):
                p = self.create_old_project(name=f"test-project-{proj_idx}", organization=org)
                org_info["projects"].append(p)
                org_info["project_ids"].append(p.id)
                self.add_metrics(org, p, org_rate)

    def add_metrics(self, org, project, sample_rate):
        for mri in [TransactionMRI.COUNT_PER_ROOT_PROJECT, SpanMRI.COUNT_PER_ROOT_PROJECT]:
            if sample_rate < 100:
                self.store_performance_metric(
                    name=mri.value,
                    tags={"transaction": "trans-x", "decision": "drop"},
                    minutes_before_now=2,
                    value=100 - sample_rate,
                    project_id=project.id,
                    org_id=org.id,
                )
            if sample_rate > 0:
                self.store_performance_metric(
                    name=mri.value,
                    tags={"transaction": "trans-x", "decision": "keep"},
                    minutes_before_now=2,
                    value=sample_rate,
                    project_id=project.id,
                    org_id=org.id,
                )

    @staticmethod
    def set_sliding_window_org_cache_entry(org_id: int, value: str):
        redis = get_redis_client_for_ds()
        cache_key = generate_sliding_window_org_cache_key(org_id=org_id)
        redis.set(cache_key, value)

    def set_sliding_window_org_sample_rate(self, org_id: int, sample_rate: float):
        self.set_sliding_window_org_cache_entry(org_id, str(sample_rate))

    def for_all_orgs(self, block: Callable[[int], None]):
        for org in self.orgs_info:
            org_id = org["org_id"]
            block(org_id)

    def set_sliding_window_org_sample_rate_for_all(self, sample_rate: float):
        self.for_all_orgs(
            lambda org_id: self.set_sliding_window_org_sample_rate(org_id, sample_rate)
        )

    @patch("sentry.dynamic_sampling.tasks.recalibrate_orgs.compute_adjusted_factor")
    @patch("sentry.quotas.backend.get_blended_sample_rate")
    def test_recalibrate_orgs_with_no_dynamic_sampling(
        self, get_blended_sample_rate, computed_adjusted_factor
    ):
        """
        Test that the recalibration of orgs doesn't happen if dynamic sampling is not enabled
        """
        get_blended_sample_rate.return_value = 0.1
        self.set_sliding_window_org_sample_rate_for_all(0.2)

        with self.tasks():
            recalibrate_orgs()

        computed_adjusted_factor.assert_not_called()

    @with_feature("organizations:dynamic-sampling")
    @patch("sentry.quotas.backend.get_blended_sample_rate")
    def test_recalibrate_orgs_with_sliding_window_org(self, get_blended_sample_rate):
        """
        Test that the org are going to be rebalanced at 20% and that the sample rate used is the one from the sliding
        window org.

        The first org is 10%, so we should increase the sampling
        The second org is at 20%, so we are spot on
        The third is at 40%, so we should decrease the sampling
        """
        get_blended_sample_rate.return_value = 0.1
        self.set_sliding_window_org_sample_rate_for_all(0.2)

        redis_client = get_redis_client_for_ds()

        with self.tasks():
            recalibrate_orgs()

        for idx, org in enumerate(self.orgs):
            cache_key = generate_recalibrate_orgs_cache_key(org.id)
            val = redis_client.get(cache_key)

            if idx == 0:
                assert val is not None
                # we sampled at 10% half of what we want so we should adjust by 2
                assert float(val) == 2.0
            elif idx == 1:
                # we sampled at 20% we should be spot on (no adjustment)
                assert val is None
            elif idx == 2:
                assert val is not None
                # we sampled at 40% twice as much as we wanted we should adjust by 0.5
                assert float(val) == 0.5

        # now if we run it again (with the same data in the database, the algorithm
        # should double down... the previous factor didn't do anything so apply it again)
        with self.tasks():
            recalibrate_orgs()

        for idx, org in enumerate(self.orgs):
            cache_key = generate_recalibrate_orgs_cache_key(org.id)
            val = redis_client.get(cache_key)

            if idx == 0:
                assert val is not None
                # we sampled at 10% when already having a factor of two half of what we want so we
                # should double the current factor to 4
                assert float(val) == 4.0
            elif idx == 1:
                # we sampled at 20% we should be spot on (no adjustment)
                assert val is None
            elif idx == 2:
                assert val is not None
                # we sampled at 40% twice as much as we wanted we already have a factor of 0.5
                # half it again to 0.25
                assert float(val) == 0.25

    @with_feature("organizations:dynamic-sampling")
    @with_feature("organizations:dynamic-sampling-custom")
    def test_recalibrate_orgs_with_custom_ds(self):
        """
        Test several organizations with mixed sampling mode.

        The first org is 10%, so we should increase the sampling
        The second org is at 20%, so we are spot on
        The third is at 40%, so we should decrease the sampling
        """

        # First two orgs have a 20% sample rate configured, third one is in project mode
        self.orgs[0].update_option("sentry:target_sample_rate", 0.2)
        self.orgs[1].update_option("sentry:target_sample_rate", 0.2)
        self.orgs[2].update_option("sentry:sampling_mode", DynamicSamplingMode.PROJECT)

        # First project gets same 20% sample rate, the other one stays at implicit 100%
        p1, p2 = self.orgs_info[2]["projects"]
        p1.update_option("sentry:target_sample_rate", 0.2)

        with self.tasks():
            recalibrate_orgs()

        redis_client = get_redis_client_for_ds()

        # First org was sampled at 10%, should be recalibrated at 2x to 20%.
        assert redis_client.get(generate_recalibrate_orgs_cache_key(self.orgs[0].id)) == "2.0"
        # Second org was sampled at 20%, should not be recalibrated.
        assert redis_client.get(generate_recalibrate_orgs_cache_key(self.orgs[1].id)) is None

        # Third org should not have org-level recalibration.
        assert redis_client.get(generate_recalibrate_orgs_cache_key(self.orgs[2].id)) is None
        # First project was sampled at 40%, should be recalibrated at 0.5x to 20%.
        assert redis_client.get(generate_recalibrate_projects_cache_key(p1.id)) == "0.5"
        # Second project was sampled at 40%, should be recalibrated at 2.5x to 100%.
        assert redis_client.get(generate_recalibrate_projects_cache_key(p2.id)) == "2.5"

        assert RecalibrationBias().generate_rules(p1, base_sample_rate=1.0) == [
            {
                "samplingValue": {"type": "factor", "value": 0.5},
                "type": "trace",
                "condition": {"op": "and", "inner": []},
                "id": 1004,
            }
        ]

        assert RecalibrationBias().generate_rules(p2, base_sample_rate=1.0) == [
            {
                "samplingValue": {"type": "factor", "value": 2.5},
                "type": "trace",
                "condition": {"op": "and", "inner": []},
                "id": 1004,
            }
        ]

    @with_feature("organizations:dynamic-sampling")
    @patch("sentry.quotas.backend.get_blended_sample_rate")
    def test_rules_generation_with_recalibrate_orgs(self, get_blended_sample_rate):
        """
        Test that we pass rebalancing values all the way to the rules.
        """
        get_blended_sample_rate.return_value = 0.20

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
