from __future__ import annotations

from unittest.mock import Mock, patch

import orjson
import pytest

from sentry.dynamic_sampling.models.common import RebalancedItem
from sentry.dynamic_sampling.models.projects_rebalancing import ProjectsRebalancingInput
from sentry.dynamic_sampling.per_org.calculations import (
    apply_project_sample_rate_overrides,
    compare_rebalanced_projects_with_cache,
    compare_rebalanced_transactions_with_cache,
    get_cached_rebalanced_project_sample_rates,
    get_cached_rebalanced_transaction_sample_rates,
    is_within_relative_tolerance,
    run_project_balancing,
    run_transaction_balancing,
)
from sentry.dynamic_sampling.per_org.queries import ProjectTransactionCounts, ProjectVolume
from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds
from sentry.dynamic_sampling.tasks.helpers.boost_low_volume_projects import (
    generate_boost_low_volume_projects_cache_key,
)
from sentry.dynamic_sampling.tasks.helpers.boost_low_volume_transactions import (
    generate_boost_low_volume_transactions_cache_key,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options


def _project_volume(project_id: int, total: int = 100, keep: int = 25) -> ProjectVolume:
    return ProjectVolume(project_id=project_id, total=total, keep=keep, drop=max(total - keep, 0))


class ProjectBalancingCalculationsTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.redis = get_redis_client_for_ds()

    def test_run_project_balancing_returns_rebalanced_projects(self) -> None:
        org = self.create_organization()
        project_with_volume = self.create_project(organization=org)
        project_without_volume = self.create_project(organization=org)
        other_project = self.create_project()
        config = Mock()
        config.organization = org
        config.projects = [project_with_volume, project_without_volume]
        config.get_sample_rate.return_value = 0.5
        rebalanced_projects = [
            RebalancedItem(id=project_with_volume.id, count=100, new_sample_rate=0.25),
        ]

        with patch(
            "sentry.dynamic_sampling.per_org.calculations.ProjectsRebalancingModel.run",
            return_value=rebalanced_projects,
        ) as model_run:
            result = run_project_balancing(
                config,
                [
                    _project_volume(project_with_volume.id),
                    _project_volume(project_without_volume.id, total=0, keep=0),
                    _project_volume(other_project.id),
                ],
            )

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
        config = Mock()
        config.organization = org
        config.projects = [busy, idle]
        config.get_sample_rate.return_value = 1.0

        with patch(
            "sentry.dynamic_sampling.per_org.calculations.ProjectsRebalancingModel.run"
        ) as model_run:
            result = run_project_balancing(
                config,
                [_project_volume(busy.id, total=1000), _project_volume(idle.id, total=0, keep=0)],
            )

        # Mirrors legacy serving: a 100% org rate gives every project 100% and the balancing
        # model never runs.
        model_run.assert_not_called()
        assert {int(item.id): item.new_sample_rate for item in result} == {
            busy.id: 1.0,
            idle.id: 1.0,
        }

    def test_run_project_balancing_assigns_full_sample_rate_to_zero_volume_projects(self) -> None:
        org = self.create_organization()
        project_with_volume = self.create_project(organization=org)
        project_without_volume = self.create_project(organization=org)
        config = Mock()
        config.organization = org
        config.projects = [project_with_volume, project_without_volume]
        config.get_sample_rate.return_value = 0.5

        result = run_project_balancing(
            config,
            [
                _project_volume(project_with_volume.id, total=100),
                _project_volume(project_without_volume.id, total=0, keep=0),
            ],
        )

        rates_by_id = {int(item.id): item.new_sample_rate for item in result}
        assert rates_by_id[project_without_volume.id] == 1.0

    def test_run_project_balancing_returns_empty_when_no_volume(self) -> None:
        org = self.create_organization()
        project_a = self.create_project(organization=org)
        project_b = self.create_project(organization=org)
        config = Mock()
        config.organization = org
        config.projects = [project_a, project_b]
        config.get_sample_rate.return_value = 0.5

        result = run_project_balancing(
            config,
            [
                _project_volume(project_a.id, total=0, keep=0),
                _project_volume(project_b.id, total=0, keep=0),
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
        config = Mock()
        config.organization = org
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

        with patch("sentry.dynamic_sampling.per_org.calculations.logger.info") as logger_info:
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


class TransactionBalancingCalculationsTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.redis = get_redis_client_for_ds()

    def test_run_transaction_balancing_uses_config_provided_rates(self) -> None:
        org = self.create_organization()
        project_a = self.create_project(organization=org)
        project_b = self.create_project(organization=org)
        config = Mock()
        config.organization = org
        config.get_project_sample_rates.return_value = {project_a.id: 0.2, project_b.id: 0.8}

        with patch(
            "sentry.dynamic_sampling.per_org.calculations.TransactionsRebalancingModel.run",
            side_effect=lambda model_input: ([], model_input.sample_rate),
        ) as model_run:
            run_transaction_balancing(
                config,
                [_project_volume(project_a.id), _project_volume(project_b.id)],
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
        config = Mock()
        config.organization = org
        config.get_project_sample_rates.return_value = {project_a.id: 0.5, project_b.id: None}

        with patch(
            "sentry.dynamic_sampling.per_org.calculations.TransactionsRebalancingModel.run",
            side_effect=lambda model_input: ([], model_input.sample_rate),
        ) as model_run:
            result = run_transaction_balancing(
                config,
                [_project_volume(project_a.id), _project_volume(project_b.id)],
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
        config = Mock()
        config.organization = org
        config.get_project_sample_rates.return_value = {project_a.id: 0.5, project_b.id: 1.0}

        with patch(
            "sentry.dynamic_sampling.per_org.calculations.TransactionsRebalancingModel.run",
            side_effect=lambda model_input: ([], model_input.sample_rate),
        ) as model_run:
            result = run_transaction_balancing(
                config,
                [_project_volume(project_a.id), _project_volume(project_b.id)],
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
        config = Mock()
        config.organization = org
        config.get_project_sample_rates.return_value = {project_a.id: 0.5, project_b.id: 0.5}

        with patch(
            "sentry.dynamic_sampling.per_org.calculations.TransactionsRebalancingModel.run",
            side_effect=lambda model_input: ([], model_input.sample_rate),
        ) as model_run:
            # project_b has transactions but no matching ProjectVolume — it must be
            # skipped instead of raising a KeyError that aborts the whole org's run.
            result = run_transaction_balancing(
                config,
                [_project_volume(project_a.id)],
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
        config = Mock()
        config.organization = org
        config.get_project_sample_rates.return_value = {project.id: 0.5}

        with override_options({"dynamic-sampling.prioritise_transactions.min_sample_rate": 0.002}):
            with patch(
                "sentry.dynamic_sampling.per_org.calculations.TransactionsRebalancingModel.run",
                side_effect=lambda model_input: ([], model_input.sample_rate),
            ) as model_run:
                run_transaction_balancing(
                    config,
                    [_project_volume(project.id)],
                    [_project_transactions(org.id, project.id, [("/a", 1.0)])],
                )

        assert model_run.call_args.args[-1].min_sample_rate == 0.002

    def test_run_transaction_balancing_floors_dominant_transaction(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        config = Mock()
        config.organization = org
        config.get_project_sample_rates.return_value = {project.id: 0.05}

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
        config = Mock()
        config.organization = org
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

        with patch("sentry.dynamic_sampling.per_org.calculations.logger.info") as logger_info:
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
        config = Mock()
        config.organization = org
        rebalanced_transactions = {
            project.id: ([RebalancedItem(id="checkout", count=10, new_sample_rate=0.5)], 0.5),
        }

        with patch("sentry.dynamic_sampling.per_org.calculations.logger.info") as logger_info:
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


def _branch3_project_volume(project_id: int) -> ProjectVolume:
    """The full-project totals that drive TransactionsRebalancingModel into
    branch 3 (explicit pool too small to absorb its budget share), producing an
    implicit rate below the base sample rate."""
    return ProjectVolume(
        project_id=project_id, total=1000, keep=0, drop=0, num_distinct_transactions=10
    )


def _branch3_transactions(org_id: int, project_id: int) -> ProjectTransactionCounts:
    return ProjectTransactionCounts(
        org_id=org_id, project_id=project_id, transaction_counts=[("tiny", 5.0)]
    )


class TransactionBalancingImplicitFactorFloorTest(TestCase):
    """Tests for the implicit factor floor that clamps the implicit factor
    via budget redistribution from the explicit pool."""

    def test_factor_one_lifts_implicit_rate_to_base(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        config = Mock()
        config.organization = org
        config.get_project_sample_rates.return_value = {project.id: 0.1}

        result = run_transaction_balancing(
            config,
            [_branch3_project_volume(project.id)],
            [_branch3_transactions(org.id, project.id)],
        )

        named_rates, implicit_rate = result[project.id]
        assert implicit_rate == pytest.approx(0.1)
        # Explicit rate is reduced from 1.0 to absorb the extra implicit budget,
        # so the overall budget remains at total * base_sample_rate = 100.
        assert len(named_rates) == 1
        new_explicit_rate = named_rates[0].new_sample_rate
        total = 1000.0
        total_explicit = 5.0
        total_implicit = total - total_explicit
        kept = new_explicit_rate * total_explicit + implicit_rate * total_implicit
        assert kept == pytest.approx(total * 0.1, abs=1e-6)

    def test_no_change_when_implicit_already_above_floor(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        config = Mock()
        config.organization = org
        config.get_project_sample_rates.return_value = {project.id: 0.1}

        # Branch 2 scenario: small long tail relative to its share → implicit_rate=1.0,
        # which is already well above any factor floor we'd set.
        project_volume = ProjectVolume(
            project_id=project.id, total=1010, keep=0, drop=0, num_distinct_transactions=11
        )
        project_transactions = ProjectTransactionCounts(
            org_id=org.id, project_id=project.id, transaction_counts=[("heavy", 1000.0)]
        )

        result = run_transaction_balancing(config, [project_volume], [project_transactions])

        _, implicit_rate = result[project.id]
        assert implicit_rate == 1.0
