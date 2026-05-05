from __future__ import annotations

from collections.abc import Callable
from typing import NamedTuple
from unittest.mock import Mock, patch

from django.core.exceptions import ObjectDoesNotExist

from sentry.dynamic_sampling.per_org.tasks.configuration import BaseDynamicSamplingConfiguration
from sentry.dynamic_sampling.per_org.tasks.scheduler import (
    BUCKET_COUNT,
    BUCKET_CURSOR_KEY,
    _next_bucket_index,
    run_calculations_per_org_task,
    schedule_per_org_calculations,
)
from sentry.dynamic_sampling.per_org.tasks.telemetry import TelemetryStatus
from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds
from sentry.dynamic_sampling.tasks.common import OrganizationDataVolume
from sentry.dynamic_sampling.types import DynamicSamplingMode, SamplingMeasure
from sentry.models.organization import OrganizationStatus
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.helpers.task_runner import BurstTaskRunner

SpanOrgIds = Callable[[int], list[int]]


class MeasureOptionCase(NamedTuple):
    name: str
    check_span_feature_flag: bool
    span_org_ids: SpanOrgIds
    expected_measure: SamplingMeasure


def _include_org_id(org_id: int) -> list[int]:
    return [org_id]


def _exclude_org_id(org_id: int) -> list[int]:
    return []


MEASURE_OPTION_CASES = (
    MeasureOptionCase("span-option-disabled", False, _include_org_id, SamplingMeasure.SEGMENTS),
    MeasureOptionCase("org-not-in-span-option", True, _exclude_org_id, SamplingMeasure.SEGMENTS),
    MeasureOptionCase("org-in-span-option", True, _include_org_id, SamplingMeasure.SPANS),
)


def _assert_called_once_with_config(
    mock: Mock,
    organization_id: int,
    measure: SamplingMeasure = SamplingMeasure.SEGMENTS,
) -> BaseDynamicSamplingConfiguration:
    mock.assert_called_once()
    config = mock.call_args.args[0]
    assert isinstance(config, BaseDynamicSamplingConfiguration)
    assert config.organization.id == organization_id
    assert config.measure == measure
    return config


