from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from unittest.mock import DEFAULT, MagicMock, patch

import orjson
import pytest

from sentry.dynamic_sampling.models.common import RebalancedItem
from sentry.dynamic_sampling.models.projects_rebalancing import ProjectsRebalancingInput
from sentry.dynamic_sampling.per_org.calculations import (
    TransactionVolumeDebug,
    apply_project_sample_rate_overrides,
    calculate_recalibration_factor,
    collect_transaction_volume_debug,
    get_cached_rebalanced_project_sample_rates,
    get_cached_rebalanced_transaction_sample_rates,
    get_cached_recalibration_factor,
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
PROJECTS_MODEL_RUN = f"{CALCULATIONS}.ProjectsRebalancingModel.run"
TRANSACTIONS_MODEL_RUN = f"{CALCULATIONS}.TransactionsRebalancingModel.run"
GENERIC_METRICS_TRANSACTION_VOLUMES = f"{CALCULATIONS}.get_generic_metrics_transaction_volumes"


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

    def test_collect_transaction_volume_debug_collects_both_pipelines(self) -> None:
        org = self.create_organization()
        debugged = self.create_project(organization=org)
        other = self.create_project(organization=org)
        config = mock_configuration(org, projects=[debugged, other])
        transaction_volumes = [
            _project_transactions(org.id, debugged.id, [("/checkout", 600.0)]),
            _project_transactions(org.id, other.id, [("/api", 200.0)]),
        ]

        with patch_configuration(
            {GENERIC_METRICS_TRANSACTION_VOLUMES: {debugged.id: [("/legacy-only", 20.0)]}}
        ):
            result = collect_transaction_volume_debug(config, transaction_volumes, {debugged.id})

        # Only the debugged project is collected, with the volumes of both pipelines side by
        # side even where a transaction is missing from one of them.
        assert result == [
            TransactionVolumeDebug(
                project_id=debugged.id,
                eap_volumes={"/checkout": 600.0},
                generic_metrics_volumes={"/legacy-only": 20.0},
            )
        ]


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
