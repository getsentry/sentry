from __future__ import annotations

from datetime import datetime
from typing import Dict, Optional, Sequence, Union

from django.core.cache import cache

from sentry import quotas
from sentry.sentry_metrics.client.base import GenericMetricsBackend
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.testutils.cases import BaseMetricsTestCase  # NOQA:S007


def build_mri(metric_name: str, type: str, use_case_id: UseCaseID, unit: Optional[str]) -> str:
    mri_unit = "none" if unit is None else unit
    return f"{type}:{use_case_id.value}/{metric_name}@{mri_unit}"


def get_retention_from_org_id(org_id: int) -> int:
    cache_key = f"sentry_metrics:org_retention_days:{org_id}"
    cached_retention: Optional[int] = cache.get(cache_key)

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
        value: Union[int, float],
        tags: Dict[str, str],
        unit: Optional[str],
    ) -> None:

        """
        Emit a counter metric for internal use cases only.
        """

        BaseMetricsTestCase.store_metric(
            name=build_mri(metric_name, "c", use_case_id, unit),
            tags=tags,
            value=value,
            org_id=org_id,
            project_id=project_id,
            type="counter",
            timestamp=int(datetime.now().timestamp()),
            use_case_id=use_case_id,
        )

    def set(
        self,
        use_case_id: UseCaseID,
        org_id: int,
        project_id: int,
        metric_name: str,
        value: Sequence[int],
        tags: Dict[str, str],
        unit: Optional[str],
    ) -> None:

        """
        Emit a set metric for internal use cases only. Can support
        a sequence of values.
        """

        for val in value:
            BaseMetricsTestCase.store_metric(
                name=build_mri(metric_name, "s", use_case_id, unit),
                tags=tags,
                value=val,
                org_id=org_id,
                project_id=project_id,
                type="set",
                timestamp=int(datetime.now().timestamp()),
                use_case_id=use_case_id,
            )

    def distribution(
        self,
        use_case_id: UseCaseID,
        org_id: int,
        project_id: int,
        metric_name: str,
        value: Sequence[Union[int, float]],
        tags: Dict[str, str],
        unit: Optional[str],
    ) -> None:

        """
        Emit a distribution metric for internal use cases only. Can
        support a sequence of values.
        """
        for val in value:
            BaseMetricsTestCase.store_metric(
                name=build_mri(metric_name, "d", use_case_id, unit),
                tags=tags,
                value=val,
                org_id=org_id,
                project_id=project_id,
                type="distribution",
                timestamp=int(datetime.now().timestamp()),
                use_case_id=use_case_id,
            )

    def close(self) -> None:
        """
        Calling this is not required and is mostly for usage in tests
        """
        pass
