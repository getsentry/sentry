from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterator, Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from typing import Any, Literal, Protocol

from sentry_protos.snuba.v1.trace_item_attribute_pb2 import ExtrapolationMode

from sentry.dynamic_sampling.rules.utils import ProjectId
from sentry.dynamic_sampling.tasks.common import (
    ACTIVE_ORGS_VOLUMES_DEFAULT_TIME_INTERVAL,
    MEASURE_CONFIGS,
    OrganizationDataVolume,
)
from sentry.dynamic_sampling.types import SamplingMeasure
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.search.eap.constants import SAMPLING_MODE_HIGHEST_ACCURACY
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.sentry_metrics import indexer
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.outcomes import QueryDefinition, run_outcomes_query_totals
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans
from sentry.utils.snuba import raw_snql_query


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
    MAX_RECEIVED = "max(received)"


@dataclass(order=True)
class ProjectVolume:
    project_id: ProjectId
    total: int
    keep: int
    drop: int
    num_distinct_transactions: int = 0
    seconds_since_last_item: float | None = None


@dataclass(order=True)
class ProjectTransactionCounts:
    project_id: int
    org_id: int
    transaction_counts: list[tuple[str, float]]


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
    end: datetime | None = None,
) -> OrganizationDataVolume | None:
    end_time = end or datetime.now(UTC)
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


def get_outcomes_organization_volume(
    config: OrganizationVolumeConfig,
    time_interval: timedelta = ACTIVE_ORGS_VOLUMES_DEFAULT_TIME_INTERVAL,
    end: datetime | None = None,
) -> OrganizationDataVolume | None:
    end_time = end or datetime.now(UTC)
    start_time = end_time - time_interval

    query = QueryDefinition(
        fields=["sum(quantity)"],
        start=start_time.isoformat(),
        end=end_time.isoformat(),
        organization_id=config.organization.id,
        project_ids=[project.id for project in config.projects],
        outcome=["accepted"],
        category=["transaction"],
    )
    rows = run_outcomes_query_totals(query, tenant_ids={"organization_id": config.organization.id})
    if not rows:
        return None

    total = _get_aggregate_int(rows[0], "quantity")
    if total <= 0:
        return None

    return OrganizationDataVolume(org_id=config.organization.id, total=total, indexed=None)


def get_generic_metrics_organization_volume(
    org_id: int,
    time_interval: timedelta = ACTIVE_ORGS_VOLUMES_DEFAULT_TIME_INTERVAL,
    end: datetime | None = None,
) -> OrganizationDataVolume | None:
    from snuba_sdk import Column, Condition, Entity, Function, Granularity, Op, Query, Request

    end_time = end or datetime.now(UTC)
    start_time = end_time - time_interval

    config = MEASURE_CONFIGS[SamplingMeasure.SEGMENTS]
    metric_id = indexer.resolve_shared_org(str(config["mri"]))

    where: list[Condition] = [
        Condition(Column("timestamp"), Op.GTE, start_time),
        Condition(Column("timestamp"), Op.LT, end_time),
        Condition(Column("metric_id"), Op.EQ, metric_id),
        Condition(Column("org_id"), Op.IN, [org_id]),
    ]
    for tag_name, tag_value in config["tags"].items():
        tag_string_id = indexer.resolve_shared_org(tag_name)
        tag_column = f"tags_raw[{tag_string_id}]"
        where.append(Condition(Column(tag_column), Op.EQ, tag_value))

    query = Query(
        match=Entity(EntityKey.GenericOrgMetricsCounters.value),
        select=[
            Function("sum", [Column("value")], "total_count"),
            Column("org_id"),
        ],
        groupby=[Column("org_id")],
        where=where,
        granularity=Granularity(60),
    )
    request = Request(
        dataset=Dataset.PerformanceMetrics.value,
        app_id="dynamic_sampling",
        query=query,
        tenant_ids={
            "use_case_id": config["use_case_id"].value,
            "cross_org_query": 1,
        },
    )
    data = raw_snql_query(
        request,
        referrer=Referrer.DYNAMIC_SAMPLING_COUNTERS_GET_ORG_TRANSACTION_VOLUMES.value,
    )["data"]

    if not data:
        return None

    total = int(data[0]["total_count"])
    if total <= 0:
        return None

    return OrganizationDataVolume(org_id=org_id, total=total, indexed=None)


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
                DynamicSamplingQueryFields.MAX_RECEIVED,
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

        received = row.get(DynamicSamplingQueryFields.MAX_RECEIVED)
        seconds_since_last_item = end_time.timestamp() - float(received) if received else None

        project_volumes.append(
            ProjectVolume(
                project_id=ProjectId(int(dsc_project_id)),
                total=total,
                keep=keep,
                drop=max(total - keep, 0),
                num_distinct_transactions=num_distinct_transactions,
                seconds_since_last_item=seconds_since_last_item,
            )
        )

    return project_volumes


def get_eap_transaction_volumes(
    config: OrganizationVolumeConfig,
    time_interval: timedelta = timedelta(hours=1),
    order_by_volume: Literal["asc", "desc"] = "asc",
    max_transactions: int = 100,
    root_projects: Sequence[Project] | None = None,
) -> list[ProjectTransactionCounts]:
    # Spans rooted in one project can be owned by any project in the org, so the query
    # scope stays config.projects; root_projects only narrows which root projects
    # (dsc.project_id) are counted.
    if root_projects is None:
        root_projects = config.projects

    end_time = datetime.now(UTC)
    start_time = end_time - time_interval
    transaction_counts_by_project: defaultdict[int, list[tuple[str, float]]] = defaultdict(list)

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

    root_project_filter = ",".join(str(project.id) for project in root_projects)
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
        transaction_counts = transaction_counts_by_project[project_id]
        transaction_counts.append((str(transaction), total))

    return [
        ProjectTransactionCounts(
            project_id=project_id,
            org_id=config.organization.id,
            transaction_counts=transaction_counts,
        )
        for project_id, transaction_counts in sorted(transaction_counts_by_project.items())
    ]
