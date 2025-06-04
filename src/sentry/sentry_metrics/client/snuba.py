from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime

from django.core.cache import cache

from sentry import quotas
from sentry.sentry_metrics.client.base import GenericMetricsBackend
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.testutils.cases import BaseMetricsTestCase  # NOQA:S007
from sentry.utils.env import in_test_environment


def build_mri(metric_name: str, type: str, use_case_id: UseCaseID, unit: str | None) -> str:
    mri_unit = "none" if unit is None else unit
    return f"{type}:{use_case_id.value}/{metric_name}@{mri_unit}"


def get_retention_from_org_id(org_id: int) -> int:
    cache_key = f"sentry_metrics:org_retention_days:{org_id}"
    cached_retention: int | None = cache.get(cache_key)

    if cached_retention is not None:
        return cached_retention
    else:
        # the default in Snuba is 90 days, and if there is no
        # org-configured retention stored, we use that default
        retention = quotas.backend.get_event_retention(organization=org_id) or 90
        cache.set(cache_key, retention)

        return retention


class SnubaMetricsBackend(GenericMetricsBackend):
    """
    This backend is meant for use in dev/testing
    environments. It allows for producing metrics
    to a Snuba HTTP endpoint, which will trigger
    processing and ultimately, insertion, of the
    metric into Clickhouse.
    """

    def counter(
        self,
        use_case_id: UseCaseID,
        org_id: int,
        project_id: int,
        metric_name: str,
        value: int | float,
        tags: dict[str, str],
        unit: str | None,
    ) -> None:
        """
        Emit a counter metric for internal use cases only.
        """
        assert in_test_environment(), "This backend should only be used in testing environments"
        BaseMetricsTestCase.store_metric(
            mri=build_mri(metric_name, "c", use_case_id, unit),
            tags=tags,
            value=value,
            org_id=org_id,
            project_id=project_id,
            timestamp=int(datetime.now().timestamp()),
        )

    def set(
        self,
        use_case_id: UseCaseID,
        org_id: int,
        project_id: int,
        metric_name: str,
        value: Sequence[int],
        tags: dict[str, str],
        unit: str | None,
    ) -> None:
        """
        Emit a set metric for internal use cases only. Can support
        a sequence of values.
        """
        assert in_test_environment(), "This backend should only be used in testing environments"
        for val in value:
            BaseMetricsTestCase.store_metric(
                mri=build_mri(metric_name, "s", use_case_id, unit),
                tags=tags,
                value=val,
                org_id=org_id,
                project_id=project_id,
                timestamp=int(datetime.now().timestamp()),
            )

    def distribution(
        self,
        use_case_id: UseCaseID,
        org_id: int,
        project_id: int,
        metric_name: str,
        value: Sequence[int | float],
        tags: dict[str, str],
        unit: str | None,
    ) -> None:
        """
        Emit a distribution metric for internal use cases only. Can
        support a sequence of values.
        """
        assert in_test_environment(), "This backend should only be used in testing environments"
        for val in value:
            BaseMetricsTestCase.store_metric(
                mri=build_mri(metric_name, "d", use_case_id, unit),
                tags=tags,
                value=val,
                org_id=org_id,
                project_id=project_id,
                timestamp=int(datetime.now().timestamp()),
            )

    def close(self) -> None:
        """
        Calling this is not required and is mostly for usage in tests
        """
