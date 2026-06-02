from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterator, Mapping
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from typing import Any, Literal, Protocol

from sentry_protos.snuba.v1.trace_item_attribute_pb2 import ExtrapolationMode

from sentry.dynamic_sampling.rules.utils import ProjectId
from sentry.dynamic_sampling.tasks.boost_low_volume_transactions import ProjectTransactions
from sentry.dynamic_sampling.tasks.common import (
    ACTIVE_ORGS_VOLUMES_DEFAULT_TIME_INTERVAL,
    OrganizationDataVolume,
)
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.search.eap.constants import SAMPLING_MODE_HIGHEST_ACCURACY
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans


class OrganizationVolumeConfig(Protocol):
    organization: Organization
    projects: list[Project]


class DynamicSamplingQueryFilters(StrEnum):
    IS_SEGMENT = "sentry.is_segment:true"


class DynamicSamplingQueryFields(StrEnum):
    DSC_PROJECT_ID = "sentry.dsc.project_id"
    DSC_TRANSACTION = "sentry.dsc.transaction"
    COUNT = "count()"
    COUNT_SAMPLE = "count_sample()"
    COUNT_UNIQUE_TRANSACTIONS = "count_unique(sentry.dsc.transaction)"


@dataclass(order=True)
class ProjectVolume:
    project_id: ProjectId
    total: int
    keep: int
    drop: int
    # Number of distinct transaction names seen in the project over the window.
    # Counts the *whole* project, including names that fall outside the
    # max_transactions limit of get_eap_transaction_volumes — required for the
    # transaction rebalancing model to size the implicit (long-tail) bucket.
    num_distinct_transactions: int = 0


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
    config: OrganizationVolumeConfig,
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
    config: OrganizationVolumeConfig,
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
                DynamicSamplingQueryFields.COUNT_UNIQUE_TRANSACTIONS,
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
        num_distinct_transactions = _get_aggregate_int(
            row, DynamicSamplingQueryFields.COUNT_UNIQUE_TRANSACTIONS
        )
        dsc_project_id = row.get(DynamicSamplingQueryFields.DSC_PROJECT_ID)
        if dsc_project_id is None:
            continue

        project_volumes.append(
            ProjectVolume(
                project_id=ProjectId(int(dsc_project_id)),
                total=total,
                keep=keep,
                drop=max(total - keep, 0),
                num_distinct_transactions=num_distinct_transactions,
            )
        )

    return project_volumes


def get_eap_transaction_volumes(
    config: OrganizationVolumeConfig,
    time_interval: timedelta = timedelta(hours=1),
    order_by_volume: Literal["asc", "desc"] = "asc",
    max_transactions: int = 100,
    project_volumes: list[ProjectVolume] | None = None,
) -> list[ProjectTransactions]:
    end_time = datetime.now(UTC)
    start_time = end_time - time_interval
    volumes_by_project: defaultdict[int, ProjectTransactionVolumesAccumulator] = defaultdict(
        ProjectTransactionVolumesAccumulator
    )

    count_order = (
        DynamicSamplingQueryFields.COUNT
        if order_by_volume == "asc"
        else f"-{DynamicSamplingQueryFields.COUNT}"
    )
    orderby = [
        count_order,
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
        query_string=f"{DynamicSamplingQueryFilters.IS_SEGMENT} {DynamicSamplingQueryFields.DSC_PROJECT_ID}:[{root_project_filter}] has:{DynamicSamplingQueryFields.DSC_TRANSACTION}",
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
        transaction = row.get(DynamicSamplingQueryFields.DSC_TRANSACTION)
        total = _get_aggregate_float(row, DynamicSamplingQueryFields.COUNT)
        if total <= 0:
            continue

        project_id = _get_aggregate_int(row, DynamicSamplingQueryFields.DSC_PROJECT_ID)
        accumulator = volumes_by_project[project_id]

        accumulator.transaction_counts.append((str(transaction), total))
        accumulator.total_num_transactions += total
        accumulator.num_classes += 1

    # When project_volumes is supplied, prefer its full-project totals over the
    # sum-of-listed accumulated above. The transaction-balancing model needs
    # the full implicit-pool volume and class count to size the long-tail budget.
    project_totals_by_id = {pv.project_id: pv for pv in (project_volumes or [])}
    return [
        {
            "org_id": config.organization.id,
            "project_id": project_id,
            "transaction_counts": accumulator.transaction_counts,
            "total_num_transactions": (
                project_totals_by_id[project_id].total
                if project_id in project_totals_by_id
                else accumulator.total_num_transactions
            ),
            "total_num_classes": (
                project_totals_by_id[project_id].num_distinct_transactions
                if project_id in project_totals_by_id
                else accumulator.num_classes
            ),
        }
        for project_id, accumulator in sorted(volumes_by_project.items())
    ]
