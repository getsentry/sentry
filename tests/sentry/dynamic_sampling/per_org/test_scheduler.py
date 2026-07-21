from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.core.exceptions import ObjectDoesNotExist

from sentry.constants import ObjectStatus
from sentry.dynamic_sampling.models.common import RebalancedItem
from sentry.dynamic_sampling.per_org.configuration import BaseDynamicSamplingConfiguration
from sentry.dynamic_sampling.per_org.queries import ProjectTransactionCounts, ProjectVolume
from sentry.dynamic_sampling.per_org.scheduler import (
    run_calculations_per_org_task,
    schedule_per_org_calculations,
)
from sentry.dynamic_sampling.per_org.telemetry import DynamicSamplingStatus
from sentry.dynamic_sampling.tasks.common import OrganizationDataVolume
from sentry.dynamic_sampling.types import DynamicSamplingMode
from sentry.models.organization import OrganizationStatus
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options

SCHEDULER = "sentry.dynamic_sampling.per_org.scheduler"
GET_BLENDED_SAMPLE_RATE = (
    "sentry.dynamic_sampling.per_org.configuration.quotas.backend.get_blended_sample_rate"
)


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


@contextmanager
def _mock_pipeline(
    blended_sample_rate: float | None = None,
    org_volume: OrganizationDataVolume | None = None,
    project_volumes: list[ProjectVolume] | None = None,
    rebalanced_projects: list[RebalancedItem] | None = None,
    transaction_volumes: list[ProjectTransactionCounts] | None = None,
) -> Iterator[SimpleNamespace]:
    with (
        patch(GET_BLENDED_SAMPLE_RATE, return_value=blended_sample_rate) as get_blended_sample_rate,
        patch(f"{SCHEDULER}.get_eap_organization_volume", return_value=org_volume) as get_volume,
        patch(
            f"{SCHEDULER}.get_eap_project_volumes", return_value=project_volumes or []
        ) as get_project_volumes,
        patch(
            f"{SCHEDULER}.run_project_balancing", return_value=rebalanced_projects or []
        ) as project_balancing,
        patch(
            f"{SCHEDULER}.get_cached_rebalanced_project_sample_rates", return_value={}
        ) as get_cached_sample_rates,
        patch(f"{SCHEDULER}.compare_rebalanced_projects_with_cache") as compare_rebalanced_projects,
        patch(
            f"{SCHEDULER}.get_eap_transaction_volumes", return_value=transaction_volumes or []
        ) as get_transaction_volumes,
        patch(f"{SCHEDULER}.run_transaction_balancing", return_value={}) as transaction_balancing,
    ):
        yield SimpleNamespace(
            get_blended_sample_rate=get_blended_sample_rate,
            get_volume=get_volume,
            get_project_volumes=get_project_volumes,
            project_balancing=project_balancing,
            get_cached_sample_rates=get_cached_sample_rates,
            compare_rebalanced_projects=compare_rebalanced_projects,
            get_transaction_volumes=get_transaction_volumes,
            transaction_balancing=transaction_balancing,
        )


class SchedulePerOrgCalculationsTest(TestCase):
    """Tests for the scheduling wrapper: rollout gating and active-org filtering."""

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_dispatches_only_active_orgs(self) -> None:
        active = self.create_organization()
        self.create_project(organization=active)
        pending_deletion = self.create_organization()
        self.create_project(organization=pending_deletion)
        pending_deletion.status = OrganizationStatus.PENDING_DELETION
        pending_deletion.save()

        with patch(f"{SCHEDULER}.CursoredScheduler") as MockScheduler:
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

        with patch(f"{SCHEDULER}.CursoredScheduler") as MockScheduler:
            mock_instance = MockScheduler.return_value
            mock_instance.tick.return_value = False
            schedule_per_org_calculations()

            queryset = MockScheduler.call_args.kwargs["queryset"]
            org_ids = set(queryset.values_list("id", flat=True))

        assert org_with_project.id in org_ids
        assert org_without_projects.id not in org_ids
        assert org_with_inactive_project.id not in org_ids

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_rollout_gate_filters_orgs(self) -> None:
        org = self.create_organization()
        self.create_project(organization=org)

        with patch(f"{SCHEDULER}.CursoredScheduler") as MockScheduler:
            MockScheduler.return_value.tick.return_value = False
            schedule_per_org_calculations()
            validate_item = MockScheduler.call_args.kwargs["validate_item"]

        assert validate_item(org.id) is True
        with override_options({"dynamic-sampling.per_org.rollout-rate": 0.0}):
            assert validate_item(org.id) is False


