from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from unittest.mock import DEFAULT, MagicMock, patch

import orjson
import pytest

from sentry.constants import SAMPLING_MODE_DEFAULT
from sentry.dynamic_sampling.models.common import RebalancedItem
from sentry.dynamic_sampling.models.projects_rebalancing import ProjectsRebalancingInput
from sentry.dynamic_sampling.per_org import cache as per_org_recalibration_cache
from sentry.dynamic_sampling.per_org.calculations import (
    apply_project_sample_rate_overrides,
    calculate_recalibration_factor,
    compare_rebalanced_projects_with_cache,
    compare_rebalanced_transactions_with_cache,
    compare_recalibration_factor_with_cache,
    get_cached_per_org_recalibration_factor,
    get_cached_rebalanced_project_sample_rates,
    get_cached_rebalanced_transaction_sample_rates,
    get_cached_recalibration_factor,
    get_effective_sample_rate,
    is_within_relative_tolerance,
    run_project_balancing,
    run_transaction_balancing,
)
from sentry.dynamic_sampling.per_org.queries import ProjectTransactionCounts, ProjectVolume
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
    make_project_volume,
    mock_configuration,
    patch_configuration,
)

CALCULATIONS = "sentry.dynamic_sampling.per_org.calculations"
LOGGER_INFO = f"{CALCULATIONS}.logger.info"
PROJECTS_MODEL_RUN = f"{CALCULATIONS}.ProjectsRebalancingModel.run"
TRANSACTIONS_MODEL_RUN = f"{CALCULATIONS}.TransactionsRebalancingModel.run"


class ProjectBalancingCalculationsTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.redis = get_redis_client_for_ds()

    def test_run_project_balancing_returns_rebalanced_projects(self) -> None:
        org = self.create_organization()
        project_with_volume = self.create_project(organization=org)
        project_without_volume = self.create_project(organization=org)
        other_project = self.create_project()
        config = mock_configuration(
            org, projects=[project_with_volume, project_without_volume], sample_rate=0.5
        )
        rebalanced_projects = [
            RebalancedItem(id=project_with_volume.id, count=100, new_sample_rate=0.25),
        ]

        with patch_configuration({PROJECTS_MODEL_RUN: rebalanced_projects}) as mocks:
            result = run_project_balancing(
                config,
                [
                    make_project_volume(project_with_volume.id),
                    make_project_volume(project_without_volume.id, total=0, keep=0),
                    make_project_volume(other_project.id),
                ],
            )

        model_run = mocks[PROJECTS_MODEL_RUN]
        model_run.assert_called_once()
        model_input = model_run.call_args.args[-1]
        assert isinstance(model_input, ProjectsRebalancingInput)
        assert model_input.sample_rate == 0.5
        # Every project of the org is passed to the model; the one without volume is
        # included with a count of 0 so it receives a 100% sample rate. The project from
        # another org is excluded.
        assert model_input.classes == [
            RebalancedItem(id=project_with_volume.id, count=100),
            RebalancedItem(id=project_without_volume.id, count=0),
        ]
        assert result == rebalanced_projects

    def test_run_project_balancing_full_sample_rate_returns_all_projects_at_100_percent(
        self,
    ) -> None:
        org = self.create_organization()
        busy = self.create_project(organization=org)
        idle = self.create_project(organization=org)
        config = mock_configuration(org, projects=[busy, idle], sample_rate=1.0)

        with patch_configuration({PROJECTS_MODEL_RUN: DEFAULT}) as mocks:
            result = run_project_balancing(
                config,
                [
                    make_project_volume(busy.id, total=1000),
                    make_project_volume(idle.id, total=0, keep=0),
                ],
            )

        # Mirrors legacy serving: a 100% org rate gives every project 100% and the balancing
        # model never runs.
        mocks[PROJECTS_MODEL_RUN].assert_not_called()
        assert {int(item.id): item.new_sample_rate for item in result} == {
            busy.id: 1.0,
            idle.id: 1.0,
        }

    def test_run_project_balancing_assigns_full_sample_rate_to_zero_volume_projects(self) -> None:
        org = self.create_organization()
        project_with_volume = self.create_project(organization=org)
        project_without_volume = self.create_project(organization=org)
        config = mock_configuration(
            org, projects=[project_with_volume, project_without_volume], sample_rate=0.5
        )

        result = run_project_balancing(
            config,
            [
                make_project_volume(project_with_volume.id, total=100),
                make_project_volume(project_without_volume.id, total=0, keep=0),
            ],
        )

        rates_by_id = {int(item.id): item.new_sample_rate for item in result}
        assert rates_by_id[project_without_volume.id] == 1.0

    def test_run_project_balancing_returns_empty_when_no_volume(self) -> None:
        org = self.create_organization()
        project_a = self.create_project(organization=org)
        project_b = self.create_project(organization=org)
        config = mock_configuration(org, projects=[project_a, project_b], sample_rate=0.5)

        result = run_project_balancing(
            config,
            [
                make_project_volume(project_a.id, total=0, keep=0),
                make_project_volume(project_b.id, total=0, keep=0),
            ],
        )

        assert result == []

    def test_apply_project_sample_rate_overrides(self) -> None:
        overridden_id = 1001
        normal_id = 1002
        rebalanced_projects = [
            RebalancedItem(id=overridden_id, count=100, new_sample_rate=0.25),
            RebalancedItem(id=normal_id, count=100, new_sample_rate=0.25),
        ]

        with override_options(
            {"dynamic-sampling.sample-rate-override-per-project": {str(overridden_id): 0.9}}
        ):
            result = apply_project_sample_rate_overrides(rebalanced_projects)

        result_by_id = {item.id: item.new_sample_rate for item in result}
        # Overridden project gets the option value; the other keeps its balanced rate.
        assert result_by_id[overridden_id] == 0.9
        assert result_by_id[normal_id] == 0.25

    def test_apply_project_sample_rate_overrides_noop_without_option(self) -> None:
        rebalanced_projects = [
            RebalancedItem(id=2001, count=100, new_sample_rate=0.25),
        ]
        # No overrides configured -> the balanced rates are returned untouched.
        result = apply_project_sample_rate_overrides(rebalanced_projects)
        assert result == rebalanced_projects

    def test_compare_rebalanced_projects_with_cache_logs_per_project(self) -> None:
        org = self.create_organization()
        project_with_volume = self.create_project(organization=org)
        project_without_volume = self.create_project(organization=org)
        config = mock_configuration(org)
        rebalanced_projects = [
            RebalancedItem(id=project_with_volume.id, count=100, new_sample_rate=0.25),
            RebalancedItem(id=project_without_volume.id, count=0, new_sample_rate=1.0),
        ]
        cached_sample_rates: dict[int, float | None] = {
            project_with_volume.id: 0.2,
            project_without_volume.id: 0.96,
        }
        project_volumes = [
            ProjectVolume(project_id=project_with_volume.id, total=200, keep=100, drop=100),
            ProjectVolume(project_id=project_without_volume.id, total=0, keep=0, drop=0),
        ]

        with patch(LOGGER_INFO) as logger_info:
            compare_rebalanced_projects_with_cache(
                config, rebalanced_projects, cached_sample_rates, project_volumes
            )

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

    def test_project_balancing_relative_tolerance(self) -> None:
        assert is_within_relative_tolerance(0.95, 1.0)
        assert is_within_relative_tolerance(1.05, 1.0)
        assert not is_within_relative_tolerance(0.94, 1.0)
        assert not is_within_relative_tolerance(1.06, 1.0)
        assert is_within_relative_tolerance(0.0, 0.0)
        assert not is_within_relative_tolerance(0.01, 0.0)
        assert not is_within_relative_tolerance(None, 1.0)

    def test_get_cached_rebalanced_project_sample_rates(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        cache_key = generate_boost_low_volume_projects_cache_key(org.id)
        self.redis.delete(cache_key)
        self.addCleanup(self.redis.delete, cache_key)
        self.redis.hset(cache_key, str(project.id), "0.25")

        assert get_cached_rebalanced_project_sample_rates(org.id) == {project.id: 0.25}

    def test_calculate_recalibration_factor(self) -> None:
        org_volume = OrganizationDataVolume(org_id=1, total=100, indexed=25)
        adjusted_factor = calculate_recalibration_factor(org_volume, 1.4, 0.5)
        assert adjusted_factor == 2.8

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

    def test_get_cached_per_org_recalibration_factor_reads_the_per_org_cache(self) -> None:
        org = self.create_organization()
        cache_key = per_org_recalibration_cache.generate_recalibrate_orgs_cache_key(org.id)
        self.redis.delete(cache_key)
        self.addCleanup(self.redis.delete, cache_key)

        assert get_cached_per_org_recalibration_factor(org.id) == 1.0

        self.redis.set(cache_key, 3.5)
        assert get_cached_per_org_recalibration_factor(org.id) == 3.5

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

    def test_compare_recalibration_factor_with_cache_logs_the_deviation(self) -> None:
        org = self.create_organization()
        config = mock_configuration(org, sample_rate=0.5)
        org_volume = OrganizationDataVolume(org_id=org.id, total=772, indexed=288)
        legacy_volume = OrganizationDataVolume(org_id=org.id, total=772, indexed=386)

        with patch(LOGGER_INFO) as logger_info:
            compare_recalibration_factor_with_cache(
                config,
                org_volume,
                2.8,
                2.0,
                previous_eap_factor=1.4,
                legacy_volume=legacy_volume,
            )

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
        org = self.create_organization()
        config = mock_configuration(org, sample_rate=0.5)

        with patch(LOGGER_INFO) as logger_info:
            compare_recalibration_factor_with_cache(config, None, None, 2.0, 1.4)

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
        org = self.create_organization()
        config = mock_configuration(org, sample_rate=0.5)
        org_volume = OrganizationDataVolume(org_id=org.id, total=772, indexed=288)

        with patch(LOGGER_INFO) as logger_info:
            compare_recalibration_factor_with_cache(config, org_volume, 2.8, 1.0, 1.0)

        # A legacy factor of 1.0 is a converged organization, not a missing input, so it takes
        # part in the comparison and seeds the same-seed pair.
        extra = logger_info.call_args.kwargs["extra"]
        assert extra["comparison_outcome"] == "differs"
        assert extra["is_equal"] is False
        assert extra["relative_deviation"] == pytest.approx(0.6428571428571429)
        assert extra["eap_factor_same_seed"] == pytest.approx(1.3402777777777777)

    def test_compare_recalibration_factor_with_cache_reports_equal_within_tolerance(self) -> None:
        org = self.create_organization()
        config = mock_configuration(org, sample_rate=0.5)
        org_volume = OrganizationDataVolume(org_id=org.id, total=772, indexed=288)

        with patch(LOGGER_INFO) as logger_info:
            compare_recalibration_factor_with_cache(config, org_volume, 2.8, 2.75, 1.4)

        extra = logger_info.call_args.kwargs["extra"]
        assert extra["comparison_outcome"] == "equal"
        assert extra["is_equal"] is True


def _project_transactions(
    org_id: int,
    project_id: int,
    transaction_counts: list[tuple[str, float]],
) -> ProjectTransactionCounts:
    return ProjectTransactionCounts(
        org_id=org_id,
        project_id=project_id,
        transaction_counts=transaction_counts,
    )


@contextmanager
def patch_transactions_model() -> Iterator[MagicMock]:
    """Patch the rebalancing model to echo back the sample rate it received."""
    with patch(
        TRANSACTIONS_MODEL_RUN,
        side_effect=lambda model_input: ([], model_input.sample_rate),
    ) as model_run:
        yield model_run


class TransactionBalancingCalculationsTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.redis = get_redis_client_for_ds()

    def test_run_transaction_balancing_uses_config_provided_rates(self) -> None:
        org = self.create_organization()
        project_a = self.create_project(organization=org)
        project_b = self.create_project(organization=org)
        config = mock_configuration(
            org, project_sample_rates={project_a.id: 0.2, project_b.id: 0.8}
        )

        with patch_transactions_model() as model_run:
            run_transaction_balancing(
                config,
                [make_project_volume(project_a.id), make_project_volume(project_b.id)],
                [
                    _project_transactions(org.id, project_a.id, [("/a", 1.0)]),
                    _project_transactions(org.id, project_b.id, [("/b", 1.0)]),
                ],
            )

        config.get_project_sample_rates.assert_called_once_with()
        sample_rates = [call.args[-1].sample_rate for call in model_run.call_args_list]
        assert sample_rates == [0.2, 0.8]

    def test_run_transaction_balancing_skips_projects_without_sample_rate(self) -> None:
        org = self.create_organization()
        project_a = self.create_project(organization=org)
        project_b = self.create_project(organization=org)
        config = mock_configuration(
            org, project_sample_rates={project_a.id: 0.5, project_b.id: None}
        )

        with patch_transactions_model() as model_run:
            result = run_transaction_balancing(
                config,
                [make_project_volume(project_a.id), make_project_volume(project_b.id)],
                [
                    _project_transactions(org.id, project_a.id, [("/a", 1.0)]),
                    _project_transactions(org.id, project_b.id, [("/b", 1.0)]),
                ],
            )

        sample_rates = [call.args[-1].sample_rate for call in model_run.call_args_list]
        assert sample_rates == [0.5]
        assert set(result.keys()) == {project_a.id}

    def test_run_transaction_balancing_skips_projects_at_full_sample_rate(self) -> None:
        org = self.create_organization()
        project_a = self.create_project(organization=org)
        project_b = self.create_project(organization=org)
        config = mock_configuration(
            org, project_sample_rates={project_a.id: 0.5, project_b.id: 1.0}
        )

        with patch_transactions_model() as model_run:
            result = run_transaction_balancing(
                config,
                [make_project_volume(project_a.id), make_project_volume(project_b.id)],
                [
                    _project_transactions(org.id, project_a.id, [("/a", 1.0)]),
                    _project_transactions(org.id, project_b.id, [("/b", 1.0)]),
                ],
            )

        sample_rates = [call.args[-1].sample_rate for call in model_run.call_args_list]
        assert sample_rates == [0.5]
        assert set(result.keys()) == {project_a.id}

    def test_run_transaction_balancing_skips_projects_without_project_volume(self) -> None:
        org = self.create_organization()
        project_a = self.create_project(organization=org)
        project_b = self.create_project(organization=org)
        config = mock_configuration(
            org, project_sample_rates={project_a.id: 0.5, project_b.id: 0.5}
        )

        with patch_transactions_model() as model_run:
            # project_b has transactions but no matching ProjectVolume — it must be
            # skipped instead of raising a KeyError that aborts the whole org's run.
            result = run_transaction_balancing(
                config,
                [make_project_volume(project_a.id)],
                [
                    _project_transactions(org.id, project_a.id, [("/a", 1.0)]),
                    _project_transactions(org.id, project_b.id, [("/b", 1.0)]),
                ],
            )

        assert model_run.call_count == 1
        assert set(result.keys()) == {project_a.id}

    def test_run_transaction_balancing_passes_min_sample_rate_option(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        config = mock_configuration(org, project_sample_rates={project.id: 0.5})

        with (
            override_options({"dynamic-sampling.prioritise_transactions.min_sample_rate": 0.002}),
            patch_transactions_model() as model_run,
        ):
            run_transaction_balancing(
                config,
                [make_project_volume(project.id)],
                [_project_transactions(org.id, project.id, [("/a", 1.0)])],
            )

        assert model_run.call_args.args[-1].min_sample_rate == 0.002

    def test_run_transaction_balancing_floors_dominant_transaction(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        config = mock_configuration(org, project_sample_rates={project.id: 0.05})

        project_volume = ProjectVolume(
            project_id=project.id,
            total=2_000_000,
            keep=100_000,
            drop=1_900_000,
            num_distinct_transactions=100_000,
        )
        project_transactions = _project_transactions(org.id, project.id, [("/big", 1_000_000.0)])

        with override_options({"dynamic-sampling.prioritise_transactions.min_sample_rate": 0.001}):
            result = run_transaction_balancing(config, [project_volume], [project_transactions])

        named_rates, implicit_rate = result[project.id]
        (big_rate,) = named_rates
        # without the floor this rate collapses to 1e-6 (a 1,000,000x extrapolation factor)
        assert big_rate.new_sample_rate == pytest.approx(0.001)
        assert implicit_rate == pytest.approx(0.099)

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

    def test_compare_rebalanced_transactions_with_cache_logs_per_transaction(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        config = mock_configuration(org)
        rebalanced_transactions = {
            project.id: (
                [
                    RebalancedItem(id="checkout", count=100, new_sample_rate=0.25),
                    RebalancedItem(id="cart", count=50, new_sample_rate=0.96),
                ],
                0.5,
            ),
        }
        cached_sample_rates: dict[int, tuple[dict[str, float], float] | None] = {
            project.id: ({"checkout": 0.2, "cart": 1.0}, 0.45),
        }

        with patch(LOGGER_INFO) as logger_info:
            compare_rebalanced_transactions_with_cache(
                config, rebalanced_transactions, cached_sample_rates
            )

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
        config = mock_configuration(org)
        rebalanced_transactions = {
            project.id: ([RebalancedItem(id="checkout", count=10, new_sample_rate=0.5)], 0.5),
        }

        with patch(LOGGER_INFO) as logger_info:
            compare_rebalanced_transactions_with_cache(
                config, rebalanced_transactions, {project.id: None}
            )

        extras = [call.kwargs["extra"] for call in logger_info.call_args_list]
        assert extras[0]["generic_metrics_implicit_rate"] is None
        assert extras[0]["relative_deviation"] is None
        assert extras[0]["is_equal"] is False
        assert extras[1]["generic_metrics_sample_rate"] is None
        assert extras[1]["relative_deviation"] is None
        assert extras[1]["is_equal"] is False


class TransactionBalancingModelOutputTest(TestCase):
    def test_model_output_is_stored_as_is(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        config = mock_configuration(org, project_sample_rates={project.id: 0.1})

        # Branch 3 of TransactionsRebalancingModel: the explicit pool is too small to absorb
        # its budget share, so the model returns an implicit rate below the project rate.
        project_volume = ProjectVolume(
            project_id=project.id, total=1000, keep=0, drop=0, num_distinct_transactions=10
        )
        project_transactions = ProjectTransactionCounts(
            org_id=org.id, project_id=project.id, transaction_counts=[("tiny", 5.0)]
        )

        result = run_transaction_balancing(config, [project_volume], [project_transactions])

        named_rates, implicit_rate = result[project.id]
        assert implicit_rate == pytest.approx(0.09547738693467336)
        assert [item.new_sample_rate for item in named_rates] == [1.0]
