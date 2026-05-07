from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterator, Mapping
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any

from sentry_protos.snuba.v1.trace_item_attribute_pb2 import ExtrapolationMode

from sentry.constants import ObjectStatus
from sentry.dynamic_sampling.per_org.tasks.configuration import BaseDynamicSamplingConfiguration
from sentry.dynamic_sampling.tasks.common import (
    ACTIVE_ORGS_VOLUMES_DEFAULT_TIME_INTERVAL,
    OrganizationDataVolume,
)
from sentry.dynamic_sampling.tasks.constants import CHUNK_SIZE
from sentry.models.project import Project
from sentry.search.eap.constants import SAMPLING_MODE_HIGHEST_ACCURACY
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans


@dataclass(frozen=True)
class EAPProjectTransactionVolumes:
    org_id: int
    project_id: int
    transaction_counts: list[tuple[str, float]]
    total_num_transactions: float
    total_num_classes: int
    indexed: int


@dataclass
class _EAPProjectTransactionVolumesAccumulator:
    transaction_counts: list[tuple[str, float]] = field(default_factory=list)
    total_num_transactions: float = 0
    indexed: int = 0


def _get_aggregate_int(row: Mapping[str, Any], column: str) -> int:
    return int(row.get(column, 0))


def _get_aggregate_float(row: Mapping[str, Any], column: str) -> float:
    return float(row.get(column, 0))


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
    projects = list(
        Project.objects.filter(organization_id=config.organization.id, status=ObjectStatus.ACTIVE)
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
            organization=config.organization,
        ),
        query_string="is_transaction:true",
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

    return OrganizationDataVolume(org_id=config.organization.id, total=total, indexed=indexed)


def get_eap_transaction_volumes(
    config: BaseDynamicSamplingConfiguration,
    time_interval: timedelta = ACTIVE_ORGS_VOLUMES_DEFAULT_TIME_INTERVAL,
) -> list[EAPProjectTransactionVolumes]:
    projects = list(
        Project.objects.filter(organization_id=config.organization.id, status=ObjectStatus.ACTIVE)
    )
    if not projects:
        return []

    end_time = datetime.now(UTC)
    start_time = end_time - time_interval
    volumes_by_project: defaultdict[int, _EAPProjectTransactionVolumesAccumulator] = defaultdict(
        _EAPProjectTransactionVolumesAccumulator
    )

    batch_iterator = run_eap_spans_table_query_in_chunks(
        {
            "params": SnubaParams(
                start=start_time,
                end=end_time,
                projects=projects,
                organization=config.organization,
            ),
            "query_string": "is_transaction:true",
            "selected_columns": ["project_id", "transaction", "count()", "count_sample()"],
            "orderby": ["project_id", "transaction"],
            "referrer": Referrer.DYNAMIC_SAMPLING_PER_ORG_GET_EAP_TRANSACTION_VOLUMES.value,
            "config": SearchResolverConfig(
                auto_fields=True,
                extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_SERVER_ONLY,
            ),
            "sampling_mode": SAMPLING_MODE_HIGHEST_ACCURACY,
        },
        CHUNK_SIZE,
    )

    for batch in batch_iterator:
        for row in batch:
            transaction = row.get("transaction")
            if transaction is None:
                continue

            total = _get_aggregate_float(row, "count()")
            if total <= 0:
                continue

            project_id = _get_aggregate_int(row, "project_id")
            project_volumes = volumes_by_project[project_id]
            project_volumes.transaction_counts.append((str(transaction), total))
            project_volumes.total_num_transactions += total
            project_volumes.indexed += _get_aggregate_int(row, "count_sample()")

    return [
        EAPProjectTransactionVolumes(
            org_id=config.organization.id,
            project_id=project_id,
            transaction_counts=project_volumes.transaction_counts,
            total_num_transactions=project_volumes.total_num_transactions,
            total_num_classes=len(project_volumes.transaction_counts),
            indexed=project_volumes.indexed,
        )
        for project_id, project_volumes in sorted(volumes_by_project.items())
    ]