class RunCalculationsPerOrgTest(TestCase):
    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_am2_happy_path_runs_full_pipeline(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        project_volumes = [_project_volume(project.id)]
        rebalanced_projects = [RebalancedItem(id=project.id, count=100, new_sample_rate=0.5)]
        transaction_volumes = [
            ProjectTransactionCounts(
                org_id=org.id,
                project_id=project.id,
                transaction_counts=[("checkout", 1.0)],
            )
        ]

        with _mock_pipeline(
            blended_sample_rate=1.0,
            org_volume=OrganizationDataVolume(org_id=org.id, total=100, indexed=25),
            project_volumes=project_volumes,
            rebalanced_projects=rebalanced_projects,
            transaction_volumes=transaction_volumes,
        ) as pipeline:
            result = run_calculations_per_org_task(org.id)

        assert result is None
        pipeline.get_blended_sample_rate.assert_called_once_with(organization_id=org.id)
        _assert_called_once_with_config(pipeline.get_volume, org.id)
        project_config = _assert_called_once_with_config(pipeline.get_project_volumes, org.id)
        pipeline.project_balancing.assert_called_once_with(project_config, project_volumes)
        pipeline.get_cached_sample_rates.assert_called_once_with(org.id)
        pipeline.compare_rebalanced_projects.assert_called_once_with(
            project_config, rebalanced_projects, {}, project_volumes
        )
        transaction_config = _assert_called_once_with_config(
            pipeline.get_transaction_volumes, org.id
        )
        assert [
            p.id for p in pipeline.get_transaction_volumes.call_args.kwargs["root_projects"]
        ] == [project.id]
        pipeline.transaction_balancing.assert_called_once_with(
            transaction_config, project_volumes, transaction_volumes
        )

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_all_projects_at_full_sample_rate_skips_transaction_step(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)

        with _mock_pipeline(
            blended_sample_rate=1.0,
            org_volume=OrganizationDataVolume(org_id=org.id, total=100, indexed=25),
            project_volumes=[_project_volume(project.id)],
            rebalanced_projects=[RebalancedItem(id=project.id, count=100, new_sample_rate=1.0)],
        ) as pipeline:
            result = run_calculations_per_org_task(org.id)

        assert result == DynamicSamplingStatus.ALL_PROJECTS_AT_FULL_SAMPLE_RATE
        pipeline.project_balancing.assert_called_once()
        pipeline.get_transaction_volumes.assert_not_called()
        pipeline.transaction_balancing.assert_not_called()

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_no_org_volume_short_circuits(self) -> None:
        org = self.create_organization()
        self.create_project(organization=org)

        with _mock_pipeline(blended_sample_rate=1.0, org_volume=None) as pipeline:
            result = run_calculations_per_org_task(org.id)

        assert result == DynamicSamplingStatus.NO_ORG_VOLUME
        _assert_called_once_with_config(pipeline.get_volume, org.id)
        pipeline.get_project_volumes.assert_not_called()

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_no_project_volumes_short_circuits(self) -> None:
        org = self.create_organization()
        self.create_project(organization=org)

        with _mock_pipeline(
            blended_sample_rate=1.0,
            org_volume=OrganizationDataVolume(org_id=org.id, total=100, indexed=25),
            project_volumes=[],
        ) as pipeline:
            result = run_calculations_per_org_task(org.id)

        assert result == DynamicSamplingStatus.NO_PROJECT_VOLUMES
        _assert_called_once_with_config(pipeline.get_project_volumes, org.id)
        pipeline.project_balancing.assert_not_called()
        pipeline.get_transaction_volumes.assert_not_called()

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_no_transaction_volumes_short_circuits(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        project_volumes = [_project_volume(project.id)]
        rebalanced_projects = [RebalancedItem(id=project.id, count=100, new_sample_rate=0.5)]

        with _mock_pipeline(
            blended_sample_rate=1.0,
            org_volume=OrganizationDataVolume(org_id=org.id, total=100, indexed=25),
            project_volumes=project_volumes,
            rebalanced_projects=rebalanced_projects,
            transaction_volumes=[],
        ) as pipeline:
            result = run_calculations_per_org_task(org.id)

        assert result == DynamicSamplingStatus.NO_TRANSACTION_VOLUMES
        project_config = _assert_called_once_with_config(pipeline.get_project_volumes, org.id)
        pipeline.project_balancing.assert_called_once_with(project_config, project_volumes)
        pipeline.compare_rebalanced_projects.assert_called_once_with(
            project_config, rebalanced_projects, {}, project_volumes
        )
        _assert_called_once_with_config(pipeline.get_transaction_volumes, org.id)
        pipeline.transaction_balancing.assert_not_called()

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_project_mode_skips_project_balancing(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        org.update_option("sentry:sampling_mode", DynamicSamplingMode.PROJECT)
        project.update_option("sentry:target_sample_rate", 0.2)
        project_volumes = [_project_volume(project.id)]
        transaction_volumes = [
            ProjectTransactionCounts(
                org_id=org.id,
                project_id=project.id,
                transaction_counts=[("checkout", 1.0)],
            )
        ]

        with (
            self.feature("organizations:dynamic-sampling-custom"),
            _mock_pipeline(
                org_volume=OrganizationDataVolume(org_id=org.id, total=100, indexed=25),
                project_volumes=project_volumes,
                transaction_volumes=transaction_volumes,
            ) as pipeline,
        ):
            result = run_calculations_per_org_task(org.id)

        assert result is None
        pipeline.get_blended_sample_rate.assert_not_called()
        pipeline.project_balancing.assert_not_called()
        pipeline.compare_rebalanced_projects.assert_not_called()
        transaction_config = _assert_called_once_with_config(
            pipeline.get_transaction_volumes, org.id
        )
        pipeline.transaction_balancing.assert_called_once_with(
            transaction_config, project_volumes, transaction_volumes
        )

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_am3_org_mode_balances_projects(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        org.update_option("sentry:sampling_mode", DynamicSamplingMode.ORGANIZATION)
        project_volumes = [_project_volume(project.id)]

        with (
            self.feature("organizations:dynamic-sampling-custom"),
            _mock_pipeline(
                org_volume=OrganizationDataVolume(org_id=org.id, total=100, indexed=25),
                project_volumes=project_volumes,
                rebalanced_projects=[RebalancedItem(id=project.id, count=100, new_sample_rate=0.5)],
                transaction_volumes=[
                    ProjectTransactionCounts(
                        org_id=org.id,
                        project_id=project.id,
                        transaction_counts=[("checkout", 1.0)],
                    )
                ],
            ) as pipeline,
        ):
            result = run_calculations_per_org_task(org.id)

        assert result is None
        pipeline.get_blended_sample_rate.assert_not_called()
        project_config = _assert_called_once_with_config(pipeline.get_project_volumes, org.id)
        pipeline.project_balancing.assert_called_once_with(project_config, project_volumes)
        pipeline.transaction_balancing.assert_called_once()

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_project_mode_without_project_rates_is_skipped(self) -> None:
        org = self.create_organization()
        self.create_project(organization=org)
        org.update_option("sentry:sampling_mode", DynamicSamplingMode.PROJECT)

        with (
            self.feature("organizations:dynamic-sampling-custom"),
            _mock_pipeline() as pipeline,
        ):
            result = run_calculations_per_org_task(org.id)

        assert result == DynamicSamplingStatus.ORG_HAS_NO_DYNAMIC_SAMPLING
        pipeline.get_blended_sample_rate.assert_not_called()
        pipeline.get_volume.assert_not_called()

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_org_without_sample_rate_is_skipped(self) -> None:
        org = self.create_organization()

        with _mock_pipeline(blended_sample_rate=None) as pipeline:
            result = run_calculations_per_org_task(org.id)

        assert result == DynamicSamplingStatus.ORG_HAS_NO_DYNAMIC_SAMPLING
        pipeline.get_blended_sample_rate.assert_called_once_with(organization_id=org.id)
        pipeline.get_volume.assert_not_called()

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_org_without_projects_is_skipped(self) -> None:
        org = self.create_organization()

        with _mock_pipeline(blended_sample_rate=1.0) as pipeline:
            result = run_calculations_per_org_task(org.id)

        assert result == DynamicSamplingStatus.ORG_HAS_NO_PROJECTS
        pipeline.get_volume.assert_not_called()

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_org_without_subscription_is_skipped(self) -> None:
        org = self.create_organization()

        with (
            patch(GET_BLENDED_SAMPLE_RATE, side_effect=ObjectDoesNotExist),
            patch(f"{SCHEDULER}.get_eap_organization_volume") as get_volume,
        ):
            result = run_calculations_per_org_task(org.id)

        assert result == DynamicSamplingStatus.NO_SUBSCRIPTION
        get_volume.assert_not_called()

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_missing_org_is_skipped(self) -> None:
        with _mock_pipeline() as pipeline:
            result = run_calculations_per_org_task(99999999)

        assert result == DynamicSamplingStatus.ORG_HAS_NO_DYNAMIC_SAMPLING
        pipeline.get_volume.assert_not_called()
