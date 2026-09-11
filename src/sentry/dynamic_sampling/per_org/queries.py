from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterator, Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from typing import Any, Protocol

from sentry_protos.snuba.v1.trace_item_attribute_pb2 import ExtrapolationMode

from sentry import options
from sentry.dynamic_sampling.rules.utils import ProjectId
from sentry.dynamic_sampling.tasks.common import (
    ACTIVE_ORGS_VOLUMES_DEFAULT_TIME_INTERVAL,
    OrganizationDataVolume,
)
from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.search.eap.constants import SAMPLING_MODE_HIGHEST_ACCURACY
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.snuba.outcomes import QueryDefinition, run_outcomes_query_totals
from sentry.snuba.referrer import Referrer
from sentry.snuba.rpc_dataset_common import LimitBy
from sentry.snuba.spans_rpc import Spans

# The window recalibration measures an organization over.
RECALIBRATION_TIME_INTERVAL = ACTIVE_ORGS_VOLUMES_DEFAULT_TIME_INTERVAL


class OrganizationVolumeConfig(Protocol):
    organization: Organization
    projects: list[Project]


class DynamicSamplingQueryFilters(StrEnum):
    IS_SEGMENT = "sentry.is_segment:true"


class DynamicSamplingQueryFields(StrEnum):
    DSC_PROJECT_ID = "sentry.dsc.project_id"
    PROJECT_ID = "project.id"
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


