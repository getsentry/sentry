from __future__ import annotations

from unittest.mock import DEFAULT, Mock, patch

import pytest
from django.core.exceptions import ObjectDoesNotExist

from sentry.constants import ObjectStatus
from sentry.dynamic_sampling.models.common import RebalancedItem
from sentry.dynamic_sampling.per_org.configuration import BaseDynamicSamplingConfiguration
from sentry.dynamic_sampling.per_org.gate import is_org_in_rollout
from sentry.dynamic_sampling.per_org.queries import ProjectTransactionCounts
from sentry.dynamic_sampling.per_org.scheduler import (
    run_calculations_per_org_task,
    schedule_per_org_calculations,
)
from sentry.dynamic_sampling.per_org.telemetry import DynamicSamplingStatus
from sentry.dynamic_sampling.tasks.common import OrganizationDataVolume
from sentry.dynamic_sampling.types import DynamicSamplingMode
from sentry.models.organization import Organization
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from tests.sentry.dynamic_sampling.per_org.test_helpers import (
    BLENDED_SAMPLE_RATE,
    SET_FACTOR,
    make_project_volume,
    patch_configuration,
)

SCHEDULER = "sentry.dynamic_sampling.per_org.scheduler"
ORG_VOLUME = f"{SCHEDULER}.get_eap_organization_volume"
PROJECT_VOLUMES = f"{SCHEDULER}.get_eap_project_volumes"
TRANSACTION_VOLUMES = f"{SCHEDULER}.get_eap_transaction_volumes"
PROJECT_BALANCING = f"{SCHEDULER}.run_project_balancing"
TRANSACTION_BALANCING = f"{SCHEDULER}.run_transaction_balancing"
EMIT_COMPARISONS = f"{SCHEDULER}.emit_comparisons"
WRITE_CACHES = f"{SCHEDULER}.write_caches"

# The pass records its results on the configuration and hands it to both end-of-pass steps,
# so patching them out leaves the calculations themselves untouched.
END_OF_PASS = {EMIT_COMPARISONS: DEFAULT, WRITE_CACHES: DEFAULT}


def _assert_called_once_with_config(
    mock: Mock,
    organization_id: int,
) -> BaseDynamicSamplingConfiguration:
    mock.assert_called_once()
    config = mock.call_args.args[0]
    assert isinstance(config, BaseDynamicSamplingConfiguration)
    assert config.organization.id == organization_id
    return config


