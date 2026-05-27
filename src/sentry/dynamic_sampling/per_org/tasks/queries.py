from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterator, Mapping
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from typing import Any, Literal

from sentry_protos.snuba.v1.trace_item_attribute_pb2 import ExtrapolationMode

from sentry.dynamic_sampling.per_org.tasks.configuration import BaseDynamicSamplingConfiguration
from sentry.dynamic_sampling.rules.utils import ProjectId
from sentry.dynamic_sampling.tasks.boost_low_volume_transactions import ProjectTransactions
from sentry.dynamic_sampling.tasks.common import (
    ACTIVE_ORGS_VOLUMES_DEFAULT_TIME_INTERVAL,
    OrganizationDataVolume,
)
from sentry.search.eap.constants import SAMPLING_MODE_HIGHEST_ACCURACY
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans


class DynamicSamplingQueryFilters(StrEnum):
    IS_SEGMENT = "sentry.is_segment:true"


class DynamicSamplingQueryFields(StrEnum):
    DSC_PROJECT_ID = "sentry.dsc.project_id"
    DSC_TRANSACTION = "sentry.dsc.transaction"
    COUNT = "count()"
    COUNT_SAMPLE = "count_sample()"


@dataclass(order=True)
class ProjectVolume:
    project_id: ProjectId
    total: int
    keep: int
    drop: int


@dataclass
class ProjectTransactionVolumesAccumulator:
    transaction_counts: list[tuple[str, float]] = field(default_factory=list)
    total_num_transactions: float = 0
    num_classes: int = 0


def _get_aggregate_int(row: Mapping[str, Any], column: str) -> int:
    return int(row.get(column, 0))


def _get_aggregate_float(row: Mapping[str, Any], column: str) -> float:
    return float(row.get(column, 0))


def run_eap_spans_table_query_in_chunks(
    query: dict[str, Any],
    max_results: int | None = None,
    chunk_size: int = 1000,
) -> Iterator[dict[str, Any]]:
    offset = 0
    current_chunk_size = chunk_size

    while True:
        if max_results is not None:
            current_chunk_size = min(chunk_size, max_results - offset)

        result = Spans.run_table_query(**query, offset=offset, limit=current_chunk_size + 1)
        data = result.get("data", [])
        more_results = len(data) > current_chunk_size

        if more_results:
            data = data[:current_chunk_size]

        if data:
            yield from data
            offset += len(data)

        # either we run out of results or we hit the max results limit, in both cases we should stop
        if not more_results or (max_results is not None and offset >= max_results):
            return


