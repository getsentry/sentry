from __future__ import annotations

import dataclasses
import logging
from datetime import datetime

from snuba_sdk import (
    Column,
    Condition,
    Entity,
    Function,
    Granularity,
    Limit,
    Op,
    Query,
    Request,
)

from sentry.constants import DataCategory
from sentry.models.project import Project
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans
from sentry.utils.outcomes import Outcome
from sentry.utils.snuba import raw_snql_query

logger = logging.getLogger(__name__)


@dataclasses.dataclass
class ProjectEventCounts:
    error_count: int = 0
    transaction_count: int = 0

    def total(self) -> int:
        return self.error_count + self.transaction_count


TOP_TRANSACTIONS_LIMIT = 10
TOP_SPAN_OPS_LIMIT = 15
MAX_BATCH_QUERY_LIMIT = 1000
EVENT_COUNT_LOOKBACK_DAYS = 7
HIGH_VOLUME_THRESHOLD = 1000


def get_instrumentation_types(project: Project) -> list[str]:
    """Derive instrumentation type labels from the project flags bitfield."""
    instrumentation = []
    flags = project.flags
    if flags.has_transactions:
        instrumentation.append("transactions")
    if flags.has_profiles:
        instrumentation.append("profiles")
    if flags.has_replays:
        instrumentation.append("replays")
    if flags.has_sessions:
        instrumentation.append("sessions")
    return instrumentation


def get_top_span_ops_for_org_projects(
    projects: list[Project],
    start: datetime,
    end: datetime,
) -> dict[int, list[tuple[str, str]]]:
    """Query EAP for top (span.category, sentry.normalized_description) pairs per project."""
    if not projects:
        return {}

    organization = projects[0].organization
    snuba_params = SnubaParams(
        start=start,
        end=end,
        projects=projects,
        organization=organization,
    )
    config = SearchResolverConfig(auto_fields=True)

    try:
        result = Spans.run_table_query(
            params=snuba_params,
            query_string="",
            selected_columns=[
                "project.id",
                "span.category",
                "sentry.normalized_description",
                "sum(span.self_time)",
            ],
            orderby=["-sum(span.self_time)"],
            offset=0,
            limit=MAX_BATCH_QUERY_LIMIT,  # hard cap to avoid overloading Snuba; increase if needed
            referrer=Referrer.SEER_EXPLORER_INDEX,
            config=config,
            sampling_mode="NORMAL",
        )
    except Exception:
        logger.exception(
            "Failed to fetch top span ops for org projects",
            extra={"org_id": organization.id},
        )
        return {}

    ops_by_project: dict[int, list[tuple[str, str]]] = {}
    for row in result.get("data", []):
        project_id = row.get("project.id")
        category = row.get("span.category") or ""
        description = row.get("sentry.normalized_description") or ""
        if project_id is not None and (category or description):
            ops_by_project.setdefault(project_id, [])
            if len(ops_by_project[project_id]) < TOP_SPAN_OPS_LIMIT:
                ops_by_project[project_id].append((category, description))

    return ops_by_project


def get_top_transactions_for_org_projects(
    projects: list[Project],
    start: datetime,
    end: datetime,
) -> dict[int, list[str]]:
    """Query EAP for top transactions per project, returning {project_id: [transaction_name, ...]}."""
    if not projects:
        return {}

    organization = projects[0].organization
    snuba_params = SnubaParams(
        start=start,
        end=end,
        projects=projects,
        organization=organization,
    )
    config = SearchResolverConfig(auto_fields=True)

    try:
        result = Spans.run_table_query(
            params=snuba_params,
            query_string="is_transaction:true",
            selected_columns=[
                "project.id",
                "transaction",
                "sum(span.duration)",
            ],
            orderby=["-sum(span.duration)"],
            offset=0,
            limit=MAX_BATCH_QUERY_LIMIT,  # hard cap to avoid overloading Snuba; increase if needed
            referrer=Referrer.SEER_EXPLORER_INDEX,
            config=config,
            sampling_mode="NORMAL",
        )
    except Exception:
        logger.exception(
            "Failed to fetch top transactions for org projects",
            extra={"org_id": organization.id},
        )
        return {}

    transactions_by_project: dict[int, list[str]] = {}
    for row in result.get("data", []):
        project_id = row.get("project.id")
        name = row.get("transaction") or ""
        if project_id is not None and name:
            transactions_by_project.setdefault(project_id, [])
            if len(transactions_by_project[project_id]) < TOP_TRANSACTIONS_LIMIT:
                transactions_by_project[project_id].append(name)

    return transactions_by_project


