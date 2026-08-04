from __future__ import annotations

from collections.abc import Iterator, Mapping
from contextlib import contextmanager
from typing import Any
from unittest.mock import MagicMock, patch

import orjson
import pytest
from django.core.exceptions import ObjectDoesNotExist

from sentry.constants import ObjectStatus
from sentry.dynamic_sampling.per_org import cache as per_org_recalibration_cache
from sentry.dynamic_sampling.per_org.calculations import PerOrgCalculations
from sentry.dynamic_sampling.per_org.gate import (
    RECALIBRATION_ROLLOUT_RATE_OPTION,
    ROLLOUT_RATE_OPTION,
    SAMPLE_RATES_SUMMARY_LOG_ROLLOUT_RATE_OPTION,
)
from sentry.dynamic_sampling.per_org.queries import ProjectTransactionCounts, ProjectVolume
from sentry.dynamic_sampling.per_org.scheduler import (
    run_calculations_per_org_task,
    run_per_org_calculations,
    schedule_per_org_calculations,
)
from sentry.dynamic_sampling.per_org.telemetry import (
    DynamicSamplingException,
    DynamicSamplingStatus,
)
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
from sentry.dynamic_sampling.tasks.helpers.sliding_window import (
    generate_sliding_window_org_cache_key,
)
from sentry.dynamic_sampling.types import DynamicSamplingMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from tests.sentry.dynamic_sampling.per_org.test_helpers import (
    BLENDED_SAMPLE_RATE,
    OUTCOMES_VOLUME,
    SAMPLED_VOLUME,
    patch_configuration,
)

SCHEDULER = "sentry.dynamic_sampling.per_org.scheduler"
ORG_VOLUME = f"{SCHEDULER}.get_eap_organization_volume"
PROJECT_VOLUMES = f"{SCHEDULER}.get_eap_project_volumes"
TRANSACTION_VOLUMES = f"{SCHEDULER}.get_eap_transaction_volumes"
LOG_COMPARISON = f"{SCHEDULER}.log_comparison_with_legacy_pipeline"

# What the transaction model gives "/checkout" once the busy project sits at a 40% rate.
CHECKOUT_SAMPLE_RATE = 0.19666666666666666


def transaction_sample_rates(
    calculations: PerOrgCalculations, project_id: int
) -> tuple[dict[str, float], float]:
    """The balanced transaction rates of one project, by transaction, plus its implicit rate."""
    named_rates, implicit_rate = calculations.rebalanced_transactions[project_id]
    return {str(item.id): item.new_sample_rate for item in named_rates}, implicit_rate


