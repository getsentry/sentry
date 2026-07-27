from __future__ import annotations

from unittest.mock import Mock, patch

from django.core.exceptions import ObjectDoesNotExist

from sentry.constants import ObjectStatus
from sentry.dynamic_sampling.models.common import RebalancedItem
from sentry.dynamic_sampling.per_org.configuration import BaseDynamicSamplingConfiguration
from sentry.dynamic_sampling.per_org.gate import is_org_in_rollout
from sentry.dynamic_sampling.per_org.queries import ProjectTransactionCounts, ProjectVolume
from sentry.dynamic_sampling.per_org.scheduler import (
    run_calculations_per_org_task,
    schedule_per_org_calculations,
)
from sentry.dynamic_sampling.per_org.telemetry import DynamicSamplingStatus
from sentry.dynamic_sampling.tasks.common import OrganizationDataVolume
from sentry.dynamic_sampling.types import DynamicSamplingMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options


def _assert_called_once_with_config(
    mock: Mock,
    organization_id: int,
) -> BaseDynamicSamplingConfiguration:
    mock.assert_called_once()
    config = mock.call_args.args[0]
    assert isinstance(config, BaseDynamicSamplingConfiguration)
    assert config.organization.id == organization_id
    return config


def _project_volume(project_id: int, total: int = 100, keep: int = 25) -> ProjectVolume:
    return ProjectVolume(project_id=project_id, total=total, keep=keep, drop=max(total - keep, 0))


class SchedulePerOrgCalculationsTest(TestCase):
    """Tests for the scheduling wrapper: rollout gating and active-org filtering."""

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_dispatches_only_active_orgs(self) -> None:
        active = self.create_organization()
        self.create_project(organization=active)
        pending_deletion = self.create_organization()
        self.create_project(organization=pending_deletion)
        pending_deletion.status = 1  # PENDING_DELETION
        pending_deletion.save()

        with patch("sentry.dynamic_sampling.per_org.scheduler.CursoredScheduler") as MockScheduler:
            mock_instance = MockScheduler.return_value
            mock_instance.tick.return_value = False
            schedule_per_org_calculations()

            queryset = MockScheduler.call_args.kwargs["queryset"]
            org_ids = set(queryset.values_list("id", flat=True))

        assert active.id in org_ids
        assert pending_deletion.id not in org_ids

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_dispatches_only_orgs_with_active_projects(self) -> None:
        org_with_project = self.create_organization()
        self.create_project(organization=org_with_project)
        org_without_projects = self.create_organization()
        org_with_inactive_project = self.create_organization()
        inactive_project = self.create_project(organization=org_with_inactive_project)
        inactive_project.status = ObjectStatus.PENDING_DELETION
        inactive_project.save()

        with patch("sentry.dynamic_sampling.per_org.scheduler.CursoredScheduler") as MockScheduler:
            mock_instance = MockScheduler.return_value
            mock_instance.tick.return_value = False
            schedule_per_org_calculations()

            queryset = MockScheduler.call_args.kwargs["queryset"]
            org_ids = set(queryset.values_list("id", flat=True))

        assert org_with_project.id in org_ids
        assert org_without_projects.id not in org_ids
        assert org_with_inactive_project.id not in org_ids

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_org_in_rollout_is_dispatched(self) -> None:
        org = self.create_organization()
        assert is_org_in_rollout(org.id) is True

    @override_options({"dynamic-sampling.per_org.rollout-rate": 0.0})
    def test_org_not_in_rollout_is_skipped(self) -> None:
        org = self.create_organization()
        assert is_org_in_rollout(org.id) is False


