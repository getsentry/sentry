from datetime import datetime, timedelta, timezone
from typing import Callable
from unittest.mock import patch

import pytest
from django.utils import timezone as django_timezone

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
)
from sentry.dynamic_sampling.tasks.helpers.sliding_window import (
    SLIDING_WINDOW_CALCULATION_ERROR,
    generate_sliding_window_cache_key,
    generate_sliding_window_org_cache_key,
    mark_sliding_window_org_executed,
)
from sentry.dynamic_sampling.tasks.recalibrate_orgs import recalibrate_orgs
from sentry.dynamic_sampling.tasks.sliding_window import sliding_window
from sentry.dynamic_sampling.tasks.sliding_window_org import sliding_window_org
from sentry.snuba.metrics.naming_layer.mri import TransactionMRI
from sentry.testutils.cases import BaseMetricsLayerTestCase, SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import freeze_time

MOCK_DATETIME = (django_timezone.now() - timedelta(days=1)).replace(
    hour=0, minute=0, second=0, microsecond=0
)


class TasksTestCase(BaseMetricsLayerTestCase, TestCase, SnubaTestCase):
    @staticmethod
    def old_date():
        return datetime.now(tz=timezone.utc) - timedelta(minutes=NEW_MODEL_THRESHOLD_IN_MINUTES + 1)

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
            generate_boost_low_volume_projects_cache_key(org_id), project_id, sample_rate
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

    @patch("sentry.quotas.backend.get_blended_sample_rate")
    def test_boost_low_volume_projects_simple_with_empty_project(
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
        # Create a org
        test_org = self.create_old_organization(name="sample-org")

        # Create 4 projects
        proj_a = self.create_project_and_add_metrics("a", 9, test_org)
        proj_b = self.create_project_and_add_metrics("b", 7, test_org)
        proj_c = self.create_project_and_add_metrics("c", 3, test_org)
        proj_d = self.create_project_and_add_metrics("d", 1, test_org)

        with self.feature("organizations:ds-sliding-window-org"):
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
        # Create a org
        test_org = self.create_old_organization(name="sample-org")

        # Create 2 projects
        proj_a = self.create_project_and_add_metrics("a", 9, test_org)
        proj_b = self.create_project_and_add_metrics("b", 7, test_org)

        self.add_sample_rate_per_project(org_id=test_org.id, project_id=proj_a.id, sample_rate=0.1)
        self.add_sample_rate_per_project(org_id=test_org.id, project_id=proj_b.id, sample_rate=0.2)

        with self.feature("organizations:ds-sliding-window-org"):
            with self.tasks():
                sliding_window_org()
                boost_low_volume_projects()

        assert schedule_invalidate_project_config.call_count == 2

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
        get_blended_sample_rate.return_value = 0.8
        # Create a org
        test_org = self.create_old_organization(name="sample-org")

        # Create 2 projects
        proj_a = self.create_project_and_add_metrics("a", 9, test_org)
        proj_b = self.create_project_and_add_metrics("b", 7, test_org)

        self.add_sample_rate_per_project(org_id=test_org.id, project_id=proj_a.id, sample_rate=1.0)
        self.add_sample_rate_per_project(org_id=test_org.id, project_id=proj_b.id, sample_rate=1.0)

        with self.feature("organizations:ds-sliding-window-org"):
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
    def set_sliding_window_cache_entry(org_id: int, project_id: int, value: str):
        redis = get_redis_client_for_ds()
        cache_key = generate_sliding_window_cache_key(org_id=org_id)
        redis.hset(cache_key, project_id, value)

    @staticmethod
    def set_boost_low_volume_projects_cache_entry(org_id: int, project_id: int, value: str):
        redis = get_redis_client_for_ds()
        cache_key = generate_boost_low_volume_projects_cache_key(org_id=org_id)
        redis.hset(cache_key, project_id, value)

    def set_sliding_window_sample_rate(self, org_id: int, project_id: int, sample_rate: float):
        self.set_sliding_window_cache_entry(org_id, project_id, str(sample_rate))

    def set_sliding_window_error(self, org_id: int, project_id: int):
        # We want also to test for this case in order to verify the fallback to the `get_blended_sample_rate`.
        self.set_sliding_window_cache_entry(org_id, project_id, SLIDING_WINDOW_CALCULATION_ERROR)

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

    def set_sliding_window_error_for_all(self):
        self.for_all_orgs_and_projects(
            lambda org_id, project_id: self.set_sliding_window_error(org_id, project_id)
        )

    def set_sliding_window_sample_rate_for_all(self, sample_rate: float):
        self.for_all_orgs_and_projects(
            lambda org_id, project_id: self.set_sliding_window_sample_rate(
                org_id, project_id, sample_rate
            )
        )

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

    @patch("sentry.quotas.backend.get_blended_sample_rate")
    def test_boost_low_volume_transactions_with_sliding_window(self, get_blended_sample_rate):
        """
        Create orgs projects & transactions and then check that the task creates rebalancing data
        in Redis with the sliding window per project enabled.
        """
        BLENDED_RATE = 0.25
        get_blended_sample_rate.return_value = BLENDED_RATE

        for (sliding_window_error, used_sample_rate) in ((True, BLENDED_RATE), (False, 0.5)):
            if sliding_window_error:
                self.set_sliding_window_error_for_all()
            else:
                self.set_sliding_window_sample_rate_for_all(used_sample_rate)

            with self.feature("organizations:ds-sliding-window"):
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
                    assert global_rate == used_sample_rate

    @patch("sentry.quotas.backend.get_blended_sample_rate")
    def test_boost_low_volume_transactions_with_sliding_window_org(self, get_blended_sample_rate):
        """
        Create orgs projects & transactions and then check that the task creates rebalancing data
        in Redis with the sliding window per org enabled.
        """
        BLENDED_RATE = 0.25
        get_blended_sample_rate.return_value = BLENDED_RATE

        for (sliding_window_step, used_sample_rate) in ((1, 1.0), (2, BLENDED_RATE), (3, 0.5)):
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

            with self.feature("organizations:ds-sliding-window-org"):
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

        for (sliding_window_error, used_sample_rate) in ((True, BLENDED_RATE), (False, 0.5)):
            if sliding_window_error:
                self.set_sliding_window_error_for_all()
            else:
                self.set_sliding_window_sample_rate_for_all(used_sample_rate)

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
            org_info = {"org_id": org.id, "project_ids": []}
            self.orgs_info.append(org_info)
            self.orgs.append(org)
            for proj_idx in range(self.num_proj):
                p = self.create_old_project(name=f"test-project-{proj_idx}", organization=org)
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

    @staticmethod
    def flush_redis():
        get_redis_client_for_ds().flushdb()

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

    @patch("sentry.quotas.backend.get_blended_sample_rate")
    def test_rebalance_orgs(self, get_blended_sample_rate):
        """
        Test that the org are going to be rebalanced at 20%

        The first org is 10%, so we should increase the sampling
        The second org is at 20%, so we are spot on
        The third is at 30%, so we should decrease the sampling
        """
        BLENDED_RATE = 0.20
        self.set_sliding_window_org_sample_rate_for_all(BLENDED_RATE)

        redis_client = get_redis_client_for_ds()

        with self.tasks():
            recalibrate_orgs()

        for idx, org in enumerate(self.orgs):
            cache_key = generate_recalibrate_orgs_cache_key(org.id)
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
            cache_key = generate_recalibrate_orgs_cache_key(org.id)
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

    def test_rules_generation_with_recalibrate_orgs(self):
        """
        Test that we pass rebalancing values all the way to the rules

        (An integration test)
        """
        BLENDED_RATE = 0.20
        self.set_sliding_window_org_sample_rate_for_all(BLENDED_RATE)

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
class TestSlidingWindowTasks(TasksTestCase):
    @property
    def now(self):
        return MOCK_DATETIME

    @staticmethod
    def sampling_tier_side_effect(*args, **kwargs):
        volume = args[1]

        if volume == 0:
            return 0, 1.0
        elif volume == 1000:
            return 1000, 0.8
        elif volume == 10_000:
            return 10_000, 0.4
        elif volume == 100_000:
            return 100_000, 0.2
        # We want to also hardcode the error case, to test how the system reacts to errors.
        elif volume == -1:
            return None

        return volume, 1.0

    @staticmethod
    def forecasted_volume_side_effect(*args, **kwargs):
        volume = kwargs["volume"]
        if volume == -1:
            return volume

        return volume * 1000

    @staticmethod
    def add_sliding_window_sample_rate_per_project(
        org_id: int, project_id: int, sample_rate: float
    ):
        redis_client = get_redis_client_for_ds()
        redis_client.hset(generate_sliding_window_cache_key(org_id), project_id, sample_rate)

    @staticmethod
    def exists_sliding_window_sample_rate_for_project(org_id: int, project_id: int):
        redis_client = get_redis_client_for_ds()
        return (
            redis_client.hget(generate_sliding_window_cache_key(org_id), str(project_id))
            is not None
        )

    @patch("sentry.quotas.backend.get_blended_sample_rate")
    @patch("sentry.quotas.backend.get_transaction_sampling_tier_for_volume")
    @patch("sentry.dynamic_sampling.tasks.common.extrapolate_monthly_volume")
    def test_sliding_window_with_multiple_projects(
        self,
        extrapolate_monthly_volume,
        get_transaction_sampling_tier_for_volume,
        get_blended_sample_rate,
    ):
        extrapolate_monthly_volume.side_effect = self.forecasted_volume_side_effect
        get_transaction_sampling_tier_for_volume.side_effect = self.sampling_tier_side_effect

        org = self.create_old_organization(name="sample-org")

        project_a = self.create_project_and_add_metrics("a", 1, org)
        project_b = self.create_project_and_add_metrics("b", 10, org)
        project_c = self.create_project_and_add_metrics("c", 100, org)

        # We try with a `get_blended_sample_rate` < 100%.
        get_blended_sample_rate.return_value = 0.5
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

        # We try again but with the `get_blended_sample_rate` equal to 100%.
        get_blended_sample_rate.return_value = 1.0
        with self.tasks():
            sliding_window()

        with self.feature("organizations:ds-sliding-window"):
            assert generate_rules(project_a)[0]["samplingValue"] == {
                "type": "sampleRate",
                "value": 1.0,
            }
            assert generate_rules(project_b)[0]["samplingValue"] == {
                "type": "sampleRate",
                "value": 1.0,
            }
            assert generate_rules(project_c)[0]["samplingValue"] == {
                "type": "sampleRate",
                "value": 1.0,
            }

    @patch("sentry.quotas.backend.get_blended_sample_rate")
    @patch("sentry.quotas.backend.get_transaction_sampling_tier_for_volume")
    @patch("sentry.dynamic_sampling.tasks.common.extrapolate_monthly_volume")
    def test_sliding_window_with_none_sampling_tier(
        self,
        extrapolate_monthly_volume,
        get_transaction_sampling_tier_for_volume,
        get_blended_sample_rate,
    ):
        extrapolate_monthly_volume.side_effect = self.forecasted_volume_side_effect
        get_transaction_sampling_tier_for_volume.side_effect = self.sampling_tier_side_effect
        get_blended_sample_rate.return_value = 0.5

        org = self.create_old_organization(name="sample-org")

        project_a = self.create_project_and_add_metrics("a", 1, org)
        project_b = self.create_project_and_add_metrics("b", -1, org)

        with self.tasks():
            sliding_window()

        with self.feature("organizations:ds-sliding-window"):
            assert generate_rules(project_a)[0]["samplingValue"] == {
                "type": "sampleRate",
                "value": 0.8,
            }
            # In this case we expect that the base sample rate will be used from `get_blended_sample_rate` since we
            # mocked the sampling tier function to return None when -1 is provided, however this doesn't depict the real
            # implementation.
            assert generate_rules(project_b)[0]["samplingValue"] == {
                "type": "sampleRate",
                "value": 0.5,
            }

    @patch("sentry.quotas.backend.get_blended_sample_rate")
    @patch("sentry.dynamic_sampling.tasks.common.extrapolate_monthly_volume")
    def test_sliding_window_with_forecasting_error(
        self, extrapolate_monthly_volume, get_blended_sample_rate
    ):
        # We want to make the forecasting call fail and return None.
        extrapolate_monthly_volume.return_value = None
        get_blended_sample_rate.return_value = 0.9

        org = self.create_old_organization(name="sample-org")

        project_a = self.create_project_and_add_metrics("a", 100, org)

        with self.tasks():
            sliding_window()

        with self.feature("organizations:ds-sliding-window"):
            # In case we have an error we will fall back to the `get_blended_sample_rate` result.
            assert generate_rules(project_a)[0]["samplingValue"] == {
                "type": "sampleRate",
                "value": 0.9,
            }

    @patch("sentry.quotas.backend.get_blended_sample_rate")
    @patch("sentry.dynamic_sampling.tasks.common.compute_sliding_window_sample_rate")
    def test_sliding_window_with_sample_rate_computation_error(
        self, compute_sliding_window_sample_rate, get_blended_sample_rate
    ):
        # We want to make the entire sliding window sample rate fail.
        compute_sliding_window_sample_rate.side_effect = Exception()
        get_blended_sample_rate.return_value = 0.9

        org = self.create_old_organization(name="sample-org")

        project_a = self.create_project_and_add_metrics("a", 100, org)

        with self.tasks():
            sliding_window()

        with self.feature("organizations:ds-sliding-window"):
            # In case we have an error we will fall back to the `get_blended_sample_rate` result.
            assert generate_rules(project_a)[0]["samplingValue"] == {
                "type": "sampleRate",
                "value": 0.9,
            }

    @patch("sentry.quotas.backend.get_blended_sample_rate")
    @patch("sentry.quotas.backend.get_transaction_sampling_tier_for_volume")
    @patch("sentry.dynamic_sampling.tasks.common.extrapolate_monthly_volume")
    def test_sliding_window_with_project_without_metrics(
        self,
        extrapolate_monthly_volume,
        get_transaction_sampling_tier_for_volume,
        get_blended_sample_rate,
    ):
        extrapolate_monthly_volume.side_effect = self.forecasted_volume_side_effect
        get_transaction_sampling_tier_for_volume.side_effect = self.sampling_tier_side_effect
        get_blended_sample_rate.return_value = 0.5

        org = self.create_old_organization(name="sample-org")

        # In case an org has at least one project with metrics and all the other ones without, the ones without should
        # fall back to 100%.
        project_a = self.create_project_and_add_metrics("a", 100, org)
        project_b = self.create_project_without_metrics("b", org)

        with self.tasks():
            sliding_window()

        with self.feature("organizations:ds-sliding-window"):
            assert generate_rules(project_a)[0]["samplingValue"] == {
                "type": "sampleRate",
                "value": 0.2,
            }
            assert generate_rules(project_b)[0]["samplingValue"] == {
                "type": "sampleRate",
                "value": 1.0,
            }

    @patch("sentry.quotas.backend.get_blended_sample_rate")
    @patch("sentry.quotas.backend.get_transaction_sampling_tier_for_volume")
    @patch("sentry.dynamic_sampling.tasks.common.extrapolate_monthly_volume")
    def test_sliding_window_with_all_projects_without_metrics(
        self,
        extrapolate_monthly_volume,
        get_transaction_sampling_tier_for_volume,
        get_blended_sample_rate,
    ):
        extrapolate_monthly_volume.side_effect = self.forecasted_volume_side_effect
        get_transaction_sampling_tier_for_volume.side_effect = self.sampling_tier_side_effect
        get_blended_sample_rate.return_value = 0.5

        org = self.create_old_organization(name="sample-org")

        project_a = self.create_project_without_metrics("a", org)
        project_b = self.create_project_without_metrics("b", org)

        with self.tasks():
            sliding_window()

        with self.feature("organizations:ds-sliding-window"):
            assert generate_rules(project_a)[0]["samplingValue"] == {
                "type": "sampleRate",
                "value": 1.0,
            }
            assert generate_rules(project_b)[0]["samplingValue"] == {
                "type": "sampleRate",
                "value": 1.0,
            }

    @patch("sentry.quotas.backend.get_blended_sample_rate")
    def test_sliding_window_with_none_window_size(self, get_blended_sample_rate):
        get_blended_sample_rate.return_value = 0.5

        org = self.create_old_organization(name="sample-org")

        project = self.create_project_and_add_metrics("a", 100, org)

        with self.tasks():
            sliding_window()

        with self.feature("organizations:ds-sliding-window"):
            with self.options({"dynamic-sampling:sliding_window.size": None}):
                # With window_size = None, we expect the sliding window to not run, thus we will fall back to
                # blended sample rate.
                assert generate_rules(project)[0]["samplingValue"] == {
                    "type": "sampleRate",
                    "value": 0.5,
                }

    @patch("sentry.dynamic_sampling.tasks.sliding_window.schedule_invalidate_project_config")
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
        # Create a org
        test_org = self.create_old_organization(name="sample-org")

        # Create 2 projects
        project_a = self.create_project_and_add_metrics("a", 1, test_org)
        project_b = self.create_project_and_add_metrics("b", 10, test_org)

        self.add_sliding_window_sample_rate_per_project(
            org_id=test_org.id, project_id=project_a.id, sample_rate=0.1
        )
        self.add_sliding_window_sample_rate_per_project(
            org_id=test_org.id, project_id=project_b.id, sample_rate=0.2
        )

        with self.tasks():
            sliding_window()

        assert schedule_invalidate_project_config.call_count == 2

    @patch("sentry.dynamic_sampling.tasks.sliding_window.schedule_invalidate_project_config")
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
        get_blended_sample_rate.return_value = 0.8
        # Create a org
        test_org = self.create_old_organization(name="sample-org")

        # Create 2 projects
        project_a = self.create_project_and_add_metrics("a", 2, test_org)
        project_b = self.create_project_and_add_metrics("b", 3, test_org)

        self.add_sliding_window_sample_rate_per_project(
            org_id=test_org.id, project_id=project_a.id, sample_rate=1.0
        )
        self.add_sliding_window_sample_rate_per_project(
            org_id=test_org.id, project_id=project_b.id, sample_rate=1.0
        )

        with self.tasks():
            sliding_window()

        schedule_invalidate_project_config.assert_not_called()

    @patch("sentry.dynamic_sampling.tasks.sliding_window.schedule_invalidate_project_config")
    @patch("sentry.quotas.backend.get_blended_sample_rate")
    @patch("sentry.quotas.backend.get_transaction_sampling_tier_for_volume")
    @patch("sentry.dynamic_sampling.tasks.common.extrapolate_monthly_volume")
    def test_cache_deletion_when_project_has_no_more_metrics(
        self,
        extrapolate_monthly_volume,
        get_transaction_sampling_tier_for_volume,
        get_blended_sample_rate,
        schedule_invalidate_project_config,
    ):
        extrapolate_monthly_volume.side_effect = self.forecasted_volume_side_effect
        get_transaction_sampling_tier_for_volume.side_effect = self.sampling_tier_side_effect
        get_blended_sample_rate.return_value = 0.8
        # Create a org
        test_org = self.create_old_organization(name="sample-org")

        # Create 2 projects
        project_a = self.create_project_and_add_metrics("a", 1, test_org)
        project_b = self.create_project_and_add_metrics("b", 10, test_org)
        project_c = self.create_project_without_metrics("c", test_org)

        # We simulate that proj_c had an old sample rate but since it has no metrics, it should be deleted and no sample
        # rate for that project should be found.
        self.add_sliding_window_sample_rate_per_project(
            org_id=test_org.id, project_id=project_c.id, sample_rate=1.0
        )

        with self.tasks():
            sliding_window()

        assert self.exists_sliding_window_sample_rate_for_project(test_org.id, project_a.id)
        assert self.exists_sliding_window_sample_rate_for_project(test_org.id, project_b.id)
        assert not self.exists_sliding_window_sample_rate_for_project(test_org.id, project_c.id)

        assert schedule_invalidate_project_config.call_count == 2

        with self.feature("organizations:ds-sliding-window"):
            assert generate_rules(project_a)[0]["samplingValue"] == {
                "type": "sampleRate",
                "value": 0.8,
            }
            assert generate_rules(project_b)[0]["samplingValue"] == {
                "type": "sampleRate",
                "value": 0.4,
            }
            # Since this project has no more entries in Redis but the task has run, we fall back to 100% sample rate.
            assert generate_rules(project_c)[0]["samplingValue"] == {
                "type": "sampleRate",
                "value": 1.0,
            }

    @patch("sentry.quotas.backend.get_blended_sample_rate")
    def test_sliding_window_with_new_project(self, get_blended_sample_rate):
        get_blended_sample_rate.return_value = 0.5

        org = self.create_old_organization(name="sample-org")

        project = self.create_project_and_add_metrics("a", 100, org, is_old=False)

        with self.tasks():
            sliding_window()

        with self.feature({"organizations:ds-sliding-window": True}):
            # We expect that the project is boosted to 100%.
            assert generate_rules(project)[0]["samplingValue"] == {
                "type": "sampleRate",
                "value": 1.0,
            }

    @patch("sentry.quotas.backend.get_blended_sample_rate")
    def test_sliding_window_with_new_org(self, get_blended_sample_rate):
        get_blended_sample_rate.return_value = 0.5

        org = self.create_organization(name="sample-org")

        project_a = self.create_project_and_add_metrics("a", 100, org)
        project_b = self.create_project_and_add_metrics("b", 100, org)

        with self.tasks():
            sliding_window()

        with self.feature({"organizations:ds-sliding-window": True}):
            # We expect that the projects are boosted to 100%.
            assert generate_rules(project_a)[0]["samplingValue"] == {
                "type": "sampleRate",
                "value": 1.0,
            }
            assert generate_rules(project_b)[0]["samplingValue"] == {
                "type": "sampleRate",
                "value": 1.0,
            }