class PerOrgTaskTestCase(TestCase):
    """Base for tests that run the per-org calculations end to end.

    Only the boundaries are stubbed: the billing API and the Snuba queries. Balancing and the
    redis caches all run for real, so tests assert on what a run produced instead of which
    helper it happened to call.

    The default scenario is an AM2 organization at a 50% sample rate with two projects. The
    busy one keeps its balanced rate; the quiet one is pushed to 100% by the balancing
    model, which exercises the paths that skip projects already sampled in full.
    """

    def setUp(self) -> None:
        super().setUp()
        self.org = self.create_organization()
        self.busy_project = self.create_project(organization=self.org)
        self.quiet_project = self.create_project(organization=self.org)
        self.queries: Mapping[str, MagicMock] = {}

        self.org_volume = OrganizationDataVolume(org_id=self.org.id, total=1200, indexed=300)
        self.project_volumes = [
            ProjectVolume(
                project_id=self.busy_project.id,
                total=1000,
                keep=250,
                drop=750,
                num_distinct_transactions=4,
            ),
            ProjectVolume(
                project_id=self.quiet_project.id,
                total=200,
                keep=50,
                drop=150,
                num_distinct_transactions=2,
            ),
        ]
        self.transaction_volumes = [
            ProjectTransactionCounts(
                org_id=self.org.id,
                project_id=self.busy_project.id,
                transaction_counts=[("/checkout", 600.0), ("/cart", 200.0)],
            ),
            ProjectTransactionCounts(
                org_id=self.org.id,
                project_id=self.quiet_project.id,
                transaction_counts=[("/api", 200.0)],
            ),
        ]
        # An effective sample rate of 300/1200 against a 50% target doubles the factor.
        self.sampled_volume = OrganizationDataVolume(org_id=self.org.id, total=1200, indexed=300)

        self.redis = get_redis_client_for_ds()
        cache_keys = [
            per_org_recalibration_cache.generate_recalibrate_orgs_cache_key(self.org.id),
            legacy_recalibration_cache.generate_recalibrate_orgs_cache_key(self.org.id),
            generate_boost_low_volume_projects_cache_key(org_id=self.org.id),
            generate_sliding_window_org_cache_key(self.org.id),
            *(
                generate_boost_low_volume_transactions_cache_key(
                    org_id=self.org.id, proj_id=project.id
                )
                for project in (self.busy_project, self.quiet_project)
            ),
        ]
        self.redis.delete(*cache_keys)
        self.addCleanup(self.redis.delete, *cache_keys)

    @contextmanager
    def patched(
        self,
        boundaries: Mapping[str, Any] | None = None,
        *,
        options: Mapping[str, Any] | None = None,
    ) -> Iterator[None]:
        """Stub the boundaries of a run and expose their mocks as ``self.queries``."""
        stubs: dict[str, Any] = {
            BLENDED_SAMPLE_RATE: 0.5,
            # No 24h outcomes volume, so the sliding window leaves the blended rate in place.
            OUTCOMES_VOLUME: None,
            SAMPLED_VOLUME: self.sampled_volume,
            ORG_VOLUME: self.org_volume,
            PROJECT_VOLUMES: self.project_volumes,
            TRANSACTION_VOLUMES: self.transaction_volumes,
            **(boundaries or {}),
        }
        with (
            override_options(
                {
                    ROLLOUT_RATE_OPTION: 1.0,
                    RECALIBRATION_ROLLOUT_RATE_OPTION: 1.0,
                    **(options or {}),
                }
            ),
            patch_configuration(stubs) as queries,
        ):
            self.queries = queries
            yield

    def run_calculations(
        self,
        boundaries: Mapping[str, Any] | None = None,
        *,
        options: Mapping[str, Any] | None = None,
        org_id: int | None = None,
    ) -> PerOrgCalculations:
        with self.patched(boundaries, options=options):
            return run_per_org_calculations(self.org.id if org_id is None else org_id)

    def seed_legacy_project_sample_rates(self, sample_rates: Mapping[int, float]) -> None:
        cache_key = generate_boost_low_volume_projects_cache_key(org_id=self.org.id)
        for project_id, rate in sample_rates.items():
            self.redis.hset(cache_key, str(project_id), str(rate))

    def seed_legacy_organization_sample_rate(self, sample_rate: float) -> None:
        self.redis.set(generate_sliding_window_org_cache_key(self.org.id), sample_rate)

    def seed_legacy_transaction_sample_rates(
        self, project_id: int, named_rates: Mapping[str, float], implicit_rate: float
    ) -> None:
        self.redis.set(
            generate_boost_low_volume_transactions_cache_key(
                org_id=self.org.id, proj_id=project_id
            ),
            orjson.dumps([named_rates, implicit_rate]).decode(),
        )

    def seed_legacy_recalibration_factor(self, factor: float) -> None:
        self.redis.set(
            legacy_recalibration_cache.generate_recalibrate_orgs_cache_key(self.org.id), factor
        )


class SchedulePerOrgCalculationsTest(TestCase):
    """The dispatch task: which organizations reach the per-org task."""

    def dispatched_org_ids(self) -> set[int]:
        with patch(f"{SCHEDULER}.CursoredScheduler") as scheduler:
            scheduler.return_value.tick.return_value = False
            schedule_per_org_calculations()

            queryset = scheduler.call_args.kwargs["queryset"]
            return set(queryset.values_list("id", flat=True))

    @override_options({ROLLOUT_RATE_OPTION: 1.0})
    def test_skips_organizations_that_are_not_active(self) -> None:
        active = self.create_organization()
        self.create_project(organization=active)
        pending_deletion = self.create_organization(status=ObjectStatus.PENDING_DELETION)
        self.create_project(organization=pending_deletion)

        org_ids = self.dispatched_org_ids()

        assert active.id in org_ids
        assert pending_deletion.id not in org_ids

    @override_options({ROLLOUT_RATE_OPTION: 1.0})
    def test_skips_organizations_without_an_active_project(self) -> None:
        with_project = self.create_organization()
        self.create_project(organization=with_project)
        without_projects = self.create_organization()
        with_inactive_project = self.create_organization()
        inactive_project = self.create_project(organization=with_inactive_project)
        inactive_project.update(status=ObjectStatus.PENDING_DELETION)

        org_ids = self.dispatched_org_ids()

        assert with_project.id in org_ids
        assert without_projects.id not in org_ids
        assert with_inactive_project.id not in org_ids

    def test_dispatches_only_organizations_inside_the_rollout(self) -> None:
        org = self.create_organization()
        self.create_project(organization=org)

        with (
            override_options({ROLLOUT_RATE_OPTION: 1.0}),
            patch(f"{SCHEDULER}.CursoredScheduler") as scheduler,
        ):
            scheduler.return_value.tick.return_value = False
            schedule_per_org_calculations()
            validate_item = scheduler.call_args.kwargs["validate_item"]

            assert validate_item(org.id) is True

        with override_options({ROLLOUT_RATE_OPTION: 0.0}):
            assert validate_item(org.id) is False