def _transaction_volumes(org: Organization, project_id: int) -> list[ProjectTransactionCounts]:
    return [
        ProjectTransactionCounts(
            org_id=org.id,
            project_id=project_id,
            transaction_counts=[("checkout", 1.0)],
        )
    ]


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

    def _scheduled_org_ids(self) -> set[int]:
        """The organizations the scheduler's queryset would page through."""
        with patch(f"{SCHEDULER}.CursoredScheduler") as MockScheduler:
            MockScheduler.return_value.tick.return_value = False
            schedule_per_org_calculations()

            queryset = MockScheduler.call_args.kwargs["queryset"]
            return set(queryset.values_list("id", flat=True))

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_queryset_is_filtered_by_the_cached_orgs(self) -> None:
        cached = self.create_organization()
        self.create_project(organization=cached)
        uncached = self.create_organization()
        self.create_project(organization=uncached)

        with patch(f"{SCHEDULER}.get_orgs_with_dynamic_sampling", return_value=[cached.id]):
            org_ids = self._scheduled_org_ids()

        assert cached.id in org_ids
        assert uncached.id not in org_ids

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_a_cold_cache_falls_back_to_every_candidate_org(self) -> None:
        org = self.create_organization()
        self.create_project(organization=org)

        with patch(f"{SCHEDULER}.get_orgs_with_dynamic_sampling", return_value=None):
            org_ids = self._scheduled_org_ids()

        assert org.id in org_ids

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_an_empty_cached_set_schedules_nothing(self) -> None:
        org = self.create_organization()
        self.create_project(organization=org)

        with patch(f"{SCHEDULER}.get_orgs_with_dynamic_sampling", return_value=[]):
            org_ids = self._scheduled_org_ids()

        assert org_ids == set()

    def _prevalidated_org_ids(self) -> set[int]:
        """Run the real prevalidate_batch callback over every org in the queryset."""
        with patch(f"{SCHEDULER}.CursoredScheduler") as MockScheduler:
            MockScheduler.return_value.tick.return_value = False
            schedule_per_org_calculations()

            kwargs = MockScheduler.call_args.kwargs
            return set(kwargs["prevalidate_batch"](list(kwargs["queryset"])))

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_skips_orgs_without_dynamic_sampling(self) -> None:
        with_dynamic_sampling = self.create_organization()
        self.create_project(organization=with_dynamic_sampling)
        without_dynamic_sampling = self.create_organization()
        self.create_project(organization=without_dynamic_sampling)

        with self.feature({"organizations:dynamic-sampling": [with_dynamic_sampling.slug]}):
            org_ids = self._prevalidated_org_ids()

        assert with_dynamic_sampling.id in org_ids
        assert without_dynamic_sampling.id not in org_ids

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_raises_when_the_feature_cannot_be_evaluated(self) -> None:
        org = self.create_organization()
        self.create_project(organization=org)

        with (
            patch("sentry.features.batch_has_for_organizations", return_value=None),
            pytest.raises(RuntimeError),
        ):
            self._prevalidated_org_ids()

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_org_in_rollout_is_dispatched(self) -> None:
        org = self.create_organization()
        assert is_org_in_rollout(org.id) is True

    @override_options({"dynamic-sampling.per_org.rollout-rate": 0.0})
    def test_org_not_in_rollout_is_skipped(self) -> None:
        org = self.create_organization()
        assert is_org_in_rollout(org.id) is False


