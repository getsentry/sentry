from __future__ import annotations

from unittest.mock import Mock, patch

from django.core.exceptions import ObjectDoesNotExist

from sentry.dynamic_sampling.models.common import RebalancedItem
from sentry.dynamic_sampling.per_org import cache as per_org_recalibration_cache
from sentry.dynamic_sampling.per_org.configuration import BaseDynamicSamplingConfiguration
from sentry.dynamic_sampling.per_org.queries import (
    OUTCOMES_ORGANIZATION_VOLUME_DEFAULT_TIME_INTERVAL,
    ProjectTransactionCounts,
    ProjectVolume,
)
from sentry.dynamic_sampling.per_org.scheduler import (
    BUCKET_COUNT,
    BUCKET_CURSOR_KEY,
    _next_bucket_index,
    run_calculations_per_org_task,
    schedule_per_org_calculations,
)
from sentry.dynamic_sampling.per_org.telemetry import DynamicSamplingStatus
from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds
from sentry.dynamic_sampling.tasks.common import OrganizationDataVolume
from sentry.dynamic_sampling.tasks.helpers import (
    recalibrate_orgs as legacy_recalibration_cache,
)
from sentry.dynamic_sampling.types import DynamicSamplingMode
from sentry.models.organization import OrganizationStatus
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.helpers.task_runner import BurstTaskRunner


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


def _drain_dispatched_org_ids(burst) -> list[int]:
    ids = [args[0] for _task, args, _kwargs in burst.queue]
    burst.queue.clear()
    return ids


class PerOrgRecalibrationCacheTest(TestCase):
    def test_per_org_cache_does_not_cross_pollinate_with_legacy_cache(self) -> None:
        org = self.create_organization()
        redis = get_redis_client_for_ds()
        legacy_key = legacy_recalibration_cache.generate_recalibrate_orgs_cache_key(org.id)
        per_org_key = per_org_recalibration_cache.generate_recalibrate_orgs_cache_key(org.id)
        self.addCleanup(redis.delete, legacy_key, per_org_key)
        redis.delete(legacy_key, per_org_key)

        assert legacy_key != per_org_key

        redis.set(legacy_key, 2.5)
        assert legacy_recalibration_cache.get_adjusted_factor(org.id) == 2.5
        assert per_org_recalibration_cache.get_adjusted_factor(org.id) == 1.0

        redis.delete(legacy_key)
        redis.set(per_org_key, 3.5)
        assert per_org_recalibration_cache.get_adjusted_factor(org.id) == 3.5
        assert legacy_recalibration_cache.get_adjusted_factor(org.id) == 1.0

    def test_per_org_cache_sets_and_deletes_adjusted_factor(self) -> None:
        org = self.create_organization()
        redis = get_redis_client_for_ds()
        cache_key = per_org_recalibration_cache.generate_recalibrate_orgs_cache_key(org.id)
        self.addCleanup(redis.delete, cache_key)
        redis.delete(cache_key)

        per_org_recalibration_cache.set_guarded_adjusted_factor(org.id, 2.5)
        assert per_org_recalibration_cache.get_adjusted_factor(org.id) == 2.5

        per_org_recalibration_cache.set_guarded_adjusted_factor(org.id, 1.0)
        assert per_org_recalibration_cache.get_adjusted_factor(org.id) == 1.0


class SchedulePerOrgCalculationsTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.redis = get_redis_client_for_ds()
        self.redis.delete(BUCKET_CURSOR_KEY)
        self.addCleanup(self.redis.delete, BUCKET_CURSOR_KEY)

    def create_orgs_across_buckets(self, per_bucket: int = 2) -> dict[int, list[int]]:
        by_bucket: dict[int, list[int]] = {bucket: [] for bucket in range(BUCKET_COUNT)}
        for _ in range(BUCKET_COUNT * per_bucket * 20):
            if all(len(ids) >= per_bucket for ids in by_bucket.values()):
                break
            org = self.create_organization()
            by_bucket[org.id % BUCKET_COUNT].append(org.id)
        assert all(len(ids) >= per_bucket for ids in by_bucket.values())
        return by_bucket

    @override_options(
        {
            "dynamic-sampling.per_org.killswitch": True,
            "dynamic-sampling.per_org.rollout-rate": 1.0,
        }
    )
    def test_is_noop_when_killswitch_engaged(self) -> None:
        with BurstTaskRunner() as burst:
            schedule_per_org_calculations()
            dispatched = _drain_dispatched_org_ids(burst)

        assert dispatched == []
        assert self.redis.get(BUCKET_CURSOR_KEY) is None

    @override_options({"dynamic-sampling.per_org.rollout-rate": 0.0})
    def test_does_not_scan_when_rollout_zero(self) -> None:
        self.create_organization()

        with BurstTaskRunner() as burst:
            schedule_per_org_calculations()
            dispatched = _drain_dispatched_org_ids(burst)

        assert dispatched == []
        assert self.redis.get(BUCKET_CURSOR_KEY) is None

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_advances_bucket_cursor(self) -> None:
        with BurstTaskRunner() as burst:
            schedule_per_org_calculations()

        assert burst.queue == []
        cursor = self.redis.get(BUCKET_CURSOR_KEY)
        assert cursor is not None
        assert int(cursor) == 1

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_dispatches_only_orgs_in_target_bucket(self) -> None:
        by_bucket = self.create_orgs_across_buckets(per_bucket=2)
        target = 3
        self.redis.set(BUCKET_CURSOR_KEY, target)

        with BurstTaskRunner() as burst:
            schedule_per_org_calculations()
            dispatched = _drain_dispatched_org_ids(burst)

        for org_id in dispatched:
            assert org_id % BUCKET_COUNT == target
        for org_id in by_bucket[target]:
            assert org_id in dispatched
        for bucket, org_ids in by_bucket.items():
            if bucket == target:
                continue
            for org_id in org_ids:
                assert org_id not in dispatched
        assert len(dispatched) >= len(by_bucket[target])

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_bucket_skips_inactive_orgs(self) -> None:
        active = self.create_organization()
        pending_deletion = self.create_organization()
        pending_deletion.status = OrganizationStatus.PENDING_DELETION
        pending_deletion.save()

        with BurstTaskRunner() as burst:
            for bucket in range(BUCKET_COUNT):
                self.redis.set(BUCKET_CURSOR_KEY, bucket)
                schedule_per_org_calculations()
            dispatched = _drain_dispatched_org_ids(burst)

        assert active.id in dispatched
        assert pending_deletion.id not in dispatched

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_returns_no_volume_without_traffic(self) -> None:
        org = self.create_organization()
        self.create_project(organization=org, teams=[])

        with (
            patch(
                "sentry.dynamic_sampling.per_org.configuration.quotas.backend.get_blended_sample_rate",
                return_value=1.0,
            ) as get_blended_sample_rate,
            patch(
                "sentry.dynamic_sampling.per_org.configuration.get_eap_organization_volume",
                return_value=None,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.get_outcomes_organization_volume",
                return_value=None,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.get_eap_organization_volume",
                return_value=None,
            ) as get_volume,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.get_eap_project_volumes"
            ) as get_project_volumes,
            patch(
                "sentry.dynamic_sampling.per_org.configuration.legacy_recalibration_cache.get_adjusted_factor",
            ) as get_factor,
            patch(
                "sentry.dynamic_sampling.per_org.configuration.per_org_recalibration_cache.get_adjusted_factor",
            ) as get_per_org_factor,
        ):
            result = run_calculations_per_org_task(org.id)

        assert result == DynamicSamplingStatus.NO_ORG_VOLUME
        _assert_called_once_with_config(get_volume, org.id)
        get_blended_sample_rate.assert_called_once_with(organization_id=org.id)
        get_project_volumes.assert_not_called()
        get_factor.assert_not_called()
        get_per_org_factor.assert_not_called()

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_continues_with_traffic(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org, teams=[])
        org_volume_5_minutes = OrganizationDataVolume(org_id=org.id, total=100, indexed=25)
        org_volume_1_hour = OrganizationDataVolume(org_id=org.id, total=1000, indexed=250)
        project_volumes = [_project_volume(project.id)]
        rebalanced_projects = [RebalancedItem(id=project.id, count=100, new_sample_rate=1.0)]
        cached_sample_rates: dict[int, float | None] = {}

        with (
            patch(
                "sentry.dynamic_sampling.per_org.configuration.quotas.backend.get_blended_sample_rate",
                return_value=1.0,
            ) as get_blended_sample_rate,
            patch(
                "sentry.dynamic_sampling.per_org.configuration.get_eap_organization_volume",
                return_value=None,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.get_eap_organization_volume",
                return_value=org_volume_1_hour,
            ) as get_volume,
            patch(
                "sentry.dynamic_sampling.per_org.configuration.get_outcomes_organization_volume",
                return_value=org_volume_5_minutes,
            ) as get_outcome_volume,
            patch(
                "sentry.dynamic_sampling.per_org.configuration.legacy_recalibration_cache.get_adjusted_factor",
                return_value=1.0,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.per_org_recalibration_cache.get_adjusted_factor",
                return_value=1.0,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.per_org_recalibration_cache.set_guarded_adjusted_factor",
            ) as set_per_org_factor,
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
        _assert_called_once_with_config(get_volume, org.id)
        get_outcome_volume.assert_called_once_with(
            org.id, time_interval=OUTCOMES_ORGANIZATION_VOLUME_DEFAULT_TIME_INTERVAL
        )
        get_blended_sample_rate.assert_called_once_with(organization_id=org.id)
        project_config = _assert_called_once_with_config(get_project_volumes, org.id)
        project_balancing.assert_called_once_with(project_config, project_volumes)
        get_cached_sample_rates.assert_called_once_with(org.id)
        compare_rebalanced_projects.assert_called_once_with(
            project_config, rebalanced_projects, cached_sample_rates
        )
        transaction_config = _assert_called_once_with_config(get_transaction_volumes, org.id)
        transaction_balancing.assert_called_once_with(
            transaction_config, project_volumes, get_transaction_volumes.return_value
        )
        assert project_config.organization_recalibration_factor == 4.0
        set_per_org_factor.assert_called_once_with(org.id, 4.0)

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_skips_recalibration_without_valid_5_minute_volume(
        self,
    ) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org, teams=[])
        org_volume_1_hour = OrganizationDataVolume(org_id=org.id, total=1000, indexed=250)
        project_volumes = [_project_volume(project.id)]
        rebalanced_projects = [RebalancedItem(id=project.id, count=100, new_sample_rate=1.0)]
        cached_sample_rates: dict[int, float | None] = {}

        with (
            patch(
                "sentry.dynamic_sampling.per_org.configuration.quotas.backend.get_blended_sample_rate",
                return_value=1.0,
            ) as get_blended_sample_rate,
            patch(
                "sentry.dynamic_sampling.per_org.configuration.get_eap_organization_volume",
                return_value=None,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.get_eap_organization_volume",
                return_value=org_volume_1_hour,
            ) as get_volume,
            patch(
                "sentry.dynamic_sampling.per_org.configuration.get_outcomes_organization_volume",
                return_value=None,
            ) as get_outcome_volume,
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
                    {
                        "org_id": org.id,
                        "project_id": project.id,
                        "transaction_counts": [("checkout", 1.0)],
                        "total_num_transactions": 1.0,
                        "total_num_classes": 1,
                    }
                ],
            ) as get_transaction_volumes,
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.run_transaction_balancing",
                return_value={},
            ) as transaction_balancing,
            patch(
                "sentry.dynamic_sampling.per_org.configuration.legacy_recalibration_cache.get_adjusted_factor",
            ) as get_factor,
            patch(
                "sentry.dynamic_sampling.per_org.configuration.per_org_recalibration_cache.get_adjusted_factor",
            ) as get_per_org_factor,
        ):
            result = run_calculations_per_org_task(org.id)

        assert result is None
        _assert_called_once_with_config(get_volume, org.id)
        get_outcome_volume.assert_called_once_with(
            org.id, time_interval=OUTCOMES_ORGANIZATION_VOLUME_DEFAULT_TIME_INTERVAL
        )
        get_blended_sample_rate.assert_called_once_with(organization_id=org.id)
        project_config = _assert_called_once_with_config(get_project_volumes, org.id)
        project_balancing.assert_called_once_with(project_config, project_volumes)
        get_cached_sample_rates.assert_called_once_with(org.id)
        compare_rebalanced_projects.assert_called_once_with(
            project_config, rebalanced_projects, cached_sample_rates
        )
        transaction_config = _assert_called_once_with_config(get_transaction_volumes, org.id)
        transaction_balancing.assert_called_once_with(
            transaction_config, project_volumes, get_transaction_volumes.return_value
        )
        get_factor.assert_not_called()
        get_per_org_factor.assert_not_called()

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_returns_no_volume_without_project_volumes(self) -> None:
        org = self.create_organization()
        self.create_project(organization=org, teams=[])
        org_volume = OrganizationDataVolume(org_id=org.id, total=100, indexed=25)

        with (
            patch(
                "sentry.dynamic_sampling.per_org.configuration.quotas.backend.get_blended_sample_rate",
                return_value=1.0,
            ) as get_blended_sample_rate,
            patch(
                "sentry.dynamic_sampling.per_org.configuration.get_eap_organization_volume",
                return_value=None,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.get_outcomes_organization_volume",
                return_value=None,
            ),
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
        project = self.create_project(organization=org, teams=[])
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
                "sentry.dynamic_sampling.per_org.configuration.get_eap_organization_volume",
                return_value=None,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.get_outcomes_organization_volume",
                return_value=None,
            ),
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
            project_config, rebalanced_projects, cached_sample_rates
        )
        _assert_called_once_with_config(get_transaction_volumes, org.id)

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_skips_project_balancing_for_project_mode(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org, teams=[])
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
        # Project volumes are fetched even in project mode (transaction balancing
        # needs full per-project totals) but project balancing itself is skipped.
        _assert_called_once_with_config(get_project_volumes, org.id)
        project_balancing.assert_not_called()
        transaction_config = _assert_called_once_with_config(get_transaction_volumes, org.id)
        transaction_balancing.assert_called_once_with(
            transaction_config, project_volumes, get_transaction_volumes.return_value
        )

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_queries_projects_for_am3_org_mode(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org, teams=[])
        org.update_option("sentry:sampling_mode", DynamicSamplingMode.ORGANIZATION)
        org_volume = OrganizationDataVolume(org_id=org.id, total=100, indexed=25)
        project_volumes = [_project_volume(project.id)]
        rebalanced_projects = [RebalancedItem(id=project.id, count=100, new_sample_rate=1.0)]
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
                "sentry.dynamic_sampling.per_org.configuration.get_outcomes_organization_volume",
                return_value=org_volume,
            ) as get_outcome_volume,
            patch(
                "sentry.dynamic_sampling.per_org.configuration.legacy_recalibration_cache.get_adjusted_factor",
                return_value=1.0,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.per_org_recalibration_cache.get_adjusted_factor",
                return_value=1.0,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.per_org_recalibration_cache.set_guarded_adjusted_factor",
            ) as set_per_org_factor,
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
        get_outcome_volume.assert_called_once_with(
            org.id, time_interval=OUTCOMES_ORGANIZATION_VOLUME_DEFAULT_TIME_INTERVAL
        )
        project_config = _assert_called_once_with_config(get_project_volumes, org.id)
        project_balancing.assert_called_once_with(project_config, project_volumes)
        get_cached_sample_rates.assert_called_once_with(org.id)
        compare_rebalanced_projects.assert_called_once_with(
            project_config, rebalanced_projects, cached_sample_rates
        )
        transaction_config = _assert_called_once_with_config(get_transaction_volumes, org.id)
        transaction_balancing.assert_called_once_with(
            transaction_config, project_volumes, get_transaction_volumes.return_value
        )
        assert project_config.organization_recalibration_factor == 4.0
        set_per_org_factor.assert_called_once_with(org.id, 4.0)

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_skips_project_mode_without_project_rates(self) -> None:
        org = self.create_organization()
        self.create_project(organization=org, teams=[])
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
        project = self.create_project(organization=org, teams=[])
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
                "sentry.dynamic_sampling.per_org.configuration.get_eap_organization_volume",
                return_value=None,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.scheduler.get_eap_organization_volume",
                return_value=org_volume,
            ) as get_volume,
            patch(
                "sentry.dynamic_sampling.per_org.configuration.get_outcomes_organization_volume",
                return_value=org_volume,
            ) as get_outcome_volume,
            patch(
                "sentry.dynamic_sampling.per_org.configuration.legacy_recalibration_cache.get_adjusted_factor",
                return_value=1.0,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.per_org_recalibration_cache.get_adjusted_factor",
                return_value=1.0,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.configuration.per_org_recalibration_cache.set_guarded_adjusted_factor",
            ) as set_per_org_factor,
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
        get_outcome_volume.assert_called_once_with(
            org.id, time_interval=OUTCOMES_ORGANIZATION_VOLUME_DEFAULT_TIME_INTERVAL
        )
        project_config = _assert_called_once_with_config(get_project_volumes, org.id)
        project_balancing.assert_called_once_with(project_config, project_volumes)
        get_cached_sample_rates.assert_called_once_with(org.id)
        compare_rebalanced_projects.assert_called_once_with(
            project_config, rebalanced_projects, cached_sample_rates
        )
        transaction_config = _assert_called_once_with_config(get_transaction_volumes, org.id)
        transaction_balancing.assert_called_once_with(
            transaction_config, project_volumes, get_transaction_volumes.return_value
        )
        assert project_config.organization_recalibration_factor == 4.0
        set_per_org_factor.assert_called_once_with(org.id, 4.0)

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


class NextBucketIndexTest(TestCase):
    def test_uses_redis_cursor(self) -> None:
        redis = get_redis_client_for_ds()
        redis.delete(BUCKET_CURSOR_KEY)
        self.addCleanup(redis.delete, BUCKET_CURSOR_KEY)

        first_cycle = [_next_bucket_index() for _ in range(BUCKET_COUNT)]
        cursor_after_cycle = redis.get(BUCKET_CURSOR_KEY)
        next_cycle = [_next_bucket_index() for _ in range(2)]
        cursor_after_next_cycle = redis.get(BUCKET_CURSOR_KEY)

        assert first_cycle == list(range(BUCKET_COUNT))
        assert cursor_after_cycle is not None
        assert int(cursor_after_cycle) == BUCKET_COUNT
        assert next_cycle == [0, 1]
        assert cursor_after_next_cycle is not None
        assert int(cursor_after_next_cycle) == BUCKET_COUNT + 2