class PerOrgTaskTest(PerOrgTaskTestCase):
    """The task around the calculations: it reports a run, then returns its status."""

    def test_reports_the_calculations_and_returns_no_status_for_a_full_run(self) -> None:
        with self.patched(), patch(LOG_COMPARISON) as log_comparison:
            status = run_calculations_per_org_task(self.org.id)

        assert status is None
        reported = log_comparison.call_args.args[0]
        assert reported.status is None
        assert reported.project_sample_rates == {
            self.busy_project.id: 0.4,
            self.quiet_project.id: 1.0,
        }

    def test_returns_the_status_the_calculations_stopped_at(self) -> None:
        with self.patched({ORG_VOLUME: None}), patch(LOG_COMPARISON) as log_comparison:
            status = run_calculations_per_org_task(self.org.id)

        assert status == DynamicSamplingStatus.NO_ORG_VOLUME
        assert log_comparison.call_args.args[0].status == status


class PerOrgTaskGateTest(PerOrgTaskTestCase):
    """Every status a run can stop at, and how far it got first."""

    def test_unknown_organization(self) -> None:
        calculations = self.run_calculations(org_id=99999999)

        assert calculations.status == DynamicSamplingStatus.ORG_HAS_NO_DYNAMIC_SAMPLING
        self.queries[ORG_VOLUME].assert_not_called()

    def test_organization_without_a_blended_sample_rate(self) -> None:
        calculations = self.run_calculations({BLENDED_SAMPLE_RATE: None})

        assert calculations.status == DynamicSamplingStatus.ORG_HAS_NO_DYNAMIC_SAMPLING
        self.queries[ORG_VOLUME].assert_not_called()

    def test_organization_without_a_subscription(self) -> None:
        # Raised rather than returned: the task decorator turns it into a status metric.
        with pytest.raises(DynamicSamplingException) as exc_info:
            self.run_calculations({BLENDED_SAMPLE_RATE: ObjectDoesNotExist})

        assert exc_info.value.status == DynamicSamplingStatus.NO_SUBSCRIPTION
        self.queries[ORG_VOLUME].assert_not_called()

    def test_organization_without_projects(self) -> None:
        calculations = self.run_calculations(org_id=self.create_organization().id)

        assert calculations.status == DynamicSamplingStatus.ORG_HAS_NO_PROJECTS
        self.queries[ORG_VOLUME].assert_not_called()

    def test_project_mode_organization_without_target_sample_rates(self) -> None:
        self.org.update_option("sentry:sampling_mode", DynamicSamplingMode.PROJECT)

        with self.feature("organizations:dynamic-sampling-custom"):
            calculations = self.run_calculations()

        assert calculations.status == DynamicSamplingStatus.ORG_HAS_NO_DYNAMIC_SAMPLING
        self.queries[BLENDED_SAMPLE_RATE].assert_not_called()
        self.queries[ORG_VOLUME].assert_not_called()

    def test_organization_without_volume(self) -> None:
        calculations = self.run_calculations({ORG_VOLUME: None})

        assert calculations.status == DynamicSamplingStatus.NO_ORG_VOLUME
        self.queries[PROJECT_VOLUMES].assert_not_called()

    def test_organization_without_project_volumes(self) -> None:
        calculations = self.run_calculations({PROJECT_VOLUMES: []})

        assert calculations.status == DynamicSamplingStatus.NO_PROJECT_VOLUMES
        assert calculations.project_volumes == []
        assert calculations.project_sample_rates == {}
        self.queries[TRANSACTION_VOLUMES].assert_not_called()

    def test_every_project_already_at_the_full_sample_rate(self) -> None:
        calculations = self.run_calculations({BLENDED_SAMPLE_RATE: 1.0})

        assert calculations.status == DynamicSamplingStatus.ALL_PROJECTS_AT_FULL_SAMPLE_RATE
        assert calculations.project_sample_rates == {
            self.busy_project.id: 1.0,
            self.quiet_project.id: 1.0,
        }
        self.queries[TRANSACTION_VOLUMES].assert_not_called()
        assert per_org_recalibration_cache.get_adjusted_factor(self.org.id) == 1.0

    def test_organization_without_transaction_volumes(self) -> None:
        calculations = self.run_calculations({TRANSACTION_VOLUMES: []})

        assert calculations.status == DynamicSamplingStatus.NO_TRANSACTION_VOLUMES
        # Project balancing already ran and left its rates on the configuration.
        assert calculations.project_sample_rates == {
            self.busy_project.id: 0.4,
            self.quiet_project.id: 1.0,
        }
        assert calculations.rebalanced_transactions == {}
        # Recalibration is the last step, so the run stops before writing a factor.
        assert calculations.recalibration_ran is False
        assert per_org_recalibration_cache.get_adjusted_factor(self.org.id) == 1.0


