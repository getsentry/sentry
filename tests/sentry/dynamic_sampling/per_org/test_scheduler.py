from __future__ import annotations

from unittest.mock import DEFAULT, Mock, patch

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
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from tests.sentry.dynamic_sampling.per_org.test_helpers import (
    BLENDED_SAMPLE_RATE,
    make_project_volume,
    patch_config,
)

SCHEDULER = "sentry.dynamic_sampling.per_org.scheduler"
ORG_VOLUME = f"{SCHEDULER}.get_eap_organization_volume"
PROJECT_VOLUMES = f"{SCHEDULER}.get_eap_project_volumes"
TRANSACTION_VOLUMES = f"{SCHEDULER}.get_eap_transaction_volumes"
PROJECT_BALANCING = f"{SCHEDULER}.run_project_balancing"
TRANSACTION_BALANCING = f"{SCHEDULER}.run_transaction_balancing"
CACHED_PROJECT_RATES = f"{SCHEDULER}.get_cached_rebalanced_project_sample_rates"
COMPARE_PROJECTS = f"{SCHEDULER}.compare_rebalanced_projects_with_cache"


def _assert_called_once_with_config(
    mock: Mock,
    organization_id: int,
) -> BaseDynamicSamplingConfiguration:
    mock.assert_called_once()
    config = mock.call_args.args[0]
    assert isinstance(config, BaseDynamicSamplingConfiguration)
    assert config.organization.id == organization_id
    return config


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

        with patch_config(
            {
                BLENDED_SAMPLE_RATE: 1.0,
                ORG_VOLUME: None,
                PROJECT_VOLUMES: DEFAULT,
            }
        ) as mocks:
            result = run_calculations_per_org_task(org.id)

        assert result == DynamicSamplingStatus.NO_ORG_VOLUME
        _assert_called_once_with_config(mocks[ORG_VOLUME], org.id)
        mocks[BLENDED_SAMPLE_RATE].assert_called_once_with(organization_id=org.id)
        mocks[PROJECT_VOLUMES].assert_not_called()

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_skips_transaction_volumes_at_full_sample_rate(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        org_volume = OrganizationDataVolume(org_id=org.id, total=100, indexed=25)
        project_volumes = [make_project_volume(project.id)]
        rebalanced_projects = [RebalancedItem(id=project.id, count=100, new_sample_rate=1.0)]
        cached_sample_rates: dict[int, float | None] = {}

        with patch_config(
            {
                BLENDED_SAMPLE_RATE: 1.0,
                ORG_VOLUME: org_volume,
                PROJECT_VOLUMES: project_volumes,
                PROJECT_BALANCING: rebalanced_projects,
                CACHED_PROJECT_RATES: cached_sample_rates,
                COMPARE_PROJECTS: DEFAULT,
                TRANSACTION_VOLUMES: DEFAULT,
                TRANSACTION_BALANCING: DEFAULT,
            }
        ) as mocks:
            result = run_calculations_per_org_task(org.id)

        assert result == DynamicSamplingStatus.ALL_PROJECTS_AT_FULL_SAMPLE_RATE
        _assert_called_once_with_config(mocks[ORG_VOLUME], org.id)
        mocks[BLENDED_SAMPLE_RATE].assert_called_once_with(organization_id=org.id)
        project_config = _assert_called_once_with_config(mocks[PROJECT_VOLUMES], org.id)
        mocks[PROJECT_BALANCING].assert_called_once_with(project_config, project_volumes)
        mocks[CACHED_PROJECT_RATES].assert_called_once_with(org.id)
        mocks[COMPARE_PROJECTS].assert_called_once_with(
            project_config, rebalanced_projects, cached_sample_rates, project_volumes
        )
        mocks[TRANSACTION_VOLUMES].assert_not_called()
        mocks[TRANSACTION_BALANCING].assert_not_called()

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_returns_no_volume_without_project_volumes(self) -> None:
        org = self.create_organization()
        self.create_project(organization=org)
        org_volume = OrganizationDataVolume(org_id=org.id, total=100, indexed=25)

        with patch_config(
            {
                BLENDED_SAMPLE_RATE: 1.0,
                ORG_VOLUME: org_volume,
                PROJECT_VOLUMES: [],
                TRANSACTION_VOLUMES: DEFAULT,
                PROJECT_BALANCING: None,
            }
        ) as mocks:
            result = run_calculations_per_org_task(org.id)

        assert result == DynamicSamplingStatus.NO_PROJECT_VOLUMES
        mocks[BLENDED_SAMPLE_RATE].assert_called_once_with(organization_id=org.id)
        _assert_called_once_with_config(mocks[ORG_VOLUME], org.id)
        _assert_called_once_with_config(mocks[PROJECT_VOLUMES], org.id)
        mocks[PROJECT_BALANCING].assert_not_called()
        mocks[TRANSACTION_VOLUMES].assert_not_called()

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_returns_no_volume_without_transaction_volumes(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        org_volume = OrganizationDataVolume(org_id=org.id, total=100, indexed=25)
        project_volumes = [make_project_volume(project.id)]
        rebalanced_projects = [RebalancedItem(id=project.id, count=100, new_sample_rate=0.5)]
        cached_sample_rates: dict[int, float | None] = {}

        with patch_config(
            {
                BLENDED_SAMPLE_RATE: 1.0,
                ORG_VOLUME: org_volume,
                PROJECT_VOLUMES: project_volumes,
                PROJECT_BALANCING: rebalanced_projects,
                CACHED_PROJECT_RATES: cached_sample_rates,
                COMPARE_PROJECTS: DEFAULT,
                TRANSACTION_VOLUMES: [],
            }
        ) as mocks:
            result = run_calculations_per_org_task(org.id)

        assert result == DynamicSamplingStatus.NO_TRANSACTION_VOLUMES
        mocks[BLENDED_SAMPLE_RATE].assert_called_once_with(organization_id=org.id)
        _assert_called_once_with_config(mocks[ORG_VOLUME], org.id)
        project_config = _assert_called_once_with_config(mocks[PROJECT_VOLUMES], org.id)
        mocks[PROJECT_BALANCING].assert_called_once_with(project_config, project_volumes)
        mocks[CACHED_PROJECT_RATES].assert_called_once_with(org.id)
        mocks[COMPARE_PROJECTS].assert_called_once_with(
            project_config, rebalanced_projects, cached_sample_rates, project_volumes
        )
        _assert_called_once_with_config(mocks[TRANSACTION_VOLUMES], org.id)

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_skips_project_balancing_for_project_mode(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        org.update_option("sentry:sampling_mode", DynamicSamplingMode.PROJECT)
        project.update_option("sentry:target_sample_rate", 0.2)
        org_volume = OrganizationDataVolume(org_id=org.id, total=100, indexed=25)
        project_volumes = [make_project_volume(project.id)]
        transaction_volumes = [
            ProjectTransactionCounts(
                org_id=org.id,
                project_id=project.id,
                transaction_counts=[("checkout", 1.0)],
            )
        ]

        with (
            self.feature("organizations:dynamic-sampling-custom"),
            patch_config(
                {
                    BLENDED_SAMPLE_RATE: DEFAULT,
                    ORG_VOLUME: org_volume,
                    PROJECT_VOLUMES: project_volumes,
                    PROJECT_BALANCING: DEFAULT,
                    TRANSACTION_VOLUMES: transaction_volumes,
                    TRANSACTION_BALANCING: {},
                }
            ) as mocks,
        ):
            result = run_calculations_per_org_task(org.id)

        assert result is None
        mocks[BLENDED_SAMPLE_RATE].assert_not_called()
        _assert_called_once_with_config(mocks[ORG_VOLUME], org.id)
        _assert_called_once_with_config(mocks[PROJECT_VOLUMES], org.id)
        mocks[PROJECT_BALANCING].assert_not_called()
        transaction_config = _assert_called_once_with_config(mocks[TRANSACTION_VOLUMES], org.id)
        mocks[TRANSACTION_BALANCING].assert_called_once_with(
            transaction_config, project_volumes, transaction_volumes
        )

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_queries_projects_for_am3_org_mode(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        org.update_option("sentry:sampling_mode", DynamicSamplingMode.ORGANIZATION)
        org_volume = OrganizationDataVolume(org_id=org.id, total=100, indexed=25)
        project_volumes = [make_project_volume(project.id)]
        rebalanced_projects = [RebalancedItem(id=project.id, count=100, new_sample_rate=0.5)]
        cached_sample_rates: dict[int, float | None] = {}
        transaction_volumes = [
            ProjectTransactionCounts(
                org_id=org.id,
                project_id=project.id,
                transaction_counts=[("checkout", 1.0)],
            )
        ]

        with (
            self.feature("organizations:dynamic-sampling-custom"),
            patch_config(
                {
                    BLENDED_SAMPLE_RATE: DEFAULT,
                    ORG_VOLUME: org_volume,
                    PROJECT_VOLUMES: project_volumes,
                    PROJECT_BALANCING: rebalanced_projects,
                    CACHED_PROJECT_RATES: cached_sample_rates,
                    COMPARE_PROJECTS: DEFAULT,
                    TRANSACTION_VOLUMES: transaction_volumes,
                    TRANSACTION_BALANCING: {},
                }
            ) as mocks,
        ):
            result = run_calculations_per_org_task(org.id)

        assert result is None
        mocks[BLENDED_SAMPLE_RATE].assert_not_called()
        _assert_called_once_with_config(mocks[ORG_VOLUME], org.id)
        project_config = _assert_called_once_with_config(mocks[PROJECT_VOLUMES], org.id)
        mocks[PROJECT_BALANCING].assert_called_once_with(project_config, project_volumes)
        mocks[CACHED_PROJECT_RATES].assert_called_once_with(org.id)
        mocks[COMPARE_PROJECTS].assert_called_once_with(
            project_config, rebalanced_projects, cached_sample_rates, project_volumes
        )
        transaction_config = _assert_called_once_with_config(mocks[TRANSACTION_VOLUMES], org.id)
        mocks[TRANSACTION_BALANCING].assert_called_once_with(
            transaction_config, project_volumes, transaction_volumes
        )

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_skips_project_mode_without_project_rates(self) -> None:
        org = self.create_organization()
        self.create_project(organization=org)
        org.update_option("sentry:sampling_mode", DynamicSamplingMode.PROJECT)

        with (
            self.feature("organizations:dynamic-sampling-custom"),
            patch_config(
                {
                    BLENDED_SAMPLE_RATE: DEFAULT,
                    ORG_VOLUME: DEFAULT,
                    PROJECT_VOLUMES: DEFAULT,
                }
            ) as mocks,
        ):
            result = run_calculations_per_org_task(org.id)

        assert result == DynamicSamplingStatus.ORG_HAS_NO_DYNAMIC_SAMPLING
        mocks[BLENDED_SAMPLE_RATE].assert_not_called()
        mocks[ORG_VOLUME].assert_not_called()
        mocks[PROJECT_VOLUMES].assert_not_called()

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_queries_projects_for_am2(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        org_volume = OrganizationDataVolume(org_id=org.id, total=100, indexed=25)
        project_volumes = [make_project_volume(project.id)]
        rebalanced_projects = [RebalancedItem(id=project.id, count=100, new_sample_rate=0.5)]
        cached_sample_rates: dict[int, float | None] = {}
        transaction_volumes = [
            ProjectTransactionCounts(
                org_id=org.id,
                project_id=project.id,
                transaction_counts=[("checkout", 1.0)],
            )
        ]

        with patch_config(
            {
                BLENDED_SAMPLE_RATE: 1.0,
                ORG_VOLUME: org_volume,
                PROJECT_VOLUMES: project_volumes,
                PROJECT_BALANCING: rebalanced_projects,
                CACHED_PROJECT_RATES: cached_sample_rates,
                COMPARE_PROJECTS: DEFAULT,
                TRANSACTION_VOLUMES: transaction_volumes,
                TRANSACTION_BALANCING: {},
            }
        ) as mocks:
            result = run_calculations_per_org_task(org.id)

        assert result is None
        mocks[BLENDED_SAMPLE_RATE].assert_called_once_with(organization_id=org.id)
        _assert_called_once_with_config(mocks[ORG_VOLUME], org.id)
        project_config = _assert_called_once_with_config(mocks[PROJECT_VOLUMES], org.id)
        mocks[PROJECT_BALANCING].assert_called_once_with(project_config, project_volumes)
        mocks[CACHED_PROJECT_RATES].assert_called_once_with(org.id)
        mocks[COMPARE_PROJECTS].assert_called_once_with(
            project_config, rebalanced_projects, cached_sample_rates, project_volumes
        )
        transaction_config = _assert_called_once_with_config(mocks[TRANSACTION_VOLUMES], org.id)
        # Every root project is queried, not only the ones being rebalanced. Narrowing
        # to `projects_to_balance` drops every segment rooted at a project sampled at
        # 100%, so those root projects report no transaction volume at all.
        assert "root_projects" not in mocks[TRANSACTION_VOLUMES].call_args.kwargs
        mocks[TRANSACTION_BALANCING].assert_called_once_with(
            transaction_config, project_volumes, transaction_volumes
        )

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_skips_org_without_transaction_sample_rate(self) -> None:
        org = self.create_organization()

        with patch_config({BLENDED_SAMPLE_RATE: None, ORG_VOLUME: DEFAULT}) as mocks:
            result = run_calculations_per_org_task(org.id)

        assert result == DynamicSamplingStatus.ORG_HAS_NO_DYNAMIC_SAMPLING
        mocks[BLENDED_SAMPLE_RATE].assert_called_once_with(organization_id=org.id)
        mocks[ORG_VOLUME].assert_not_called()

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_skips_org_without_projects(self) -> None:
        org = self.create_organization()

        with patch_config({BLENDED_SAMPLE_RATE: 1.0, ORG_VOLUME: DEFAULT}) as mocks:
            result = run_calculations_per_org_task(org.id)

        assert result == DynamicSamplingStatus.ORG_HAS_NO_PROJECTS
        mocks[ORG_VOLUME].assert_not_called()

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_skips_org_without_subscription(self) -> None:
        org = self.create_organization()

        with (
            patch(BLENDED_SAMPLE_RATE, side_effect=ObjectDoesNotExist),
            patch_config({ORG_VOLUME: DEFAULT}) as mocks,
        ):
            result = run_calculations_per_org_task(org.id)

        assert result == DynamicSamplingStatus.NO_SUBSCRIPTION
        mocks[ORG_VOLUME].assert_not_called()

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_skips_missing_org(self) -> None:
        with patch_config({ORG_VOLUME: DEFAULT}) as mocks:
            result = run_calculations_per_org_task(99999999)

        assert result == DynamicSamplingStatus.ORG_HAS_NO_DYNAMIC_SAMPLING
        mocks[ORG_VOLUME].assert_not_called()