@dataclass(order=True)
class RootProjectSpanCount:
    """Spans received by ``project_id`` from traces that started in ``root_project_id``."""

    root_project_id: int
    project_id: int
    count: float


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
    organization: Organization,
    projects: list[Project],
    time_interval: timedelta = ACTIVE_ORGS_VOLUMES_DEFAULT_TIME_INTERVAL,
    end: datetime | None = None,
) -> OrganizationDataVolume | None:
    end_time = end or datetime.now(UTC)
    start_time = end_time - time_interval
    result = Spans.run_table_query(
        params=SnubaParams(
            start=start_time,
            end=end_time,
            projects=projects,
            organization=organization,
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

    return OrganizationDataVolume(org_id=organization.id, total=total, indexed=indexed)


def get_outcomes_organization_volume(
    config: OrganizationVolumeConfig,
    time_interval: timedelta = ACTIVE_ORGS_VOLUMES_DEFAULT_TIME_INTERVAL,
    end: datetime | None = None,
) -> OrganizationDataVolume | None:
    end_time = end or datetime.now(UTC)

    # The outcomes query widens its window outwards to whole intervals. Minute resolution
    # keeps a short window from covering a whole hour, but it cannot be used throughout: it is
    # capped at MAX_POINTS intervals, which a 24-hour window is rejected for. The end is
    # truncated to the resolution so that nothing is widened and the window covers the
    # interval that was asked for, rather than up to one resolution step more.
    if time_interval >= timedelta(hours=1):
        interval = "1h"
        end_time = end_time.replace(minute=0, second=0, microsecond=0)
    else:
        interval = "1m"
        end_time = end_time.replace(second=0, microsecond=0)
    start_time = end_time - time_interval

    query = QueryDefinition(
        fields=["sum(quantity)"],
        start=start_time.isoformat(),
        end=end_time.isoformat(),
        interval=interval,
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


def get_eap_span_counts_by_root_project(
    organization: Organization,
    projects: Sequence[Project],
    start: datetime,
    end: datetime,
    environments: Sequence[Environment] = (),
) -> list[RootProjectSpanCount]:
    """Received span counts of every (root project, owning project) pair in the window.

    Spans of every kind count, not only segments. A span without a DSC project id
    belongs to a trace that carried no sampling context, so its own project stands in
    as the root project.
    """
    counts: defaultdict[tuple[int, int], float] = defaultdict(float)

    for row in run_eap_spans_table_query_in_chunks(
        {
            "params": SnubaParams(
                start=start,
                end=end,
                projects=list(projects),
                environments=list(environments),
                organization=organization,
            ),
            "query_string": "",
            "selected_columns": [
                DynamicSamplingQueryFields.DSC_PROJECT_ID,
                DynamicSamplingQueryFields.PROJECT_ID,
                DynamicSamplingQueryFields.COUNT,
            ],
            "orderby": [
                DynamicSamplingQueryFields.DSC_PROJECT_ID,
                DynamicSamplingQueryFields.PROJECT_ID,
            ],
            "referrer": Referrer.DYNAMIC_SAMPLING_SETTINGS_GET_SPAN_COUNTS.value,
            "config": SearchResolverConfig(
                auto_fields=True,
                extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_SERVER_ONLY,
            ),
            "sampling_mode": SAMPLING_MODE_HIGHEST_ACCURACY,
        }
    ):
        count = _get_aggregate_float(row, DynamicSamplingQueryFields.COUNT)
        if count <= 0:
            continue

        project_id = _get_aggregate_int(row, DynamicSamplingQueryFields.PROJECT_ID)
        dsc_project_id = row.get(DynamicSamplingQueryFields.DSC_PROJECT_ID)
        root_project_id = project_id if dsc_project_id is None else int(dsc_project_id)
        counts[(root_project_id, project_id)] += count

    return [
        RootProjectSpanCount(root_project_id=root_project_id, project_id=project_id, count=count)
        for (root_project_id, project_id), count in sorted(counts.items())
    ]


def get_eap_transaction_volumes(
    config: OrganizationVolumeConfig,
    time_interval: timedelta = timedelta(hours=1),
    max_transactions_per_project: int | None = None,
    root_projects: Sequence[Project] | None = None,
) -> list[ProjectTransactionCounts]:
    """
    Fetch the highest-volume transactions of every root project in a single
    LIMIT BY query, mirroring the legacy pipeline's per-project top-N
    (``LIMIT BY (org_id, project_id)`` in boost_low_volume_transactions) so the
    transaction rebalancing model sees the same explicit transaction set.
    """
    # Spans rooted in one project can be owned by any project in the org, so the query
    # scope stays config.projects; root_projects only narrows which root projects
    # (dsc.project_id) are counted.
    if root_projects is None:
        root_projects = config.projects
    if not root_projects:
        return []

    if max_transactions_per_project is None:
        # Shared with the legacy pipeline so both select the same explicit transaction
        # set per project. The companion small-transactions option is 0 in production,
        # so only the largest transactions are fetched.
        max_transactions_per_project = int(
            options.get("dynamic-sampling.prioritise_transactions.num_explicit_large_transactions")
        )
    if max_transactions_per_project <= 0:
        return []

    end_time = datetime.now(UTC)
    start_time = end_time - time_interval
    transaction_counts_by_project: defaultdict[int, defaultdict[str, float]] = defaultdict(
        lambda: defaultdict(float)
    )

    orderby = [
        DynamicSamplingQueryFields.DSC_PROJECT_ID,
        f"-{DynamicSamplingQueryFields.COUNT}",
        DynamicSamplingQueryFields.DSC_TRANSACTION,
    ]

    root_project_filter = ",".join(str(project.id) for project in root_projects)
    for row in run_eap_spans_table_query_in_chunks(
        {
            "params": SnubaParams(
                start=start_time,
                end=end_time,
                projects=config.projects,
                organization=config.organization,
            ),
            "query_string": f"{DynamicSamplingQueryFilters.IS_SEGMENT} {DynamicSamplingQueryFields.DSC_PROJECT_ID}:[{root_project_filter}]",
            "selected_columns": [
                DynamicSamplingQueryFields.DSC_PROJECT_ID,
                DynamicSamplingQueryFields.DSC_TRANSACTION,
                DynamicSamplingQueryFields.COUNT,
            ],
            "orderby": orderby,
            "limit_by": LimitBy(
                columns=[DynamicSamplingQueryFields.DSC_PROJECT_ID],
                limit=max_transactions_per_project,
            ),
            "referrer": Referrer.DYNAMIC_SAMPLING_PER_ORG_GET_EAP_TRANSACTION_VOLUMES.value,
            "config": SearchResolverConfig(
                auto_fields=True,
                extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_SERVER_ONLY,
            ),
            "sampling_mode": SAMPLING_MODE_HIGHEST_ACCURACY,
        }
    ):
        total = _get_aggregate_float(row, DynamicSamplingQueryFields.COUNT)
        if total <= 0:
            continue

        # A root span with no transaction name and one named "" are the same unnamed
        # transaction, but EAP returns them as separate groups. Coalescing to "" keeps
        # them a single class in the rebalancing model instead of two, one of which
        # would carry the misleading name "None".
        transaction = row.get(DynamicSamplingQueryFields.DSC_TRANSACTION) or ""

        project_id = _get_aggregate_int(row, DynamicSamplingQueryFields.DSC_PROJECT_ID)
        transaction_counts_by_project[project_id][transaction] += total

    return [
        ProjectTransactionCounts(
            project_id=project_id,
            org_id=config.organization.id,
            transaction_counts=sorted(
                transaction_counts.items(), key=lambda item: (-item[1], item[0])
            ),
        )
        for project_id, transaction_counts in sorted(transaction_counts_by_project.items())
    ]