def _drain_dispatched_org_ids(burst) -> list[int]:
    ids = [args[0] for _task, args, _kwargs in burst.queue]
    burst.queue.clear()
    return ids


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

        with (
            patch(
                "sentry.dynamic_sampling.per_org.tasks.configuration.quotas.backend.get_blended_sample_rate",
                return_value=1.0,
            ) as get_blended_sample_rate,
            patch(
                "sentry.dynamic_sampling.per_org.tasks.scheduler.get_eap_organization_volume",
                return_value=None,
            ) as get_volume,
            patch(
                "sentry.dynamic_sampling.per_org.tasks.scheduler.get_eap_project_volumes"
            ) as get_project_volumes,
        ):
            result = run_calculations_per_org_task(org.id)

        assert result == TelemetryStatus.NO_VOLUME
        _assert_called_once_with_config(get_volume, org.id)
        get_blended_sample_rate.assert_called_once_with(organization_id=org.id)
        get_project_volumes.assert_not_called()

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_continues_with_traffic(self) -> None:
        org = self.create_organization()
        org_volume = OrganizationDataVolume(org_id=org.id, total=100, indexed=25)

        with (
            patch(
                "sentry.dynamic_sampling.per_org.tasks.configuration.quotas.backend.get_blended_sample_rate",
                return_value=1.0,
            ) as get_blended_sample_rate,
            patch(
                "sentry.dynamic_sampling.per_org.tasks.scheduler.get_eap_organization_volume",
                return_value=org_volume,
            ) as get_volume,
            patch(
                "sentry.dynamic_sampling.per_org.tasks.scheduler.get_eap_project_volumes",
                return_value=[(1, 100, 25, 75)],
            ) as get_project_volumes,
        ):
            result = run_calculations_per_org_task(org.id)

        assert result is None
        _assert_called_once_with_config(get_volume, org.id)
        get_blended_sample_rate.assert_called_once_with(organization_id=org.id)
        _assert_called_once_with_config(get_project_volumes, org.id)

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_returns_no_volume_without_project_volumes(self) -> None:
        org = self.create_organization()
        org_volume = OrganizationDataVolume(org_id=org.id, total=100, indexed=25)

        with (
            patch(
                "sentry.dynamic_sampling.per_org.tasks.configuration.quotas.backend.get_blended_sample_rate",
                return_value=1.0,
            ) as get_blended_sample_rate,
            patch(
                "sentry.dynamic_sampling.per_org.tasks.scheduler.get_eap_organization_volume",
                return_value=org_volume,
            ) as get_volume,
            patch(
                "sentry.dynamic_sampling.per_org.tasks.scheduler.get_eap_project_volumes",
                return_value=[],
            ) as get_project_volumes,
        ):
            result = run_calculations_per_org_task(org.id)

        assert result == TelemetryStatus.NO_VOLUME
        get_blended_sample_rate.assert_called_once_with(organization_id=org.id)
        _assert_called_once_with_config(get_volume, org.id)
        _assert_called_once_with_config(get_project_volumes, org.id)

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_uses_measure_options_for_project_mode(self) -> None:
        for measure_case in MEASURE_OPTION_CASES:
            with self.subTest(measure_case=measure_case.name):
                org = self.create_organization()
                project = self.create_project(organization=org)
                org.update_option("sentry:sampling_mode", DynamicSamplingMode.PROJECT)
                project.update_option("sentry:target_sample_rate", 0.2)
                org_volume = OrganizationDataVolume(org_id=org.id, total=100, indexed=25)

                with (
                    self.feature("organizations:dynamic-sampling-custom"),
                    self.options(
                        {
                            "dynamic-sampling.check_span_feature_flag": measure_case.check_span_feature_flag,
                            "dynamic-sampling.measure.spans": measure_case.span_org_ids(org.id),
                        }
                    ),
                    patch(
                        "sentry.dynamic_sampling.per_org.tasks.configuration.quotas.backend.get_blended_sample_rate"
                    ) as get_blended_sample_rate,
                    patch(
                        "sentry.dynamic_sampling.per_org.tasks.scheduler.get_eap_organization_volume",
                        return_value=org_volume,
                    ) as get_volume,
                    patch(
                        "sentry.dynamic_sampling.per_org.tasks.scheduler.get_eap_project_volumes",
                        return_value=[(project.id, 100, 25, 75)],
                    ) as get_project_volumes,
                ):
                    result = run_calculations_per_org_task(org.id)

                assert result is None
                get_blended_sample_rate.assert_not_called()
                _assert_called_once_with_config(get_volume, org.id, measure_case.expected_measure)
                _assert_called_once_with_config(
                    get_project_volumes, org.id, measure_case.expected_measure
                )

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_skips_project_mode_without_project_rates(self) -> None:
        org = self.create_organization()
        self.create_project(organization=org)
        org.update_option("sentry:sampling_mode", DynamicSamplingMode.PROJECT)

        with (
            self.feature("organizations:dynamic-sampling-custom"),
            patch(
                "sentry.dynamic_sampling.per_org.tasks.configuration.quotas.backend.get_blended_sample_rate"
            ) as get_blended_sample_rate,
            patch(
                "sentry.dynamic_sampling.per_org.tasks.scheduler.get_eap_organization_volume"
            ) as get_volume,
            patch(
                "sentry.dynamic_sampling.per_org.tasks.scheduler.get_eap_project_volumes"
            ) as get_project_volumes,
        ):
            result = run_calculations_per_org_task(org.id)

        assert result == TelemetryStatus.ORG_HAS_NO_DYNAMIC_SAMPLING
        get_blended_sample_rate.assert_not_called()
        get_volume.assert_not_called()
        get_project_volumes.assert_not_called()

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_uses_measure_options_for_am2(self) -> None:
        for measure_case in MEASURE_OPTION_CASES:
            with self.subTest(measure_case=measure_case.name):
                org = self.create_organization()
                org_volume = OrganizationDataVolume(org_id=org.id, total=100, indexed=25)

                with (
                    self.options(
                        {
                            "dynamic-sampling.check_span_feature_flag": measure_case.check_span_feature_flag,
                            "dynamic-sampling.measure.spans": measure_case.span_org_ids(org.id),
                        }
                    ),
                    patch(
                        "sentry.dynamic_sampling.per_org.tasks.configuration.quotas.backend.get_blended_sample_rate",
                        return_value=1.0,
                    ) as get_blended_sample_rate,
                    patch(
                        "sentry.dynamic_sampling.per_org.tasks.scheduler.get_eap_organization_volume",
                        return_value=org_volume,
                    ) as get_volume,
                    patch(
                        "sentry.dynamic_sampling.per_org.tasks.scheduler.get_eap_project_volumes",
                        return_value=[(1, 100, 25, 75)],
                    ) as get_project_volumes,
                ):
                    result = run_calculations_per_org_task(org.id)

                assert result is None
                get_blended_sample_rate.assert_called_once_with(organization_id=org.id)
                _assert_called_once_with_config(get_volume, org.id, measure_case.expected_measure)
                _assert_called_once_with_config(
                    get_project_volumes, org.id, measure_case.expected_measure
                )

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_skips_org_without_transaction_sample_rate(self) -> None:
        org = self.create_organization()

        with (
            patch(
                "sentry.dynamic_sampling.per_org.tasks.configuration.quotas.backend.get_blended_sample_rate",
                return_value=None,
            ) as get_blended_sample_rate,
            patch(
                "sentry.dynamic_sampling.per_org.tasks.scheduler.get_eap_organization_volume"
            ) as get_volume,
        ):
            result = run_calculations_per_org_task(org.id)

        assert result == TelemetryStatus.ORG_HAS_NO_DYNAMIC_SAMPLING
        get_blended_sample_rate.assert_called_once_with(organization_id=org.id)
        get_volume.assert_not_called()

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_skips_org_without_subscription(self) -> None:
        org = self.create_organization()

        with (
            patch(
                "sentry.dynamic_sampling.per_org.tasks.configuration.quotas.backend.get_blended_sample_rate",
                side_effect=ObjectDoesNotExist,
            ),
            patch(
                "sentry.dynamic_sampling.per_org.tasks.scheduler.get_eap_organization_volume"
            ) as get_volume,
        ):
            result = run_calculations_per_org_task(org.id)

        assert result == TelemetryStatus.NO_SUBSCRIPTION
        get_volume.assert_not_called()

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_run_calculations_per_org_skips_missing_org(self) -> None:
        with patch(
            "sentry.dynamic_sampling.per_org.tasks.scheduler.get_eap_organization_volume"
        ) as get_volume:
            result = run_calculations_per_org_task(99999999)

        assert result == TelemetryStatus.ORG_HAS_NO_DYNAMIC_SAMPLING
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
