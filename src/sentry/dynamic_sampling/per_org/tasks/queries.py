from __future__ import annotations

from collections.abc import Iterator, Mapping
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from sentry_protos.snuba.v1.trace_item_attribute_pb2 import ExtrapolationMode

from sentry.constants import ObjectStatus
from sentry.dynamic_sampling.per_org.tasks.configuration import BaseDynamicSamplingConfiguration
from sentry.dynamic_sampling.rules.utils import ProjectId
from sentry.dynamic_sampling.tasks.common import (
    ACTIVE_ORGS_VOLUMES_DEFAULT_TIME_INTERVAL,
    OrganizationDataVolume,
)
from sentry.dynamic_sampling.types import SamplingMeasure
from sentry.models.project import Project
from sentry.search.eap.constants import SAMPLING_MODE_HIGHEST_ACCURACY
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans


@dataclass(order=True)
class ProjectVolume:
    project_id: ProjectId
    total: int
    keep: int
    drop: int


EAP_ORGANIZATION_VOLUME_QUERY_STRINGS = {
    SamplingMeasure.SEGMENTS: "is_transaction:true",
    SamplingMeasure.SPANS: "",
}


def _get_aggregate_int(row: Mapping[str, Any], column: str) -> int:
    value = row.get(column)
    return int(value) if value is not None else 0


def run_eap_spans_table_query_in_chunks(
    query: dict[str, Any],
    chunk_size: int = 1000,
) -> Iterator[list[dict[str, Any]]]:
    offset = 0

    while True:
        result = Spans.run_table_query(**query, offset=offset, limit=chunk_size + 1)
        data = result.get("data", [])
        more_results = len(data) > chunk_size

        if more_results:
            data = data[:chunk_size]

        if data:
            yield data

        if not more_results:
            return

        offset += chunk_size


def get_eap_organization_volume(
    config: BaseDynamicSamplingConfiguration,
    time_interval: timedelta = ACTIVE_ORGS_VOLUMES_DEFAULT_TIME_INTERVAL,
) -> OrganizationDataVolume | None:
    organization = config.organization
    projects = list(
        Project.objects.filter(organization_id=organization.id, status=ObjectStatus.ACTIVE)
    )
    if not projects:
        return None

    end_time = datetime.now(UTC)
    start_time = end_time - time_interval
    result = Spans.run_table_query(
        params=SnubaParams(
            start=start_time,
            end=end_time,
            projects=projects,
            organization=organization,
        ),
        query_string=EAP_ORGANIZATION_VOLUME_QUERY_STRINGS[config.measure],
        selected_columns=["count()", "count_sample()"],
        orderby=None,
        offset=0,
        limit=1,
        referrer=Referrer.DYNAMIC_SAMPLING_PER_ORG_GET_EAP_ORG_VOLUME.value,
        config=SearchResolverConfig(
            auto_fields=True,
            extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_SERVER_ONLY,
        ),
        sampling_mode=SAMPLING_MODE_HIGHEST_ACCURACY,
    )

    data = result.get("data")
    if not data:
        return None

    row = data[0]
    total = _get_aggregate_int(row, "count()")
    if total <= 0:
        return None
    indexed = _get_aggregate_int(row, "count_sample()")

    return OrganizationDataVolume(org_id=organization.id, total=total, indexed=indexed)


def get_eap_project_volumes(
    config: BaseDynamicSamplingConfiguration,
    time_interval: timedelta = timedelta(hours=1),
) -> list[ProjectVolume]:
    organization = config.organization
    projects = list(
        Project.objects.filter(organization_id=organization.id, status=ObjectStatus.ACTIVE)
    )
    if not projects:
        return []

    end_time = datetime.now(UTC)
    start_time = end_time - time_interval
    project_volumes: list[ProjectVolume] = []

    for data in run_eap_spans_table_query_in_chunks(
        {
            "params": SnubaParams(
                start=start_time,
                end=end_time,
                projects=projects,
                organization=organization,
            ),
            "query_string": EAP_ORGANIZATION_VOLUME_QUERY_STRINGS[config.measure],
            "selected_columns": ["project.id", "count()", "count_sample()"],
            "orderby": ["project.id"],
            "referrer": Referrer.DYNAMIC_SAMPLING_PER_ORG_GET_EAP_PROJECT_VOLUMES.value,
            "config": SearchResolverConfig(
                auto_fields=True,
                extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_SERVER_ONLY,
            ),
            "sampling_mode": SAMPLING_MODE_HIGHEST_ACCURACY,
        }
    ):
        for row in data:
            total = _get_aggregate_int(row, "count()")
            keep = _get_aggregate_int(row, "count_sample()")
            project_volumes.append(
                ProjectVolume(
                    project_id=ProjectId(int(row["project.id"])),
                    total=total,
                    keep=keep,
                    drop=max(total - keep, 0),
                )
            )

    return project_volumes