class RunCalculationsPerOrgTest(TestCase):
    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_returns_no_volume_without_traffic(self) -> None:
        org = self.create_organization()
        self.create_project(organization=org)

        with (
            patch(
                "sentry.dynamic_sampling.per_org.configuration.quotas.backend.get_blended_sample_rate",
                return_value=1.0,
            ) as get_blended_sample_rate,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.get_eap_organization_volume",
                return_value=None,
            ) as get_volume,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.get_eap_project_volumes"
            ) as get_project_volumes,
        ):
            result = run_calculations_per_org_task(org.id)

        assert result == DynamicSamplingStatus.NO_ORG_VOLUME
        _assert_called_once_with_config(get_volume, org.id)
        get_blended_sample_rate.assert_called_once_with(organization_id=org.id)
        get_project_volumes.assert_not_called()

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_skips_transaction_volumes_at_full_sample_rate(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        org_volume = OrganizationDataVolume(org_id=org.id, total=100, indexed=25)
        project_volumes = [_project_volume(project.id)]
        rebalanced_projects = [RebalancedItem(id=project.id, count=100, new_sample_rate=1.0)]
        cached_sample_rates: dict[int, float | None] = {}

        with (
            patch(
                "sentry.dynamic_sampling.per_org.configuration.quotas.backend.get_blended_sample_rate",
                return_value=1.0,
            ) as get_blended_sample_rate,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.get_eap_organization_volume",
                return_value=org_volume,
            ) as get_volume,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.get_eap_project_volumes",
                return_value=project_volumes,
            ) as get_project_volumes,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.run_project_balancing",
                return_value=rebalanced_projects,
            ) as project_balancing,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.get_cached_rebalanced_project_sample_rates",
                return_value=cached_sample_rates,
            ) as get_cached_sample_rates,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.compare_rebalanced_projects_with_cache"
            ) as compare_rebalanced_projects,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.get_eap_transaction_volumes"
            ) as get_transaction_volumes,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.run_transaction_balancing"
            ) as transaction_balancing,
        ):
            result = run_calculations_per_org_task(org.id)

        assert result == DynamicSamplingStatus.ALL_PROJECTS_AT_FULL_SAMPLE_RATE
        _assert_called_once_with_config(get_volume, org.id)
        get_blended_sample_rate.assert_called_once_with(organization_id=org.id)
        project_config = _assert_called_once_with_config(get_project_volumes, org.id)
        project_balancing.assert_called_once_with(project_config, project_volumes)
        get_cached_sample_rates.assert_called_once_with(org.id)
        compare_rebalanced_projects.assert_called_once_with(
            project_config, rebalanced_projects, cached_sample_rates, project_volumes
        )
        get_transaction_volumes.assert_not_called()
        transaction_balancing.assert_not_called()

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_skips_transaction_balancing_when_blended_rate_is_full(
        self,
    ) -> None:
        """A blended (reserved-based) rate of 100% serves at 100% in the legacy path.

        ``get_guarded_project_sample_rate`` returns 1.0 as soon as the blended rate is 1.0,
        before it ever reads the boosted cache. Relay then receives a base rate of 1.0, and
        ``_get_rules_of_enabled_biases`` only emits the boostLowVolumeTransactions rules when
        ``0.0 < base_sample_rate < 1.0`` — so no transaction rule reaches Relay at all.

        The per-org pipeline must reach the same conclusion. It currently does not: it reads
        the ungated usage-based rate, rebalances the projects and then rebalances their
        transactions, so it produces per-transaction rates the legacy path never serves.
        """
        org = self.create_organization()
        project = self.create_project(organization=org)
        org_volume = OrganizationDataVolume(org_id=org.id, total=100, indexed=25)
        project_volumes = [_project_volume(project.id)]
        # The usage-based rate is below 100%, so project balancing produces sub-100% rates.
        # The legacy cache holds those too — only serving is gated.
        rebalanced_projects = [RebalancedItem(id=project.id, count=100, new_sample_rate=0.25)]

        with (
            patch(
                "sentry.dynamic_sampling.per_org.configuration.quotas.backend.get_blended_sample_rate",
                return_value=1.0,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.get_outcomes_organization_volume",
                return_value=OrganizationDataVolume(org_id=org.id, total=1000, indexed=250),
            ),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.compute_sliding_window_sample_rate",
                return_value=0.25,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.get_eap_organization_volume",
                return_value=org_volume,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.get_eap_project_volumes",
                return_value=project_volumes,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.run_project_balancing",
                return_value=rebalanced_projects,
            ) as project_balancing,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.get_cached_rebalanced_project_sample_rates",
                return_value={},
            ),
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.compare_rebalanced_projects_with_cache"
            ) as compare_rebalanced_projects,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.get_eap_transaction_volumes"
            ) as get_transaction_volumes,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.run_transaction_balancing"
            ) as transaction_balancing,
        ):
            result = run_calculations_per_org_task(org.id)

        assert result == DynamicSamplingStatus.ALL_PROJECTS_AT_FULL_SAMPLE_RATE
        get_transaction_volumes.assert_not_called()
        transaction_balancing.assert_not_called()
        # Project balancing and its comparison stay ungated: they mirror the legacy cache,
        # which is written from the usage-based rate regardless of the blended rate.
        project_balancing.assert_called_once()
        compare_rebalanced_projects.assert_called_once()

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_balances_transactions_below_full_blended_rate(self) -> None:
        """Counterpart to the blended-100% gate: below 100% the transaction stage must run.

        Guards against gating on the usage-based rate (0.25 here) instead of the blended one.
        """
        org = self.create_organization()
        project = self.create_project(organization=org)
        org_volume = OrganizationDataVolume(org_id=org.id, total=100, indexed=25)
        project_volumes = [_project_volume(project.id)]
        rebalanced_projects = [RebalancedItem(id=project.id, count=100, new_sample_rate=0.25)]
        transaction_volumes = [
            ProjectTransactionCounts(
                org_id=org.id, project_id=project.id, transaction_counts=[("checkout", 1.0)]
            )
        ]

        with (
            patch(
                "sentry.dynamic_sampling.per_org.configuration.quotas.backend.get_blended_sample_rate",
                return_value=0.5,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.get_outcomes_organization_volume",
                return_value=OrganizationDataVolume(org_id=org.id, total=1000, indexed=250),
            ),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.compute_sliding_window_sample_rate",
                return_value=0.25,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.get_eap_organization_volume",
                return_value=org_volume,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.get_eap_project_volumes",
                return_value=project_volumes,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.run_project_balancing",
                return_value=rebalanced_projects,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.get_cached_rebalanced_project_sample_rates",
                return_value={},
            ),
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.compare_rebalanced_projects_with_cache"
            ),
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.get_eap_transaction_volumes",
                return_value=transaction_volumes,
            ) as get_transaction_volumes,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.run_transaction_balancing",
                return_value={},
            ) as transaction_balancing,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.get_cached_rebalanced_transaction_sample_rates",
                return_value={},
            ),
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.compare_rebalanced_transactions_with_cache"
            ),
        ):
            result = run_calculations_per_org_task(org.id)

        assert result is None
        get_transaction_volumes.assert_called_once()
        transaction_balancing.assert_called_once()

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_returns_no_volume_without_project_volumes(self) -> None:
        org = self.create_organization()
        self.create_project(organization=org)
        org_volume = OrganizationDataVolume(org_id=org.id, total=100, indexed=25)

        with (
            patch(
                "sentry.dynamic_sampling.per_org.configuration.quotas.backend.get_blended_sample_rate",
                return_value=1.0,
            ) as get_blended_sample_rate,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.get_eap_organization_volume",
                return_value=org_volume,
            ) as get_volume,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.get_eap_project_volumes",
                return_value=[],
            ) as get_project_volumes,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.get_eap_transaction_volumes"
            ) as get_transaction_volumes,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.run_project_balancing",
                return_value=None,
            ) as project_balancing,
        ):
            result = run_calculations_per_org_task(org.id)

        assert result == DynamicSamplingStatus.NO_PROJECT_VOLUMES
        get_blended_sample_rate.assert_called_once_with(organization_id=org.id)
        _assert_called_once_with_config(get_volume, org.id)
        _assert_called_once_with_config(get_project_volumes, org.id)
        project_balancing.assert_not_called()
        get_transaction_volumes.assert_not_called()

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_returns_no_volume_without_transaction_volumes(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        org_volume = OrganizationDataVolume(org_id=org.id, total=100, indexed=25)
        project_volumes = [_project_volume(project.id)]
        rebalanced_projects = [RebalancedItem(id=project.id, count=100, new_sample_rate=0.5)]
        cached_sample_rates: dict[int, float | None] = {}

        with (
            patch(
                "sentry.dynamic_sampling.per_org.configuration.quotas.backend.get_blended_sample_rate",
                return_value=1.0,
            ) as get_blended_sample_rate,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.get_eap_organization_volume",
                return_value=org_volume,
            ) as get_volume,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.get_eap_project_volumes",
                return_value=project_volumes,
            ) as get_project_volumes,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.run_project_balancing",
                return_value=rebalanced_projects,
            ) as project_balancing,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.get_cached_rebalanced_project_sample_rates",
                return_value=cached_sample_rates,
            ) as get_cached_sample_rates,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.compare_rebalanced_projects_with_cache"
            ) as compare_rebalanced_projects,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.get_eap_transaction_volumes",
                return_value=[],
            ) as get_transaction_volumes,
        ):
            result = run_calculations_per_org_task(org.id)

        assert result == DynamicSamplingStatus.NO_TRANSACTION_VOLUMES
        get_blended_sample_rate.assert_called_once_with(organization_id=org.id)
        _assert_called_once_with_config(get_volume, org.id)
        project_config = _assert_called_once_with_config(get_project_volumes, org.id)
        project_balancing.assert_called_once_with(project_config, project_volumes)
        get_cached_sample_rates.assert_called_once_with(org.id)
        compare_rebalanced_projects.assert_called_once_with(
            project_config, rebalanced_projects, cached_sample_rates, project_volumes
        )
        _assert_called_once_with_config(get_transaction_volumes, org.id)

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_skips_project_balancing_for_project_mode(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        org.update_option("sentry:sampling_mode", DynamicSamplingMode.PROJECT)
        project.update_option("sentry:target_sample_rate", 0.2)
        org_volume = OrganizationDataVolume(org_id=org.id, total=100, indexed=25)
        project_volumes = [_project_volume(project.id)]

        with (
            self.feature("organizations:dynamic-sampling-custom"),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.quotas.backend.get_blended_sample_rate"
            ) as get_blended_sample_rate,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.get_eap_organization_volume",
                return_value=org_volume,
            ) as get_volume,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.get_eap_project_volumes",
                return_value=project_volumes,
            ) as get_project_volumes,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.run_project_balancing",
            ) as project_balancing,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.get_eap_transaction_volumes",
                return_value=[
                    ProjectTransactionCounts(
                        org_id=org.id,
                        project_id=project.id,
                        transaction_counts=[("checkout", 1.0)],
                    )
                ],
            ) as get_transaction_volumes,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.run_transaction_balancing",
                return_value={},
            ) as transaction_balancing,
        ):
            result = run_calculations_per_org_task(org.id)

        assert result is None
        get_blended_sample_rate.assert_not_called()
        _assert_called_once_with_config(get_volume, org.id)
        _assert_called_once_with_config(get_project_volumes, org.id)
        project_balancing.assert_not_called()
        transaction_config = _assert_called_once_with_config(get_transaction_volumes, org.id)
        transaction_balancing.assert_called_once_with(
            transaction_config, project_volumes, get_transaction_volumes.return_value
        )

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_queries_projects_for_am3_org_mode(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        org.update_option("sentry:sampling_mode", DynamicSamplingMode.ORGANIZATION)
        org_volume = OrganizationDataVolume(org_id=org.id, total=100, indexed=25)
        project_volumes = [_project_volume(project.id)]
        rebalanced_projects = [RebalancedItem(id=project.id, count=100, new_sample_rate=0.5)]
        cached_sample_rates: dict[int, float | None] = {}

        with (
            self.feature("organizations:dynamic-sampling-custom"),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.quotas.backend.get_blended_sample_rate"
            ) as get_blended_sample_rate,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.get_eap_organization_volume",
                return_value=org_volume,
            ) as get_volume,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.get_eap_project_volumes",
                return_value=project_volumes,
            ) as get_project_volumes,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.run_project_balancing",
                return_value=rebalanced_projects,
            ) as project_balancing,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.get_cached_rebalanced_project_sample_rates",
                return_value=cached_sample_rates,
            ) as get_cached_sample_rates,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.compare_rebalanced_projects_with_cache"
            ) as compare_rebalanced_projects,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.get_eap_transaction_volumes",
                return_value=[
                    ProjectTransactionCounts(
                        org_id=org.id,
                        project_id=project.id,
                        transaction_counts=[("checkout", 1.0)],
                    )
                ],
            ) as get_transaction_volumes,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.run_transaction_balancing",
                return_value={},
            ) as transaction_balancing,
        ):
            result = run_calculations_per_org_task(org.id)

        assert result is None
        get_blended_sample_rate.assert_not_called()
        _assert_called_once_with_config(get_volume, org.id)
        project_config = _assert_called_once_with_config(get_project_volumes, org.id)
        project_balancing.assert_called_once_with(project_config, project_volumes)
        get_cached_sample_rates.assert_called_once_with(org.id)
        compare_rebalanced_projects.assert_called_once_with(
            project_config, rebalanced_projects, cached_sample_rates, project_volumes
        )
        transaction_config = _assert_called_once_with_config(get_transaction_volumes, org.id)
        transaction_balancing.assert_called_once_with(
            transaction_config, project_volumes, get_transaction_volumes.return_value
        )

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_skips_project_mode_without_project_rates(self) -> None:
        org = self.create_organization()
        self.create_project(organization=org)
        org.update_option("sentry:sampling_mode", DynamicSamplingMode.PROJECT)

        with (
            self.feature("organizations:dynamic-sampling-custom"),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.quotas.backend.get_blended_sample_rate"
            ) as get_blended_sample_rate,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.get_eap_organization_volume"
            ) as get_volume,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.get_eap_project_volumes"
            ) as get_project_volumes,
        ):
            result = run_calculations_per_org_task(org.id)

        assert result == DynamicSamplingStatus.ORG_HAS_NO_DYNAMIC_SAMPLING
        get_blended_sample_rate.assert_not_called()
        get_volume.assert_not_called()
        get_project_volumes.assert_not_called()

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_queries_projects_for_am2(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        org_volume = OrganizationDataVolume(org_id=org.id, total=100, indexed=25)
        project_volumes = [_project_volume(project.id)]
        rebalanced_projects = [RebalancedItem(id=project.id, count=100, new_sample_rate=0.5)]
        cached_sample_rates: dict[int, float | None] = {}

        with (
            patch(
                "sentry.dynamic_sampling.per_org.configuration.quotas.backend.get_blended_sample_rate",
                return_value=1.0,
            ) as get_blended_sample_rate,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.get_eap_organization_volume",
                return_value=org_volume,
            ) as get_volume,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.get_eap_project_volumes",
                return_value=project_volumes,
            ) as get_project_volumes,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.run_project_balancing",
                return_value=rebalanced_projects,
            ) as project_balancing,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.get_cached_rebalanced_project_sample_rates",
                return_value=cached_sample_rates,
            ) as get_cached_sample_rates,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.compare_rebalanced_projects_with_cache"
            ) as compare_rebalanced_projects,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.get_eap_transaction_volumes",
                return_value=[
                    ProjectTransactionCounts(
                        org_id=org.id,
                        project_id=project.id,
                        transaction_counts=[("checkout", 1.0)],
                    )
                ],
            ) as get_transaction_volumes,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.run_transaction_balancing",
                return_value={},
            ) as transaction_balancing,
        ):
            result = run_calculations_per_org_task(org.id)

        assert result is None
        get_blended_sample_rate.assert_called_once_with(organization_id=org.id)
        _assert_called_once_with_config(get_volume, org.id)
        project_config = _assert_called_once_with_config(get_project_volumes, org.id)
        project_balancing.assert_called_once_with(project_config, project_volumes)
        get_cached_sample_rates.assert_called_once_with(org.id)
        compare_rebalanced_projects.assert_called_once_with(
            project_config, rebalanced_projects, cached_sample_rates, project_volumes
        )
        transaction_config = _assert_called_once_with_config(get_transaction_volumes, org.id)
        assert [p.id for p in get_transaction_volumes.call_args.kwargs["root_projects"]] == [
            project.id
        ]
        transaction_balancing.assert_called_once_with(
            transaction_config, project_volumes, get_transaction_volumes.return_value
        )

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_skips_org_without_transaction_sample_rate(self) -> None:
        org = self.create_organization()

        with (
            patch(
                "sentry.dynamic_sampling.per_org.configuration.quotas.backend.get_blended_sample_rate",
                return_value=None,
            ) as get_blended_sample_rate,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.get_eap_organization_volume"
            ) as get_volume,
        ):
            result = run_calculations_per_org_task(org.id)

        assert result == DynamicSamplingStatus.ORG_HAS_NO_DYNAMIC_SAMPLING
        get_blended_sample_rate.assert_called_once_with(organization_id=org.id)
        get_volume.assert_not_called()

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_skips_org_without_projects(self) -> None:
        org = self.create_organization()

        with (
            patch(
                "sentry.dynamic_sampling.per_org.configuration.quotas.backend.get_blended_sample_rate",
                return_value=1.0,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.get_eap_organization_volume"
            ) as get_volume,
        ):
            result = run_calculations_per_org_task(org.id)

        assert result == DynamicSamplingStatus.ORG_HAS_NO_PROJECTS
        get_volume.assert_not_called()

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_skips_org_without_subscription(self) -> None:
        org = self.create_organization()

        with (
            patch(
                "sentry.dynamic_sampling.per_org.configuration.quotas.backend.get_blended_sample_rate",
                side_effect=ObjectDoesNotExist,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.get_eap_organization_volume"
            ) as get_volume,
        ):
            result = run_calculations_per_org_task(org.id)

        assert result == DynamicSamplingStatus.NO_SUBSCRIPTION
        get_volume.assert_not_called()

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_skips_missing_org(self) -> None:
        with patch(
            "sentry.dynamic_sampling.per_org.scheduler.get_eap_organization_volume"
        ) as get_volume:
            result = run_calculations_per_org_task(99999999)

        assert result == DynamicSamplingStatus.ORG_HAS_NO_DYNAMIC_SAMPLING
        get_volume.assert_not_called()