class PerOrgTaskPipelineTest(PerOrgTaskTestCase):
    """Runs that reach the end of the pipeline, and what each step computed."""

    def test_full_run_balances_projects_and_transactions_then_recalibrates(self) -> None:
        calculations = self.run_calculations()

        assert calculations.status is None
        assert calculations.project_sample_rates == {
            self.busy_project.id: 0.4,
            self.quiet_project.id: 1.0,
        }
        # The quiet project sits at 100%, so it is balanced away and never reaches the
        # transaction model.
        assert set(calculations.rebalanced_transactions) == {self.busy_project.id}
        assert transaction_sample_rates(calculations, self.busy_project.id) == (
            {"/cart": 0.45, "/checkout": CHECKOUT_SAMPLE_RATE},
            0.96,
        )
        assert calculations.recalibration_ran is True
        assert calculations.recalibration_factor == 2.0
        assert per_org_recalibration_cache.get_adjusted_factor(self.org.id) == 2.0

    def test_full_run_reads_what_the_legacy_pipeline_computed(self) -> None:
        self.seed_legacy_project_sample_rates(
            {self.busy_project.id: 0.41, self.quiet_project.id: 0.5}
        )
        self.seed_legacy_transaction_sample_rates(
            self.busy_project.id, {"/checkout": 0.19, "/cart": 0.44}, 0.95
        )
        self.seed_legacy_recalibration_factor(1.95)

        calculations = self.run_calculations()

        assert calculations.cached_project_sample_rates == {
            self.busy_project.id: 0.41,
            self.quiet_project.id: 0.5,
        }
        # Only the projects that reached the transaction model are read back.
        assert calculations.cached_transaction_sample_rates == {
            self.busy_project.id: ({"/checkout": 0.19, "/cart": 0.44}, 0.95),
        }
        assert calculations.cached_recalibration_factor == 1.95
        # The organization rate is only needed by the summary log.
        assert calculations.cached_organization_sample_rate is None

    def test_org_mode_custom_sampling_balances_against_the_target_sample_rate(self) -> None:
        self.org.update_option("sentry:sampling_mode", DynamicSamplingMode.ORGANIZATION)
        self.org.update_option("sentry:target_sample_rate", 0.5)

        with self.feature("organizations:dynamic-sampling-custom"):
            calculations = self.run_calculations()

        assert calculations.status is None
        # The target rate replaces the blended one, and the rest of the run matches the
        # subscription-backed org at the same rate.
        self.queries[BLENDED_SAMPLE_RATE].assert_not_called()
        assert calculations.project_sample_rates == {
            self.busy_project.id: 0.4,
            self.quiet_project.id: 1.0,
        }
        assert calculations.recalibration_factor == 2.0
        assert per_org_recalibration_cache.get_adjusted_factor(self.org.id) == 2.0

    def test_project_mode_custom_sampling_uses_the_project_target_sample_rates(self) -> None:
        self.org.update_option("sentry:sampling_mode", DynamicSamplingMode.PROJECT)
        self.busy_project.update_option("sentry:target_sample_rate", 0.4)
        self.quiet_project.update_option("sentry:target_sample_rate", 1.0)

        with self.feature("organizations:dynamic-sampling-custom"):
            calculations = self.run_calculations()

        assert calculations.status is None
        assert calculations.project_sample_rates == {
            self.busy_project.id: 0.4,
            self.quiet_project.id: 1.0,
        }
        # Project mode is never rebalanced, so nothing is balanced and nothing is read from
        # the balanced cache.
        assert calculations.rebalanced_projects == []
        assert calculations.cached_project_sample_rates == {}
        # The per-project target rates drive transaction balancing instead, giving the same
        # rates the balanced 0.4 produced.
        assert transaction_sample_rates(calculations, self.busy_project.id) == (
            {"/cart": 0.45, "/checkout": CHECKOUT_SAMPLE_RATE},
            0.96,
        )
        # Recalibration needs an org-wide sample rate, which project mode does not have.
        assert calculations.recalibration_factor is None
        assert per_org_recalibration_cache.get_adjusted_factor(self.org.id) == 1.0

    def test_project_sample_rate_override_replaces_the_balanced_rate(self) -> None:
        calculations = self.run_calculations(
            options={
                "dynamic-sampling.sample-rate-override-per-project": {
                    str(self.busy_project.id): 0.2
                }
            }
        )

        assert calculations.status is None
        assert calculations.project_sample_rates == {
            self.busy_project.id: 0.2,
            self.quiet_project.id: 1.0,
        }
        # The override lands before the rates reach the configuration, so transaction
        # balancing runs against 0.2 rather than the balanced 0.4.
        named_rates, _ = transaction_sample_rates(calculations, self.busy_project.id)
        assert named_rates == {
            "/cart": 0.225,
            "/checkout": pytest.approx(0.09166666666666666),
        }

    def test_transaction_volumes_are_queried_for_every_root_project(self) -> None:
        calculations = self.run_calculations()

        # Narrowing the query to the projects being balanced would drop every segment rooted
        # at a project sampled at 100%, leaving those root projects with no volume at all.
        self.queries[TRANSACTION_VOLUMES].assert_called_once_with(calculations.config)

    def test_recalibration_outside_its_own_rollout(self) -> None:
        calculations = self.run_calculations(options={RECALIBRATION_ROLLOUT_RATE_OPTION: 0.0})

        assert calculations.status is None
        assert calculations.recalibration_ran is False
        assert calculations.recalibration_factor is None
        assert calculations.cached_recalibration_factor is None
        self.queries[SAMPLED_VOLUME].assert_not_called()
        assert per_org_recalibration_cache.get_adjusted_factor(self.org.id) == 1.0

    def test_recalibration_without_a_five_minute_volume(self) -> None:
        self.seed_legacy_recalibration_factor(1.95)

        calculations = self.run_calculations({SAMPLED_VOLUME: None})

        assert calculations.status is None
        assert calculations.recalibration_factor is None
        assert per_org_recalibration_cache.get_adjusted_factor(self.org.id) == 1.0
        # The legacy factor is still read, so that a skipped factor can be reported next to it.
        assert calculations.recalibration_ran is True
        assert calculations.cached_recalibration_factor == 1.95

    def test_summary_log_rollout_reads_the_legacy_rates_of_every_project(self) -> None:
        self.seed_legacy_organization_sample_rate(0.45)
        self.seed_legacy_project_sample_rates(
            {self.busy_project.id: 0.41, self.quiet_project.id: 0.5}
        )
        self.seed_legacy_transaction_sample_rates(self.quiet_project.id, {"/api": 0.6}, 0.62)

        calculations = self.run_calculations(
            options={SAMPLE_RATES_SUMMARY_LOG_ROLLOUT_RATE_OPTION: 1.0}
        )

        assert calculations.summary_log_enabled is True
        assert calculations.cached_organization_sample_rate == 0.45
        assert calculations.cached_project_sample_rates == {
            self.busy_project.id: 0.41,
            self.quiet_project.id: 0.5,
        }
        # The quiet project produced no EAP transaction rates, yet its legacy ones are read:
        # the cache is read for every project once the summary log is on.
        assert set(calculations.rebalanced_transactions) == {self.busy_project.id}
        assert calculations.cached_transaction_sample_rates == {
            self.busy_project.id: None,
            self.quiet_project.id: ({"/api": 0.6}, 0.62),
        }
