from __future__ import annotations

from unittest.mock import DEFAULT, Mock, patch

import orjson
import pytest

from sentry.constants import SAMPLING_MODE_DEFAULT
from sentry.dynamic_sampling.models.common import RebalancedItem
from sentry.dynamic_sampling.per_org.comparisons import (
    compare_rebalanced_projects_with_cache,
    compare_rebalanced_transactions_with_cache,
    compare_recalibration_factor_with_cache,
    emit_comparisons,
    get_cached_rebalanced_project_sample_rates,
    get_cached_rebalanced_transaction_sample_rates,
    get_cached_recalibration_factor,
    get_effective_sample_rate,
    is_within_relative_tolerance,
)
from sentry.dynamic_sampling.per_org.queries import ProjectVolume
from sentry.dynamic_sampling.per_org.results import DynamicSamplingResults
from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds
from sentry.dynamic_sampling.tasks.common import OrganizationDataVolume
from sentry.dynamic_sampling.tasks.helpers import (
    recalibrate_orgs as legacy_recalibration_cache,
)
from sentry.dynamic_sampling.tasks.helpers.boost_low_volume_projects import (
    generate_boost_low_volume_projects_cache_key,
)
from sentry.dynamic_sampling.tasks.helpers.boost_low_volume_transactions import (
    generate_boost_low_volume_transactions_cache_key,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from tests.sentry.dynamic_sampling.per_org.test_helpers import (
    mock_configuration,
    patch_configuration,
)

COMPARISONS = "sentry.dynamic_sampling.per_org.comparisons"
LOGGER_INFO = f"{COMPARISONS}.logger.info"
CACHED_PROJECT_RATES = f"{COMPARISONS}.get_cached_rebalanced_project_sample_rates"
CACHED_TRANSACTION_RATES = f"{COMPARISONS}.get_cached_rebalanced_transaction_sample_rates"
CACHED_FACTOR = f"{COMPARISONS}.get_cached_recalibration_factor"
LEGACY_VOLUME = f"{COMPARISONS}.get_organization_volume"
COMPARE_PROJECTS = f"{COMPARISONS}.compare_rebalanced_projects_with_cache"
COMPARE_TRANSACTIONS = f"{COMPARISONS}.compare_rebalanced_transactions_with_cache"
COMPARE_FACTOR = f"{COMPARISONS}.compare_recalibration_factor_with_cache"
COMPARE_SLIDING_WINDOW = f"{COMPARISONS}.compare_organization_sliding_window_sample_rates"
LOG_SUMMARY = f"{COMPARISONS}.log_sample_rates_summary"
LOG_TRANSACTION_VOLUMES = f"{COMPARISONS}.log_transaction_volume_debug"

ALL_COMPARISONS = {
    COMPARE_PROJECTS: DEFAULT,
    COMPARE_TRANSACTIONS: DEFAULT,
    COMPARE_FACTOR: DEFAULT,
    COMPARE_SLIDING_WINDOW: DEFAULT,
    LOG_SUMMARY: DEFAULT,
    LOG_TRANSACTION_VOLUMES: DEFAULT,
}


class CachedSampleRateReadersTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.redis = get_redis_client_for_ds()

    def test_get_cached_rebalanced_project_sample_rates(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        cache_key = generate_boost_low_volume_projects_cache_key(org.id)
        self.redis.delete(cache_key)
        self.addCleanup(self.redis.delete, cache_key)
        self.redis.hset(cache_key, str(project.id), "0.25")

        assert get_cached_rebalanced_project_sample_rates(org.id) == {project.id: 0.25}

    def test_get_cached_rebalanced_transaction_sample_rates(self) -> None:
        org = self.create_organization()
        project_hit = self.create_project(organization=org)
        project_miss = self.create_project(organization=org)
        cache_key = generate_boost_low_volume_transactions_cache_key(
            org_id=org.id, proj_id=project_hit.id
        )
        self.redis.delete(cache_key)
        self.addCleanup(self.redis.delete, cache_key)
        self.redis.set(cache_key, orjson.dumps([{"checkout": 0.3}, 0.5]).decode())

        result = get_cached_rebalanced_transaction_sample_rates(
            org.id, [project_hit.id, project_miss.id]
        )

        assert result == {
            project_hit.id: ({"checkout": 0.3}, 0.5),
            project_miss.id: None,
        }

    def test_get_cached_recalibration_factor_reads_the_legacy_cache(self) -> None:
        org = self.create_organization()
        cache_key = legacy_recalibration_cache.generate_recalibrate_orgs_cache_key(org.id)
        self.redis.delete(cache_key)
        self.addCleanup(self.redis.delete, cache_key)
        self.redis.set(cache_key, 2.5)

        assert get_cached_recalibration_factor(org.id) == 2.5

    def test_get_cached_recalibration_factor_reports_a_cache_miss_as_the_identity(self) -> None:
        org = self.create_organization()
        cache_key = legacy_recalibration_cache.generate_recalibrate_orgs_cache_key(org.id)
        self.addCleanup(self.redis.delete, cache_key)

        # Writing the identity factor deletes the key, so a miss is how 1.0 is stored.
        legacy_recalibration_cache.set_guarded_adjusted_factor(org.id, 1.0)
        assert self.redis.get(cache_key) is None
        assert get_cached_recalibration_factor(org.id) == 1.0

    def test_relative_tolerance(self) -> None:
        assert is_within_relative_tolerance(0.95, 1.0)
        assert is_within_relative_tolerance(1.05, 1.0)
        assert not is_within_relative_tolerance(0.94, 1.0)
        assert not is_within_relative_tolerance(1.06, 1.0)
        assert is_within_relative_tolerance(0.0, 0.0)
        assert not is_within_relative_tolerance(0.01, 0.0)
        assert not is_within_relative_tolerance(None, 1.0)

    def test_get_effective_sample_rate(self) -> None:
        assert get_effective_sample_rate(
            OrganizationDataVolume(org_id=1, total=100, indexed=25)
        ) == pytest.approx(0.25)
        assert get_effective_sample_rate(None) is None
        assert (
            get_effective_sample_rate(OrganizationDataVolume(org_id=1, total=100, indexed=None))
            is None
        )
        assert (
            get_effective_sample_rate(OrganizationDataVolume(org_id=1, total=0, indexed=10)) is None
        )

    def test_get_effective_sample_rate_reports_an_overshoot_unclamped(self) -> None:
        # Unlike the rate the factor is computed from, this one stays raw, so the comparison
        # log keeps showing that the sources disagreed and by how much.
        assert get_effective_sample_rate(
            OrganizationDataVolume(org_id=1, total=100, indexed=172)
        ) == pytest.approx(1.72)


class ProjectBalancingComparisonTest(TestCase):
    def test_compare_rebalanced_projects_with_cache_logs_per_project(self) -> None:
        org = self.create_organization()
        project_with_volume = self.create_project(organization=org)
        project_without_volume = self.create_project(organization=org)
        config = mock_configuration(
            org,
            results=DynamicSamplingResults(
                rebalanced_projects=[
                    RebalancedItem(id=project_with_volume.id, count=100, new_sample_rate=0.25),
                    RebalancedItem(id=project_without_volume.id, count=0, new_sample_rate=1.0),
                ],
                project_volumes=[
                    ProjectVolume(project_id=project_with_volume.id, total=200, keep=100, drop=100),
                    ProjectVolume(project_id=project_without_volume.id, total=0, keep=0, drop=0),
                ],
            ),
        )
        cached_sample_rates: dict[int, float | None] = {
            project_with_volume.id: 0.2,
            project_without_volume.id: 0.96,
        }

        with (
            patch_configuration({CACHED_PROJECT_RATES: cached_sample_rates}),
            patch(LOGGER_INFO) as logger_info,
        ):
            compare_rebalanced_projects_with_cache(config)

        assert [call.args for call in logger_info.call_args_list] == [
            ("dynamic_sampling.per_org.project_balancing_comparison",),
            ("dynamic_sampling.per_org.project_balancing_comparison",),
        ]
        assert [call.kwargs["extra"] for call in logger_info.call_args_list] == [
            {
                "org_id": org.id,
                "ds_proj_id": project_with_volume.id,
                "generic_metrics_sample_rate": 0.2,
                "eap_sample_rate": 0.25,
                "relative_deviation": pytest.approx(0.2),
                "is_equal": False,
                "total_volume_eap": 100,
                "total_volume_eap_without_extrapolation": 100,
            },
            {
                "org_id": org.id,
                "ds_proj_id": project_without_volume.id,
                "generic_metrics_sample_rate": 0.96,
                "eap_sample_rate": 1.0,
                "relative_deviation": pytest.approx(0.04),
                "is_equal": True,
                "total_volume_eap": 0,
                "total_volume_eap_without_extrapolation": 0,
            },
        ]


class TransactionBalancingComparisonTest(TestCase):
    def test_compare_rebalanced_transactions_with_cache_logs_per_transaction(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        config = mock_configuration(
            org,
            results=DynamicSamplingResults(
                rebalanced_transactions={
                    project.id: (
                        [
                            RebalancedItem(id="checkout", count=100, new_sample_rate=0.25),
                            RebalancedItem(id="cart", count=50, new_sample_rate=0.96),
                        ],
                        0.5,
                    ),
                }
            ),
        )
        cached_sample_rates: dict[int, tuple[dict[str, float], float] | None] = {
            project.id: ({"checkout": 0.2, "cart": 1.0}, 0.45),
        }

        with (
            patch_configuration({CACHED_TRANSACTION_RATES: cached_sample_rates}),
            patch(LOGGER_INFO) as logger_info,
        ):
            compare_rebalanced_transactions_with_cache(config)

        messages = [call.args[0] for call in logger_info.call_args_list]
        assert messages == [
            "dynamic_sampling.per_org.transaction_balancing_implicit_comparison",
            "dynamic_sampling.per_org.transaction_balancing_comparison",
            "dynamic_sampling.per_org.transaction_balancing_comparison",
        ]
        extras = [call.kwargs["extra"] for call in logger_info.call_args_list]
        assert extras == [
            {
                "org_id": org.id,
                "ds_proj_id": project.id,
                "generic_metrics_implicit_rate": 0.45,
                "eap_implicit_rate": 0.5,
                "relative_deviation": pytest.approx(0.1),
                "is_equal": False,
            },
            {
                "org_id": org.id,
                "ds_proj_id": project.id,
                "transaction": "checkout",
                "generic_metrics_sample_rate": 0.2,
                "eap_sample_rate": 0.25,
                "relative_deviation": pytest.approx(0.2),
                "is_equal": False,
            },
            {
                "org_id": org.id,
                "ds_proj_id": project.id,
                "transaction": "cart",
                "generic_metrics_sample_rate": 1.0,
                "eap_sample_rate": 0.96,
                "relative_deviation": pytest.approx(0.04166666666666674),
                "is_equal": True,
            },
        ]

    def test_compare_rebalanced_transactions_with_cache_handles_cache_miss(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        config = mock_configuration(
            org,
            results=DynamicSamplingResults(
                rebalanced_transactions={
                    project.id: (
                        [RebalancedItem(id="checkout", count=10, new_sample_rate=0.5)],
                        0.5,
                    ),
                }
            ),
        )

        with (
            patch_configuration({CACHED_TRANSACTION_RATES: {project.id: None}}),
            patch(LOGGER_INFO) as logger_info,
        ):
            compare_rebalanced_transactions_with_cache(config)

        extras = [call.kwargs["extra"] for call in logger_info.call_args_list]
        assert extras[0]["generic_metrics_implicit_rate"] is None
        assert extras[0]["relative_deviation"] is None
        assert extras[0]["is_equal"] is False
        assert extras[1]["generic_metrics_sample_rate"] is None
        assert extras[1]["relative_deviation"] is None
        assert extras[1]["is_equal"] is False


class RecalibrationFactorComparisonTest(TestCase):
    def _config(
        self,
        org_volume: OrganizationDataVolume | None,
        factor: float | None,
        previous_factor: float,
        organization_volume: OrganizationDataVolume | None = None,
    ) -> Mock:
        return mock_configuration(
            self.organization,
            sample_rate=0.5,
            results=DynamicSamplingResults(
                organization_volume=organization_volume,
                recalibration_volume=org_volume,
                recalibration_factor=factor,
                previous_recalibration_factor=previous_factor,
            ),
        )

    def test_compare_recalibration_factor_with_cache_logs_the_deviation(self) -> None:
        org = self.organization
        org_volume = OrganizationDataVolume(org_id=org.id, total=772, indexed=288)
        legacy_volume = OrganizationDataVolume(org_id=org.id, total=772, indexed=386)
        config = self._config(
            org_volume,
            2.8,
            1.4,
            organization_volume=OrganizationDataVolume(org_id=org.id, total=900, indexed=288),
        )

        with (
            patch_configuration({CACHED_FACTOR: 2.0, LEGACY_VOLUME: legacy_volume}),
            patch(LOGGER_INFO) as logger_info,
        ):
            compare_recalibration_factor_with_cache(config)

        logger_info.assert_called_once_with(
            "dynamic_sampling.per_org.recalibration_factor_comparison",
            extra={
                "org_id": org.id,
                "sampling_mode": SAMPLING_MODE_DEFAULT,
                "sample_rate": 0.5,
                "generic_metrics_factor": 2.0,
                "eap_factor": 2.8,
                "previous_eap_factor": 1.4,
                "total_transactions": 772,
                "stored_segments": 288,
                "eap_effective_sample_rate": pytest.approx(0.3730569948186528),
                # EAP put the total at 900 where outcomes reported 772.
                "eap_extrapolated_total": 900,
                "extrapolated_total_relative_deviation": pytest.approx(0.16580310880829016),
                "generic_metrics_total": 772,
                "generic_metrics_indexed": 386,
                "generic_metrics_effective_sample_rate": pytest.approx(0.5),
                "relative_deviation": pytest.approx(0.2857142857142857),
                "is_equal": False,
                "comparison_outcome": "differs",
                # Both sides re-run from the legacy factor of 2.0, and the legacy volume sits
                # exactly at the target, so its factor is unchanged.
                "eap_factor_same_seed": pytest.approx(2.6805555555555554),
                "generic_metrics_factor_same_seed": pytest.approx(2.0),
                "same_seed_relative_deviation": pytest.approx(0.25388601036269415),
                "same_seed_is_equal": False,
            },
        )

    def test_compare_recalibration_factor_with_cache_reports_a_skipped_factor(self) -> None:
        org = self.organization
        config = self._config(None, None, 1.4)

        with (
            patch_configuration({CACHED_FACTOR: 2.0, LEGACY_VOLUME: None}),
            patch(LOGGER_INFO) as logger_info,
        ):
            compare_recalibration_factor_with_cache(config)

        assert logger_info.call_args.kwargs["extra"] == {
            "org_id": org.id,
            "sampling_mode": SAMPLING_MODE_DEFAULT,
            "sample_rate": 0.5,
            "generic_metrics_factor": 2.0,
            "eap_factor": None,
            "previous_eap_factor": 1.4,
            "total_transactions": None,
            "stored_segments": None,
            "eap_effective_sample_rate": None,
            "eap_extrapolated_total": None,
            "extrapolated_total_relative_deviation": None,
            "generic_metrics_total": None,
            "generic_metrics_indexed": None,
            "generic_metrics_effective_sample_rate": None,
            "relative_deviation": None,
            "is_equal": False,
            "comparison_outcome": "no_eap_factor",
            "eap_factor_same_seed": None,
            "generic_metrics_factor_same_seed": None,
            "same_seed_relative_deviation": None,
            "same_seed_is_equal": False,
        }

    def test_compare_recalibration_factor_with_cache_compares_an_identity_legacy_factor(
        self,
    ) -> None:
        org_volume = OrganizationDataVolume(org_id=self.organization.id, total=772, indexed=288)
        config = self._config(org_volume, 2.8, 1.0)

        with (
            patch_configuration({CACHED_FACTOR: 1.0, LEGACY_VOLUME: None}),
            patch(LOGGER_INFO) as logger_info,
        ):
            compare_recalibration_factor_with_cache(config)

        # A legacy factor of 1.0 is a converged organization, not a missing input, so it takes
        # part in the comparison and seeds the same-seed pair.
        extra = logger_info.call_args.kwargs["extra"]
        assert extra["comparison_outcome"] == "differs"
        assert extra["is_equal"] is False
        assert extra["relative_deviation"] == pytest.approx(0.6428571428571429)
        assert extra["eap_factor_same_seed"] == pytest.approx(1.3402777777777777)

    def test_compare_recalibration_factor_with_cache_reports_equal_within_tolerance(self) -> None:
        org_volume = OrganizationDataVolume(org_id=self.organization.id, total=772, indexed=288)
        config = self._config(org_volume, 2.8, 1.4)

        with (
            patch_configuration({CACHED_FACTOR: 2.75, LEGACY_VOLUME: None}),
            patch(LOGGER_INFO) as logger_info,
        ):
            compare_recalibration_factor_with_cache(config)

        extra = logger_info.call_args.kwargs["extra"]
        assert extra["comparison_outcome"] == "equal"
        assert extra["is_equal"] is True


class EmitComparisonsTest(TestCase):
    def test_nothing_is_emitted_for_an_empty_pass(self) -> None:
        config = mock_configuration(self.organization)

        with patch_configuration(ALL_COMPARISONS) as mocks:
            emit_comparisons(config)

        for target in ALL_COMPARISONS:
            mocks[target].assert_not_called()

    def test_each_comparison_covers_the_stage_that_produced_its_input(self) -> None:
        project = self.create_project(organization=self.organization)
        config = mock_configuration(
            self.organization,
            projects=[project],
            results=DynamicSamplingResults(
                rebalanced_projects=[
                    RebalancedItem(id=project.id, count=10, new_sample_rate=0.5),
                ],
                project_volumes=[ProjectVolume(project_id=project.id, total=10, keep=5, drop=5)],
            ),
        )

        with patch_configuration(ALL_COMPARISONS) as mocks:
            emit_comparisons(config)

        mocks[COMPARE_PROJECTS].assert_called_once_with(config)
        # No transaction stage ran, so nothing downstream of it is logged.
        mocks[LOG_TRANSACTION_VOLUMES].assert_not_called()
        mocks[COMPARE_TRANSACTIONS].assert_not_called()
        mocks[COMPARE_FACTOR].assert_not_called()

    @override_options({"dynamic-sampling.per_org.recalibration-rollout-rate": 1.0})
    def test_the_recalibration_comparison_covers_a_pass_that_produced_no_factor(self) -> None:
        config = mock_configuration(self.organization, sample_rate=0.5)

        with patch_configuration(ALL_COMPARISONS) as mocks:
            emit_comparisons(config)

        # No factor still reports the legacy one, which is how a pass where only EAP came up
        # short is told apart from one where neither pipeline had the volume.
        mocks[COMPARE_FACTOR].assert_called_once_with(config)

    @override_options({"dynamic-sampling.per_org.recalibration-rollout-rate": 1.0})
    def test_the_recalibration_comparison_skips_an_org_without_a_sample_rate(self) -> None:
        # Project-mode custom sampling has no organization sample rate, so recalibrate()
        # bails and there is nothing to compare against.
        config = mock_configuration(self.organization, sample_rate=None)

        with patch_configuration(ALL_COMPARISONS) as mocks:
            emit_comparisons(config)

        mocks[COMPARE_FACTOR].assert_not_called()

    @override_options({"dynamic-sampling.per_org.sample-rates-summary-log-rollout-rate": 1.0})
    def test_the_summary_log_covers_a_pass_that_reached_project_volumes(self) -> None:
        project = self.create_project(organization=self.organization)
        config = mock_configuration(
            self.organization,
            projects=[project],
            results=DynamicSamplingResults(
                project_volumes=[ProjectVolume(project_id=project.id, total=10, keep=5, drop=5)],
            ),
        )

        with patch_configuration(ALL_COMPARISONS) as mocks:
            emit_comparisons(config)

        mocks[LOG_SUMMARY].assert_called_once_with(config)

    def test_a_failing_comparison_does_not_stop_the_others(self) -> None:
        project = self.create_project(organization=self.organization)
        config = mock_configuration(
            self.organization,
            projects=[project],
            results=DynamicSamplingResults(
                rebalanced_projects=[
                    RebalancedItem(id=project.id, count=10, new_sample_rate=0.5),
                ],
                rebalanced_transactions={
                    project.id: ([RebalancedItem(id="/a", count=5, new_sample_rate=0.5)], 0.5)
                },
            ),
        )

        with (
            patch(COMPARE_PROJECTS, side_effect=ValueError("boom")),
            patch(COMPARE_TRANSACTIONS) as compare_transactions,
            patch(f"{COMPARISONS}.sentry_sdk.capture_exception") as capture_exception,
        ):
            emit_comparisons(config)

        compare_transactions.assert_called_once_with(config)
        capture_exception.assert_called_once()