def get_sdk_names_for_org_projects(
    projects: list[Project],
    start: datetime,
    end: datetime,
) -> dict[int, str]:
    """Query EAP for the most common sdk.name per project."""
    if not projects:
        return {}

    organization = projects[0].organization
    snuba_params = SnubaParams(
        start=start,
        end=end,
        projects=projects,
        organization=organization,
    )
    config = SearchResolverConfig(auto_fields=True)

    try:
        result = Spans.run_table_query(
            params=snuba_params,
            query_string="",
            selected_columns=[
                "project.id",
                "sdk.name",
                "count()",
            ],
            orderby=["-count()"],
            offset=0,
            limit=min(3 * len(projects), MAX_BATCH_QUERY_LIMIT),
            referrer=Referrer.SEER_EXPLORER_INDEX,
            config=config,
            sampling_mode="NORMAL",
        )
    except Exception:
        logger.exception(
            "Failed to fetch SDK names for org projects",
            extra={"org_id": organization.id},
        )
        return {}

    sdk_names: dict[int, str] = {}
    for row in result.get("data", []):
        project_id = row.get("project.id")
        sdk_name = row.get("sdk.name") or ""
        if project_id is not None and project_id not in sdk_names and sdk_name:
            sdk_names[project_id] = sdk_name

    return sdk_names


def get_event_counts_for_org_projects(
    org_id: int,
    project_ids: list[int],
    start: datetime,
    end: datetime,
) -> dict[int, ProjectEventCounts]:
    """Query outcomes for accepted error/transaction counts; returns only high-volume projects."""
    query = Query(
        match=Entity("outcomes"),
        select=[
            Column("project_id"),
            Column("category"),
            Function("sum", [Column("quantity")], "total"),
        ],
        where=[
            Condition(Column("timestamp"), Op.GTE, start),
            Condition(Column("timestamp"), Op.LT, end),
            Condition(Column("org_id"), Op.EQ, org_id),
            Condition(Column("project_id"), Op.IN, project_ids),
            Condition(Column("outcome"), Op.EQ, Outcome.ACCEPTED),
            Condition(
                Column("category"),
                Op.IN,
                [*DataCategory.error_categories(), DataCategory.TRANSACTION],
            ),
        ],
        groupby=[Column("project_id"), Column("category")],
        granularity=Granularity(int((end - start).total_seconds())),
        limit=Limit(10000),
    )
    request = Request(
        dataset="outcomes",
        app_id="explorer_context_engine",
        query=query,
        tenant_ids={"organization_id": org_id},
    )

    error_categories = set(DataCategory.error_categories())
    all_counts: dict[int, ProjectEventCounts] = {}
    try:
        data = raw_snql_query(request, referrer=Referrer.SEER_EXPLORER_INDEX.value)["data"]
        for row in data:
            project_id = row["project_id"]
            category = row["category"]
            total = row.get("total", 0)
            counts = all_counts.setdefault(project_id, ProjectEventCounts())
            if category == DataCategory.TRANSACTION:
                counts.transaction_count = total
            elif category in error_categories:
                counts.error_count += total
    except Exception:
        logger.exception(
            "Failed to fetch event counts for org projects",
            extra={"org_id": org_id},
        )

    return {
        project_id: counts
        for project_id, counts in all_counts.items()
        if counts.total() >= HIGH_VOLUME_THRESHOLD
    }