class RunCalculationsPerOrgTest(TestCase):
    @override_options(
        {
            "dynamic-sampling.per_org.rollout-rate": 1.0,
        }
    )
    def test_run_calculations_per_org_returns_no_volume_without_traffic(self) -> None:
        org = self.create_organization()
        self.create_project(organization=org)

        with patch_configuration(
            {
                BLENDED_SAMPLE_RATE: 1.0,
                ORG_VOLUME: None,
                PROJECT_VOLUMES: DEFAULT,
                **END_OF_PASS,
            }
        ) as mocks:
            result = run_calculations_per_org_task(org.id)

        assert result == DynamicSamplingStatus.NO_ORG_VOLUME
        _assert_called_once_with_config(mocks[ORG_VOLUME], org.id)
        mocks[BLENDED_SAMPLE_RATE].assert_called_once_with(organization_id=org.id)
        mocks[PROJECT_VOLUMES].assert_not_called()
        # A pass that bails out still reaches both end-of-pass steps, which find an
        # untouched result and emit nothing.
        _assert_called_once_with_config(mocks[EMIT_COMPARISONS], org.id)
        _assert_called_once_with_config(mocks[WRITE_CACHES], org.id)

    @override_options(
        {
            "dynamic-sampling.per_org.rollout-rate": 1.0,
        }
    )
    def test_run_calculations_per_org_skips_transaction_volumes_at_full_sample_rate(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        org_volume = OrganizationDataVolume(org_id=org.id, total=100, indexed=25)
        project_volumes = [make_project_volume(project.id)]
        rebalanced_projects = [RebalancedItem(id=project.id, count=100, new_sample_rate=1.0)]

        with patch_configuration(
            {
                BLENDED_SAMPLE_RATE: 1.0,
                ORG_VOLUME: org_volume,
                PROJECT_VOLUMES: project_volumes,
                PROJECT_BALANCING: rebalanced_projects,
                TRANSACTION_VOLUMES: DEFAULT,
                TRANSACTION_BALANCING: DEFAULT,
                **END_OF_PASS,
            }
        ) as mocks:
            result = run_calculations_per_org_task(org.id)

        assert result == DynamicSamplingStatus.ALL_PROJECTS_AT_FULL_SAMPLE_RATE
        _assert_called_once_with_config(mocks[ORG_VOLUME], org.id)
        mocks[BLENDED_SAMPLE_RATE].assert_called_once_with(organization_id=org.id)
        config = _assert_called_once_with_config(mocks[PROJECT_VOLUMES], org.id)
        mocks[PROJECT_BALANCING].assert_called_once_with(config, project_volumes)
        mocks[TRANSACTION_VOLUMES].assert_not_called()
        mocks[TRANSACTION_BALANCING].assert_not_called()
        # Recalibration is the last stage, so a full-sample-rate org returns before it runs.
        assert config.results.recalibration_factor is None
        # The project rates the pass did compute are still reported.
        assert config.results.rebalanced_projects == rebalanced_projects
        assert config.results.projects_to_balance == []
        _assert_called_once_with_config(mocks[EMIT_COMPARISONS], org.id)

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_returns_no_volume_without_project_volumes(self) -> None:
        org = self.create_organization()
        self.create_project(organization=org)
        org_volume = OrganizationDataVolume(org_id=org.id, total=100, indexed=25)

        with patch_configuration(
            {
                BLENDED_SAMPLE_RATE: 1.0,
                ORG_VOLUME: org_volume,
                PROJECT_VOLUMES: [],
                TRANSACTION_VOLUMES: DEFAULT,
                PROJECT_BALANCING: None,
                **END_OF_PASS,
            }
        ) as mocks:
            result = run_calculations_per_org_task(org.id)

        assert result == DynamicSamplingStatus.NO_PROJECT_VOLUMES
        mocks[BLENDED_SAMPLE_RATE].assert_called_once_with(organization_id=org.id)
        _assert_called_once_with_config(mocks[ORG_VOLUME], org.id)
        config = _assert_called_once_with_config(mocks[PROJECT_VOLUMES], org.id)
        mocks[PROJECT_BALANCING].assert_not_called()
        mocks[TRANSACTION_VOLUMES].assert_not_called()
        assert config.results.organization_volume is org_volume

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_returns_no_volume_without_transaction_volumes(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        org_volume = OrganizationDataVolume(org_id=org.id, total=100, indexed=25)
        project_volumes = [make_project_volume(project.id)]
        rebalanced_projects = [RebalancedItem(id=project.id, count=100, new_sample_rate=0.5)]

        with patch_configuration(
            {
                BLENDED_SAMPLE_RATE: 1.0,
                ORG_VOLUME: org_volume,
                PROJECT_VOLUMES: project_volumes,
                PROJECT_BALANCING: rebalanced_projects,
                TRANSACTION_VOLUMES: [],
                **END_OF_PASS,
            }
        ) as mocks:
            result = run_calculations_per_org_task(org.id)

        assert result == DynamicSamplingStatus.NO_TRANSACTION_VOLUMES
        mocks[BLENDED_SAMPLE_RATE].assert_called_once_with(organization_id=org.id)
        _assert_called_once_with_config(mocks[ORG_VOLUME], org.id)
        config = _assert_called_once_with_config(mocks[PROJECT_VOLUMES], org.id)
        mocks[PROJECT_BALANCING].assert_called_once_with(config, project_volumes)
        _assert_called_once_with_config(mocks[TRANSACTION_VOLUMES], org.id)
        assert config.results.rebalanced_projects == rebalanced_projects
        assert config.results.transaction_volumes == []

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_skips_project_balancing_for_project_mode(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        org.update_option("sentry:sampling_mode", DynamicSamplingMode.PROJECT)
        project.update_option("sentry:target_sample_rate", 0.2)
        org_volume = OrganizationDataVolume(org_id=org.id, total=100, indexed=25)
        project_volumes = [make_project_volume(project.id)]
        transaction_volumes = _transaction_volumes(org, project.id)

        with (
            self.feature("organizations:dynamic-sampling-custom"),
            patch_configuration(
                {
                    BLENDED_SAMPLE_RATE: DEFAULT,
                    ORG_VOLUME: org_volume,
                    PROJECT_VOLUMES: project_volumes,
                    PROJECT_BALANCING: DEFAULT,
                    TRANSACTION_VOLUMES: transaction_volumes,
                    TRANSACTION_BALANCING: {},
                    **END_OF_PASS,
                }
            ) as mocks,
        ):
            result = run_calculations_per_org_task(org.id)

        assert result is None
        mocks[BLENDED_SAMPLE_RATE].assert_not_called()
        _assert_called_once_with_config(mocks[ORG_VOLUME], org.id)
        _assert_called_once_with_config(mocks[PROJECT_VOLUMES], org.id)
        mocks[PROJECT_BALANCING].assert_not_called()
        config = _assert_called_once_with_config(mocks[TRANSACTION_VOLUMES], org.id)
        mocks[TRANSACTION_BALANCING].assert_called_once_with(
            config, project_volumes, transaction_volumes
        )
        assert config.results.rebalanced_projects == []

    @override_options(
        {
            "dynamic-sampling.per_org.rollout-rate": 1.0,
            "dynamic-sampling.per_org.serving-rollout-rate": 1.0,
        }
    )
    def test_run_calculations_per_org_queries_projects_for_am3_org_mode(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        org.update_option("sentry:sampling_mode", DynamicSamplingMode.ORGANIZATION)
        org_volume = OrganizationDataVolume(org_id=org.id, total=100, indexed=25)
        project_volumes = [make_project_volume(project.id)]
        rebalanced_projects = [RebalancedItem(id=project.id, count=100, new_sample_rate=0.5)]
        transaction_volumes = _transaction_volumes(org, project.id)

        with (
            self.feature("organizations:dynamic-sampling-custom"),
            patch_configuration(
                {
                    BLENDED_SAMPLE_RATE: DEFAULT,
                    ORG_VOLUME: org_volume,
                    PROJECT_VOLUMES: project_volumes,
                    PROJECT_BALANCING: rebalanced_projects,
                    TRANSACTION_VOLUMES: transaction_volumes,
                    TRANSACTION_BALANCING: {},
                    SET_FACTOR: DEFAULT,
                    EMIT_COMPARISONS: DEFAULT,
                }
            ) as mocks,
        ):
            result = run_calculations_per_org_task(org.id)

        assert result is None
        mocks[BLENDED_SAMPLE_RATE].assert_not_called()
        _assert_called_once_with_config(mocks[ORG_VOLUME], org.id)
        config = _assert_called_once_with_config(mocks[PROJECT_VOLUMES], org.id)
        mocks[PROJECT_BALANCING].assert_called_once_with(config, project_volumes)
        _assert_called_once_with_config(mocks[TRANSACTION_VOLUMES], org.id)
        mocks[TRANSACTION_BALANCING].assert_called_once_with(
            config, project_volumes, transaction_volumes
        )
        mocks[SET_FACTOR].assert_called_once_with(org.id, 4.0)

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_skips_project_mode_without_project_rates(self) -> None:
        org = self.create_organization()
        self.create_project(organization=org)
        org.update_option("sentry:sampling_mode", DynamicSamplingMode.PROJECT)

        with (
            self.feature("organizations:dynamic-sampling-custom"),
            patch_configuration(
                {
                    BLENDED_SAMPLE_RATE: DEFAULT,
                    ORG_VOLUME: DEFAULT,
                    PROJECT_VOLUMES: DEFAULT,
                    **END_OF_PASS,
                }
            ) as mocks,
        ):
            result = run_calculations_per_org_task(org.id)

        assert result == DynamicSamplingStatus.ORG_HAS_NO_DYNAMIC_SAMPLING
        mocks[BLENDED_SAMPLE_RATE].assert_not_called()
        mocks[ORG_VOLUME].assert_not_called()
        mocks[PROJECT_VOLUMES].assert_not_called()
        # An organization without dynamic sampling has nothing to report or store.
        mocks[EMIT_COMPARISONS].assert_not_called()
        mocks[WRITE_CACHES].assert_not_called()

    @override_options(
        {
            "dynamic-sampling.per_org.rollout-rate": 1.0,
            "dynamic-sampling.per_org.serving-rollout-rate": 1.0,
        }
    )
    def test_run_calculations_per_org_queries_projects_for_am2(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        org_volume = OrganizationDataVolume(org_id=org.id, total=100, indexed=25)
        project_volumes = [make_project_volume(project.id)]
        rebalanced_projects = [RebalancedItem(id=project.id, count=100, new_sample_rate=0.5)]
        transaction_volumes = _transaction_volumes(org, project.id)

        with patch_configuration(
            {
                BLENDED_SAMPLE_RATE: 1.0,
                ORG_VOLUME: org_volume,
                PROJECT_VOLUMES: project_volumes,
                PROJECT_BALANCING: rebalanced_projects,
                TRANSACTION_VOLUMES: transaction_volumes,
                TRANSACTION_BALANCING: {},
                SET_FACTOR: DEFAULT,
                EMIT_COMPARISONS: DEFAULT,
            }
        ) as mocks:
            result = run_calculations_per_org_task(org.id)

        assert result is None
        mocks[BLENDED_SAMPLE_RATE].assert_called_once_with(organization_id=org.id)
        _assert_called_once_with_config(mocks[ORG_VOLUME], org.id)
        config = _assert_called_once_with_config(mocks[PROJECT_VOLUMES], org.id)
        mocks[PROJECT_BALANCING].assert_called_once_with(config, project_volumes)
        _assert_called_once_with_config(mocks[TRANSACTION_VOLUMES], org.id)
        # Every root project is queried, not only the ones being rebalanced. Narrowing
        # to `projects_to_balance` drops every segment rooted at a project sampled at
        # 100%, so those root projects report no transaction volume at all.
        assert "root_projects" not in mocks[TRANSACTION_VOLUMES].call_args.kwargs
        mocks[TRANSACTION_BALANCING].assert_called_once_with(
            config, project_volumes, transaction_volumes
        )
        # Both sides of the effective sample rate come from the one EAP organization volume.
        assert config.results.organization_volume is org_volume
        assert config.results.recalibration_factor == 4.0
        mocks[SET_FACTOR].assert_called_once_with(org.id, 4.0)
        # The comparison reads the same results, so it runs after the last stage.
        _assert_called_once_with_config(mocks[EMIT_COMPARISONS], org.id)

    @override_options(
        {
            "dynamic-sampling.per_org.rollout-rate": 1.0,
            "dynamic-sampling.per_org.serving-rollout-rate": 1.0,
        }
    )
    def test_run_calculations_per_org_skips_the_factor_without_stored_segments(
        self,
    ) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        org_volume = OrganizationDataVolume(org_id=org.id, total=100, indexed=0)
        project_volumes = [make_project_volume(project.id)]

        with patch_configuration(
            {
                BLENDED_SAMPLE_RATE: 0.5,
                ORG_VOLUME: org_volume,
                PROJECT_VOLUMES: project_volumes,
                PROJECT_BALANCING: [RebalancedItem(id=project.id, count=100, new_sample_rate=0.5)],
                TRANSACTION_VOLUMES: _transaction_volumes(org, project.id),
                TRANSACTION_BALANCING: {},
                SET_FACTOR: DEFAULT,
                EMIT_COMPARISONS: DEFAULT,
            }
        ) as mocks:
            result = run_calculations_per_org_task(org.id)

        assert result is None
        config = _assert_called_once_with_config(mocks[PROJECT_VOLUMES], org.id)
        # An org that stored nothing has no effective sample rate, so there is no factor.
        assert config.results.recalibration_factor is None
        mocks[SET_FACTOR].assert_not_called()
        # The comparison still runs, so the legacy factor is reported next to no EAP factor.
        _assert_called_once_with_config(mocks[EMIT_COMPARISONS], org.id)

    @override_options(
        {
            "dynamic-sampling.per_org.rollout-rate": 1.0,
            "dynamic-sampling.per_org.serving-rollout-rate": 0.0,
        }
    )
    def test_run_calculations_per_org_skips_recalibration_for_an_unserved_org(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        org_volume = OrganizationDataVolume(org_id=org.id, total=100, indexed=25)
        project_volumes = [make_project_volume(project.id)]

        with patch_configuration(
            {
                BLENDED_SAMPLE_RATE: 0.5,
                ORG_VOLUME: org_volume,
                PROJECT_VOLUMES: project_volumes,
                PROJECT_BALANCING: [RebalancedItem(id=project.id, count=100, new_sample_rate=0.5)],
                TRANSACTION_VOLUMES: _transaction_volumes(org, project.id),
                TRANSACTION_BALANCING: {},
                SET_FACTOR: DEFAULT,
                EMIT_COMPARISONS: DEFAULT,
            }
        ) as mocks:
            result = run_calculations_per_org_task(org.id)

        assert result is None
        config = _assert_called_once_with_config(mocks[PROJECT_VOLUMES], org.id)
        # Relay never applies the factor of an unserved org, so a factor computed for it
        # would only compound from one pass to the next.
        assert config.results.recalibration_factor is None
        mocks[SET_FACTOR].assert_not_called()
        _assert_called_once_with_config(mocks[EMIT_COMPARISONS], org.id)

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_still_reports_when_a_stage_raises(self) -> None:
        org = self.create_organization()
        self.create_project(organization=org)
        org_volume = OrganizationDataVolume(org_id=org.id, total=100, indexed=25)

        with patch_configuration(
            {
                BLENDED_SAMPLE_RATE: 1.0,
                ORG_VOLUME: org_volume,
                **END_OF_PASS,
            }
        ) as mocks:
            with patch(PROJECT_VOLUMES, side_effect=ValueError("boom")):
                try:
                    run_calculations_per_org_task(org.id)
                except ValueError:
                    pass

        # The failure propagates, but what the pass computed before it is not thrown away.
        config = _assert_called_once_with_config(mocks[EMIT_COMPARISONS], org.id)
        assert config.results.organization_volume is org_volume
        _assert_called_once_with_config(mocks[WRITE_CACHES], org.id)

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_skips_org_without_transaction_sample_rate(self) -> None:
        org = self.create_organization()

        with patch_configuration({BLENDED_SAMPLE_RATE: None, ORG_VOLUME: DEFAULT}) as mocks:
            result = run_calculations_per_org_task(org.id)

        assert result == DynamicSamplingStatus.ORG_HAS_NO_DYNAMIC_SAMPLING
        mocks[BLENDED_SAMPLE_RATE].assert_called_once_with(organization_id=org.id)
        mocks[ORG_VOLUME].assert_not_called()

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_skips_org_without_projects(self) -> None:
        org = self.create_organization()

        with patch_configuration({BLENDED_SAMPLE_RATE: 1.0, ORG_VOLUME: DEFAULT}) as mocks:
            result = run_calculations_per_org_task(org.id)

        assert result == DynamicSamplingStatus.ORG_HAS_NO_PROJECTS
        mocks[ORG_VOLUME].assert_not_called()

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_skips_org_without_subscription(self) -> None:
        org = self.create_organization()

        with (
            patch(BLENDED_SAMPLE_RATE, side_effect=ObjectDoesNotExist),
            patch_configuration({ORG_VOLUME: DEFAULT}) as mocks,
        ):
            result = run_calculations_per_org_task(org.id)

        assert result == DynamicSamplingStatus.NO_SUBSCRIPTION
        mocks[ORG_VOLUME].assert_not_called()

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_skips_missing_org(self) -> None:
        with patch_configuration({ORG_VOLUME: DEFAULT}) as mocks:
            result = run_calculations_per_org_task(99999999)

        assert result == DynamicSamplingStatus.ORG_HAS_NO_DYNAMIC_SAMPLING
        mocks[ORG_VOLUME].assert_not_called()