def get_eap_organization_volume(
    config: BaseDynamicSamplingConfiguration,
    time_interval: timedelta = ACTIVE_ORGS_VOLUMES_DEFAULT_TIME_INTERVAL,
) -> OrganizationDataVolume | None:
    end_time = datetime.now(UTC)
    start_time = end_time - time_interval
    result = Spans.run_table_query(
        params=SnubaParams(
            start=start_time,
            end=end_time,
            projects=config.projects,
            organization=config.organization,
        ),
        query_string=DynamicSamplingQueryFilters.IS_SEGMENT,
        selected_columns=[
            DynamicSamplingQueryFields.COUNT,
            DynamicSamplingQueryFields.COUNT_SAMPLE,
        ],
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
    total = _get_aggregate_int(row, DynamicSamplingQueryFields.COUNT)
    if total <= 0:
        return None
    indexed = _get_aggregate_int(row, DynamicSamplingQueryFields.COUNT_SAMPLE)

    return OrganizationDataVolume(org_id=config.organization.id, total=total, indexed=indexed)


def get_eap_project_volumes(
    config: BaseDynamicSamplingConfiguration,
    time_interval: timedelta = timedelta(hours=1),
) -> list[ProjectVolume]:
    end_time = datetime.now(UTC)
    start_time = end_time - time_interval
    project_volumes: list[ProjectVolume] = []

    for row in run_eap_spans_table_query_in_chunks(
        {
            "params": SnubaParams(
                start=start_time,
                end=end_time,
                projects=config.projects,
                organization=config.organization,
            ),
            "query_string": DynamicSamplingQueryFilters.IS_SEGMENT,
            "selected_columns": [
                DynamicSamplingQueryFields.DSC_PROJECT_ID,
                DynamicSamplingQueryFields.COUNT,
                DynamicSamplingQueryFields.COUNT_SAMPLE,
            ],
            "orderby": [DynamicSamplingQueryFields.DSC_PROJECT_ID],
            "referrer": Referrer.DYNAMIC_SAMPLING_PER_ORG_GET_EAP_PROJECT_VOLUMES.value,
            "config": SearchResolverConfig(
                auto_fields=True,
                extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_SERVER_ONLY,
            ),
            "sampling_mode": SAMPLING_MODE_HIGHEST_ACCURACY,
        }
    ):
        total = _get_aggregate_int(row, DynamicSamplingQueryFields.COUNT)
        keep = _get_aggregate_int(row, DynamicSamplingQueryFields.COUNT_SAMPLE)
        dsc_project_id = row.get(DynamicSamplingQueryFields.DSC_PROJECT_ID)
        if dsc_project_id is None:
            continue

        project_volumes.append(
            ProjectVolume(
                project_id=ProjectId(int(dsc_project_id)),
                total=total,
                keep=keep,
                drop=max(total - keep, 0),
            )
        )

    return project_volumes


def get_eap_transaction_volumes(
    config: BaseDynamicSamplingConfiguration,
    time_interval: timedelta = ACTIVE_ORGS_VOLUMES_DEFAULT_TIME_INTERVAL,
    order_by_volume: Literal["asc", "desc"] = "asc",
    max_transactions: int = 100,
) -> list[ProjectTransactions]:
    end_time = datetime.now(UTC)
    start_time = end_time - time_interval
    volumes_by_project: defaultdict[int, ProjectTransactionVolumesAccumulator] = defaultdict(
        ProjectTransactionVolumesAccumulator
    )

    orderby: list[str] = [
        DynamicSamplingQueryFields.DSC_PROJECT_ID,
        DynamicSamplingQueryFields.DSC_TRANSACTION,
    ]
    if order_by_volume == "asc":
        orderby = [
            DynamicSamplingQueryFields.COUNT,
            DynamicSamplingQueryFields.DSC_PROJECT_ID,
            DynamicSamplingQueryFields.DSC_TRANSACTION,
        ]
    else:
        orderby = [
            f"-{DynamicSamplingQueryFields.COUNT}",
            DynamicSamplingQueryFields.DSC_PROJECT_ID,
            DynamicSamplingQueryFields.DSC_TRANSACTION,
        ]

    root_project_filter = ",".join(str(project.id) for project in config.projects)
    result = Spans.run_table_query(
        params=SnubaParams(
            start=start_time,
            end=end_time,
            projects=config.projects,
            organization=config.organization,
        ),
        query_string=f"{DynamicSamplingQueryFilters.IS_SEGMENT} {DynamicSamplingQueryFields.DSC_PROJECT_ID}:[{root_project_filter}]",
        selected_columns=[
            DynamicSamplingQueryFields.DSC_PROJECT_ID,
            DynamicSamplingQueryFields.DSC_TRANSACTION,
            DynamicSamplingQueryFields.COUNT,
        ],
        orderby=orderby,
        offset=0,
        limit=max_transactions,
        referrer=Referrer.DYNAMIC_SAMPLING_PER_ORG_GET_EAP_TRANSACTION_VOLUMES.value,
        config=SearchResolverConfig(
            auto_fields=True,
            extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_SERVER_ONLY,
        ),
        sampling_mode=SAMPLING_MODE_HIGHEST_ACCURACY,
    )

    for row in result.get("data", []):
        if (transaction := row.get(DynamicSamplingQueryFields.DSC_TRANSACTION)) is None:
            continue

        total = _get_aggregate_float(row, DynamicSamplingQueryFields.COUNT)
        if total <= 0:
            continue

        project_id = _get_aggregate_int(row, DynamicSamplingQueryFields.DSC_PROJECT_ID)
        project_volumes = volumes_by_project[project_id]

        project_volumes.transaction_counts.append((str(transaction), total))
        project_volumes.total_num_transactions += total
        project_volumes.num_classes += 1

    return [
        {
            "org_id": config.organization.id,
            "project_id": project_id,
            "transaction_counts": project_volumes.transaction_counts,
            "total_num_transactions": project_volumes.total_num_transactions,
            "total_num_classes": project_volumes.num_classes,
        }
        for project_id, project_volumes in sorted(volumes_by_project.items())
    ]
