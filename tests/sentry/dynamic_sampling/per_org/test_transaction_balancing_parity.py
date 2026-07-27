from __future__ import annotations

from dataclasses import dataclass
from unittest.mock import Mock, patch

import orjson
import pytest

from sentry.dynamic_sampling.models.common import RebalancedItem
from sentry.dynamic_sampling.per_org.calculations import run_transaction_balancing
from sentry.dynamic_sampling.per_org.queries import ProjectTransactionCounts, ProjectVolume
from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds
from sentry.dynamic_sampling.tasks.boost_low_volume_transactions import (
    ProjectTransactions,
    boost_low_volume_transactions_of_project,
)
from sentry.dynamic_sampling.tasks.helpers.boost_low_volume_projects import (
    generate_boost_low_volume_projects_cache_key,
)
from sentry.dynamic_sampling.tasks.helpers.boost_low_volume_transactions import (
    generate_boost_low_volume_transactions_cache_key,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options

# The legacy task reads this from an option; the per-org pipeline hardcodes the same value
# as REBALANCE_INTENSITY. Pinned here so the two paths are driven by one number.
INTENSITY = 0.8

# The implicit sample rate floor is a per-org-only step with no legacy counterpart, so it
# breaks parity by construction. Parity assertions turn it off; the tests that cover the
# floor itself live in test_calculations.py.
PARITY_OPTIONS = {
    "dynamic-sampling.prioritise_transactions.rebalance_intensity": INTENSITY,
    "dynamic-sampling.prioritise_transactions.min_sample_rate": 0.0,
    "dynamic-sampling.per_org.apply-implicit-sample-rate-floor": False,
}


@dataclass(frozen=True)
class TransactionBalancingScenario:
    """One set of inputs, expressed once and fed to both implementations.

    The legacy task and the per-org pipeline take their inputs from different queries and
    different shapes, but the underlying quantities are the same four numbers plus the
    per-transaction counts. This holds those quantities so a test cannot accidentally give
    the two paths different data.
    """

    name: str
    sample_rate: float
    total_num_transactions: float
    total_num_classes: int
    transaction_counts: list[tuple[str, float]]

    def legacy_input(self, org_id: int, project_id: int) -> ProjectTransactions:
        return {
            "org_id": org_id,
            "project_id": project_id,
            "transaction_counts": list(self.transaction_counts),
            "total_num_transactions": self.total_num_transactions,
            "total_num_classes": self.total_num_classes,
        }

    def project_volume(self, project_id: int) -> ProjectVolume:
        return ProjectVolume(
            project_id=project_id,
            total=int(self.total_num_transactions),
            keep=0,
            drop=0,
            num_distinct_transactions=self.total_num_classes,
        )

    def transaction_counts_input(self, org_id: int, project_id: int) -> ProjectTransactionCounts:
        return ProjectTransactionCounts(
            org_id=org_id,
            project_id=project_id,
            transaction_counts=list(self.transaction_counts),
        )


SCENARIOS = (
    # Model branch: explicit budget exceeds explicit volume, so every explicit class is
    # pinned to 1.0 and the implicit tail absorbs the remainder.
    TransactionBalancingScenario(
        name="explicit-under-budget",
        sample_rate=0.5,
        total_num_transactions=1000.0,
        total_num_classes=100,
        transaction_counts=[("/checkout", 5.0), ("/cart", 3.0)],
    ),
    # Model branch: both pools can spend their budget, the common production case.
    TransactionBalancingScenario(
        name="balanced-pools",
        sample_rate=0.25,
        total_num_transactions=10_000.0,
        total_num_classes=50,
        transaction_counts=[
            ("/checkout", 5_000.0),
            ("/cart", 2_000.0),
            ("/health", 900.0),
            ("/rare", 10.0),
        ],
    ),
    # Model branch: the implicit tail cannot absorb its share, so it goes to 1.0 and the
    # explicit classes are re-rated against what is left.
    TransactionBalancingScenario(
        name="implicit-under-budget",
        sample_rate=0.5,
        total_num_transactions=1000.0,
        total_num_classes=3,
        transaction_counts=[("/checkout", 900.0), ("/cart", 90.0)],
    ),
    # Every class is explicit: no implicit tail at all.
    TransactionBalancingScenario(
        name="all-classes-explicit",
        sample_rate=0.3,
        total_num_transactions=300.0,
        total_num_classes=2,
        transaction_counts=[("/checkout", 200.0), ("/cart", 100.0)],
    ),
    # Long tail of low-volume classes drives the per-class ideal toward zero, which is what
    # the min_sample_rate floor exists to bound.
    TransactionBalancingScenario(
        name="long-tail",
        sample_rate=0.05,
        total_num_transactions=2_000_000.0,
        total_num_classes=100_000,
        transaction_counts=[("/big", 1_000_000.0), ("/medium", 100_000.0)],
    ),
)


class TransactionBalancingParityTest(TestCase):
    """Drive the legacy task and the per-org pipeline from one shared input.

    Both paths compute per-transaction sample rates from the same quantities and are meant
    to agree. This asserts on the values each one persists, rather than on the model call,
    so a divergence introduced anywhere between the input and the cache write is caught.
    """

    def setUp(self) -> None:
        super().setUp()
        self.redis = get_redis_client_for_ds()

    def _run_legacy(self, scenario: TransactionBalancingScenario) -> tuple[dict[str, float], float]:
        org = self.create_organization()
        project = self.create_project(organization=org)

        project_rates_key = generate_boost_low_volume_projects_cache_key(org_id=org.id)
        transaction_rates_key = generate_boost_low_volume_transactions_cache_key(
            org_id=org.id, proj_id=project.id
        )
        self.redis.delete(project_rates_key)
        self.redis.delete(transaction_rates_key)
        self.addCleanup(self.redis.delete, project_rates_key)
        self.addCleanup(self.redis.delete, transaction_rates_key)
        # The legacy task reads the project's rate from this cache.
        self.redis.hset(project_rates_key, str(project.id), str(scenario.sample_rate))

        with (
            self.feature("organizations:dynamic-sampling"),
            patch(
                "sentry.dynamic_sampling.tasks.boost_low_volume_transactions.schedule_invalidate_project_config"
            ),
        ):
            boost_low_volume_transactions_of_project(scenario.legacy_input(org.id, project.id))

        serialized = self.redis.get(transaction_rates_key)
        assert serialized is not None, "legacy task wrote no transaction rates"
        named_rates, implicit_rate = orjson.loads(serialized)
        return named_rates, float(implicit_rate)

    def _run_per_org(
        self, scenario: TransactionBalancingScenario
    ) -> tuple[dict[str, float], float]:
        org = self.create_organization()
        project = self.create_project(organization=org)
        config = Mock()
        config.organization = org
        config.get_project_sample_rates.return_value = {project.id: scenario.sample_rate}

        result = run_transaction_balancing(
            config,
            [scenario.project_volume(project.id)],
            [scenario.transaction_counts_input(org.id, project.id)],
        )

        assert project.id in result, "per-org pipeline produced no transaction rates"
        named_rates, implicit_rate = result[project.id]
        return (
            {str(item.id): item.new_sample_rate for item in named_rates},
            implicit_rate,
        )

    @override_options(PARITY_OPTIONS)
    def test_both_paths_agree_on_identical_input(self) -> None:
        for scenario in SCENARIOS:
            with self.subTest(scenario=scenario.name):
                legacy_named, legacy_implicit = self._run_legacy(scenario)
                per_org_named, per_org_implicit = self._run_per_org(scenario)

                assert per_org_named.keys() == legacy_named.keys()
                for transaction, legacy_rate in legacy_named.items():
                    assert per_org_named[transaction] == pytest.approx(legacy_rate), (
                        f"{scenario.name}: rate for {transaction} diverged"
                    )
                assert per_org_implicit == pytest.approx(legacy_implicit), (
                    f"{scenario.name}: implicit rate diverged"
                )

    @override_options(
        {**PARITY_OPTIONS, "dynamic-sampling.prioritise_transactions.min_sample_rate": 0.001}
    )
    def test_both_paths_agree_with_min_sample_rate_floor(self) -> None:
        """min_sample_rate is read from the same option by both paths, so it must not diverge.

        This is the per-class floor inside the shared model, not the per-org-only implicit
        floor, which PARITY_OPTIONS disables.
        """
        for scenario in SCENARIOS:
            with self.subTest(scenario=scenario.name):
                legacy_named, legacy_implicit = self._run_legacy(scenario)
                per_org_named, per_org_implicit = self._run_per_org(scenario)

                assert per_org_named.keys() == legacy_named.keys()
                for transaction, legacy_rate in legacy_named.items():
                    assert per_org_named[transaction] == pytest.approx(legacy_rate), (
                        f"{scenario.name}: rate for {transaction} diverged"
                    )
                assert per_org_implicit == pytest.approx(legacy_implicit), (
                    f"{scenario.name}: implicit rate diverged"
                )

    @override_options(PARITY_OPTIONS)
    def test_both_paths_agree_when_totals_are_missing(self) -> None:
        """The legacy task tolerates a missing totals row; the per-org pipeline does not.

        merge_transactions passes total=None and total_num_classes=None when the totals
        query has no row for a project. The model then falls back to the explicit-only
        totals, which collapses the class count and pushes the explicit rates to 1.0. The
        per-org pipeline requires a ProjectVolume and skips the project instead, so the two
        paths write different rates for the same project.
        """
        scenario = SCENARIOS[1]
        org = self.create_organization()
        project = self.create_project(organization=org)

        project_rates_key = generate_boost_low_volume_projects_cache_key(org_id=org.id)
        transaction_rates_key = generate_boost_low_volume_transactions_cache_key(
            org_id=org.id, proj_id=project.id
        )
        self.redis.delete(project_rates_key)
        self.redis.delete(transaction_rates_key)
        self.addCleanup(self.redis.delete, project_rates_key)
        self.addCleanup(self.redis.delete, transaction_rates_key)
        self.redis.hset(project_rates_key, str(project.id), str(scenario.sample_rate))

        legacy_input = scenario.legacy_input(org.id, project.id)
        legacy_input["total_num_transactions"] = None
        legacy_input["total_num_classes"] = None

        with (
            self.feature("organizations:dynamic-sampling"),
            patch(
                "sentry.dynamic_sampling.tasks.boost_low_volume_transactions.schedule_invalidate_project_config"
            ),
        ):
            boost_low_volume_transactions_of_project(legacy_input)

        serialized = self.redis.get(transaction_rates_key)
        assert serialized is not None
        legacy_named, legacy_implicit = orjson.loads(serialized)

        config = Mock()
        config.organization = org
        config.get_project_sample_rates.return_value = {project.id: scenario.sample_rate}
        # No ProjectVolume for this project, mirroring the missing totals row.
        per_org_result = run_transaction_balancing(
            config, [], [scenario.transaction_counts_input(org.id, project.id)]
        )

        assert project.id in per_org_result, (
            "per-org pipeline skipped the project while legacy wrote rates for it"
        )
        named_rates, per_org_implicit = per_org_result[project.id]
        per_org_named = {str(item.id): item.new_sample_rate for item in named_rates}

        assert per_org_named.keys() == legacy_named.keys()
        for transaction, legacy_rate in legacy_named.items():
            assert per_org_named[transaction] == pytest.approx(legacy_rate)
        assert per_org_implicit == pytest.approx(legacy_implicit)

    @override_options(PARITY_OPTIONS)
    def test_both_paths_agree_on_the_rates_relay_would_apply(self) -> None:
        """Rates are only equal in effect if the resulting Relay factors are equal.

        BoostLowVolumeTransactionsBias turns the stored rates into factors relative to the
        project's base rate. Comparing the factors catches a divergence that cancels out in
        the raw rates but not in what Relay actually multiplies.
        """
        scenario = SCENARIOS[1]
        legacy_named, legacy_implicit = self._run_legacy(scenario)
        per_org_named, per_org_implicit = self._run_per_org(scenario)

        def factors(
            named_rates: dict[str, float], implicit_rate: float
        ) -> tuple[dict[str, float], float]:
            base_implicit = implicit_rate if implicit_rate != 0.0 else 1.0
            return (
                {name: rate / base_implicit for name, rate in named_rates.items()},
                base_implicit / scenario.sample_rate,
            )

        legacy_factors, legacy_implicit_factor = factors(legacy_named, legacy_implicit)
        per_org_factors, per_org_implicit_factor = factors(per_org_named, per_org_implicit)

        assert per_org_factors.keys() == legacy_factors.keys()
        for transaction, legacy_factor in legacy_factors.items():
            assert per_org_factors[transaction] == pytest.approx(legacy_factor)
        assert per_org_implicit_factor == pytest.approx(legacy_implicit_factor)

    # Legacy reads the intensity from this option. The per-org pipeline hardcodes
    # REBALANCE_INTENSITY = 0.8, so moving the option off its default parts the two.
    @override_options(
        {**PARITY_OPTIONS, "dynamic-sampling.prioritise_transactions.rebalance_intensity": 0.3}
    )
    def test_both_paths_agree_when_intensity_option_moves_off_its_default(self) -> None:
        scenario = SCENARIOS[1]
        legacy_named, legacy_implicit = self._run_legacy(scenario)
        per_org_named, per_org_implicit = self._run_per_org(scenario)

        assert per_org_named.keys() == legacy_named.keys()
        for transaction, legacy_rate in legacy_named.items():
            assert per_org_named[transaction] == pytest.approx(legacy_rate), (
                f"rate for {transaction} diverged after the intensity option changed"
            )
        assert per_org_implicit == pytest.approx(legacy_implicit)


class TransactionBalancingParityModelInputTest(TestCase):
    """Assert the two paths hand the model identical inputs, not just identical outputs.

    Output parity can hide compensating differences. This captures the ModelInput each path
    builds from the same scenario and compares them field by field.
    """

    def setUp(self) -> None:
        super().setUp()
        self.redis = get_redis_client_for_ds()

    @override_options(PARITY_OPTIONS)
    def test_model_inputs_match(self) -> None:
        scenario = SCENARIOS[1]
        org = self.create_organization()
        project = self.create_project(organization=org)

        project_rates_key = generate_boost_low_volume_projects_cache_key(org_id=org.id)
        transaction_rates_key = generate_boost_low_volume_transactions_cache_key(
            org_id=org.id, proj_id=project.id
        )
        self.redis.delete(project_rates_key)
        self.redis.delete(transaction_rates_key)
        self.addCleanup(self.redis.delete, project_rates_key)
        self.addCleanup(self.redis.delete, transaction_rates_key)
        self.redis.hset(project_rates_key, str(project.id), str(scenario.sample_rate))

        stub_result = ([RebalancedItem(id="/checkout", count=1.0, new_sample_rate=0.5)], 0.5)

        with (
            self.feature("organizations:dynamic-sampling"),
            patch(
                "sentry.dynamic_sampling.tasks.boost_low_volume_transactions.schedule_invalidate_project_config"
            ),
            patch(
                "sentry.dynamic_sampling.tasks.boost_low_volume_transactions.TransactionsRebalancingModel.run",
                return_value=stub_result,
            ) as legacy_model_run,
        ):
            boost_low_volume_transactions_of_project(scenario.legacy_input(org.id, project.id))

        config = Mock()
        config.organization = org
        config.get_project_sample_rates.return_value = {project.id: scenario.sample_rate}

        with patch(
            "sentry.dynamic_sampling.per_org.calculations.TransactionsRebalancingModel.run",
            return_value=stub_result,
        ) as per_org_model_run:
            run_transaction_balancing(
                config,
                [scenario.project_volume(project.id)],
                [scenario.transaction_counts_input(org.id, project.id)],
            )

        legacy_input = legacy_model_run.call_args.args[-1]
        per_org_input = per_org_model_run.call_args.args[-1]

        assert per_org_input.sample_rate == legacy_input.sample_rate
        assert per_org_input.total == legacy_input.total
        assert per_org_input.total_num_classes == legacy_input.total_num_classes
        assert per_org_input.intensity == legacy_input.intensity
        assert per_org_input.min_sample_rate == legacy_input.min_sample_rate
        assert sorted((item.id, item.count) for item in per_org_input.classes) == sorted(
            (item.id, item.count) for item in legacy_input.classes
        )
