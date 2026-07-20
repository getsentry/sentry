import logging
from collections.abc import Sequence
from datetime import datetime, timedelta
from typing import Any

from django.db.models import Count
from django.db.models.functions import TruncDay
from snuba_sdk import Request
from snuba_sdk.column import Column
from snuba_sdk.conditions import Condition, Op
from snuba_sdk.entity import Entity
from snuba_sdk.expressions import Granularity
from snuba_sdk.function import Function
from snuba_sdk.orderby import Direction, LimitBy, OrderBy
from snuba_sdk.query import Join, Limit, Query
from snuba_sdk.relationships import Relationship

from sentry.constants import DataCategory
from sentry.issues.grouptype import (
    PERFORMANCE_ISSUE_CATEGORIES,
    GroupCategory,
    InvalidGroupTypeError,
)
from sentry.models.group import DEFAULT_TYPE_ID, Group, GroupStatus
from sentry.models.grouphistory import GroupHistory
from sentry.models.grouplink import GroupLink
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.models.project import Project
from sentry.models.team import TeamStatus
from sentry.search.eap.occurrences.query_utils import keyed_counts_subset_match
from sentry.search.eap.occurrences.rollout_utils import EAPOccurrencesComparator
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.snuba.dataset import Dataset
from sentry.snuba.occurrences_rpc import OccurrenceCategory, Occurrences
from sentry.utils.dates import to_datetime
from sentry.utils.outcomes import Outcome
from sentry.utils.snuba import raw_snql_query
from sentry.utils.tracing import start_span

ONE_DAY = int(timedelta(days=1).total_seconds())
logger = logging.getLogger(__name__)


class OrganizationReportContext:
    def __init__(self, timestamp: float, duration: int, organization: Organization):
        self.timestamp = timestamp
        self.duration = duration

        self.start = to_datetime(timestamp - duration)
        self.end = to_datetime(timestamp)

        self.organization: Organization = organization
        self.projects_context_map: dict[int, ProjectContext] = {}  # { project_id: ProjectContext }

        self.project_ownership: dict[int, set[int]] = {}  # { user_id: set<project_id> }
        for project in organization.project_set.all():
            self.projects_context_map[project.id] = ProjectContext(project)

    def __repr__(self) -> str:
        return self.projects_context_map.__repr__()

    def is_empty(self):
        """
        Returns True if every project context is empty.
        """
        return all(
            project_ctx.check_if_project_is_empty()
            for project_ctx in self.projects_context_map.values()
        )


class ProjectContext:
    accepted_error_count = 0
    prev_week_accepted_error_count = 0

    new_substatus_count = 0
    ongoing_substatus_count = 0
    escalating_substatus_count = 0
    regression_substatus_count = 0
    total_substatus_count = 0
    prev_week_total_substatus_count = 0

    def __init__(self, project):
        self.project = project

        self.key_error_issues_by_id: list[tuple[int, int]] = []
        self.key_error_issues: list[tuple[Group, int]] = []
        # Array of (Group, count)
        self.key_performance_issues = []
        # Array of (Group, event_count, has_linked_pr_or_commit)
        self.past_resolved_issues: list[tuple[Group, int, bool]] = []

        self.key_replay_events = []

        # Dictionary of { timestamp: count }
        self.error_count_by_day = {}
        # Dictionary of { timestamp: count }
        self.issue_count_by_day = {}

    def __repr__(self) -> str:
        return "\n".join(
            [
                f"{self.key_error_issues}, ",
                f"Errors: [Accepted {self.accepted_error_count}]",
            ]
        )

    def check_if_project_is_empty(self):
        return (
            not self.key_error_issues
            and not self.key_performance_issues
            and not self.past_resolved_issues
            and not self.accepted_error_count
        )


def user_project_ownership(ctx: OrganizationReportContext) -> None:
    """Find the projects associated with each user.
    Populates context.project_ownership which is { user_id: set<project_id> }
    """
    for project_id, user_id in OrganizationMember.objects.filter(
        organization_id=ctx.organization.id,
        teams__projectteam__project__isnull=False,
        teams__status=TeamStatus.ACTIVE,
    ).values_list("teams__projectteam__project_id", "user_id"):
        if user_id is not None:
            ctx.project_ownership.setdefault(user_id, set()).add(project_id)


_KEY_ERROR_ISSUES_CHUNK_SIZE = 100


def _org_key_error_issues_chunk(
    ctx: OrganizationReportContext,
    project_ids: Sequence[int],
    referrer: str,
    per_project_limit: int,
) -> dict[int, list[dict[str, Any]]]:
    events_entity = Entity("events", alias="events")
    group_attributes_entity = Entity("group_attributes", alias="group_attributes")
    query = Query(
        match=Join([Relationship(events_entity, "attributes", group_attributes_entity)]),
        select=[
            Column("project_id", entity=events_entity),
            Column("group_id", entity=events_entity),
            Function("count", []),
        ],
        where=[
            Condition(Column("timestamp", entity=events_entity), Op.GTE, ctx.start),
            Condition(
                Column("timestamp", entity=events_entity),
                Op.LT,
                ctx.end,
            ),
            Condition(
                Column("project_id", entity=events_entity),
                Op.IN,
                project_ids,
            ),
            Condition(
                Column("project_id", entity=group_attributes_entity),
                Op.IN,
                project_ids,
            ),
            Condition(
                Column("group_status", entity=group_attributes_entity),
                Op.EQ,
                GroupStatus.UNRESOLVED,
            ),
            Condition(Column("level", entity=events_entity), Op.EQ, "error"),
        ],
        groupby=[
            Column("project_id", entity=events_entity),
            Column("group_id", entity=events_entity),
        ],
        orderby=[OrderBy(Function("count", []), Direction.DESC)],
        limitby=LimitBy([Column("project_id", entity=events_entity)], per_project_limit),
        limit=Limit(len(project_ids) * per_project_limit),
    )

    request = Request(
        dataset=Dataset.Events.value,
        app_id="reports",
        query=query,
        tenant_ids={"organization_id": ctx.organization.id},
    )
    rows = raw_snql_query(request, referrer=referrer)["data"]

    results: dict[int, list[dict[str, Any]]] = {}
    for row in rows:
        pid = row["events.project_id"]
        if pid not in results:
            results[pid] = []
        results[pid].append({"events.group_id": row["events.group_id"], "count()": row["count()"]})

    return results


def org_key_error_issues(
    ctx: OrganizationReportContext,
    project_ids: Sequence[int],
    referrer: str,
    per_project_limit: int = 5,
) -> dict[int, list[dict[str, Any]]]:
    op = "weekly_reports.org_key_error_issues"
    with start_span(op=op, name=op):
        if not project_ids:
            return {}

        results: dict[int, list[dict[str, Any]]] = {}
        for i in range(0, len(project_ids), _KEY_ERROR_ISSUES_CHUNK_SIZE):
            chunk = project_ids[i : i + _KEY_ERROR_ISSUES_CHUNK_SIZE]
            chunk_results = _org_key_error_issues_chunk(ctx, chunk, referrer, per_project_limit)
            results.update(chunk_results)

        return results


def project_key_performance_issues(ctx: OrganizationReportContext, project: Project, referrer: str):
    if not project.first_event:
        return

    op = "weekly_reports.project_key_performance_issues"

    with start_span(op=op, name=op):
        # Pick the 50 top frequent performance issues last seen within a month with the highest event count from all time.
        # Then, we use this to join with snuba, hoping that the top 3 issue by volume counted in snuba would be within this list.
        # We do this to limit the number of group_ids snuba has to join with.
        groups_qs = Group.objects.filter(
            project_id=project.id,
            status=GroupStatus.UNRESOLVED,
            last_seen__gte=ctx.end - timedelta(days=30),
            # performance issue range
            type__gte=1000,
            type__lt=2000,
        ).order_by("-times_seen")[:50]

        # Django doesn't have a .limit function, and this will actually do its magic to use the LIMIT statement.
        groups = list(groups_qs)
        group_id_to_group = {group.id: group for group in groups}

        if len(group_id_to_group) == 0:
            return

        snuba_rows = _project_key_performance_issues_snuba(
            ctx=ctx,
            project=project,
            referrer=referrer,
            group_ids=list(group_id_to_group.keys()),
        )
        query_result = snuba_rows

        callsite = "tasks.summaries.project_key_performance_issues"
        if EAPOccurrencesComparator.should_check_experiment(callsite):
            eap_rows = _project_key_performance_issues_eap(
                ctx=ctx,
                project=project,
                referrer=referrer,
                group_ids=list(group_id_to_group.keys()),
            )
            query_result = EAPOccurrencesComparator.check_and_choose(
                snuba_rows,
                eap_rows,
                callsite,
                is_experimental_data_nullish=len(eap_rows) == 0,
                reasonable_match_comparator=lambda snuba, eap: keyed_counts_subset_match(
                    snuba,
                    eap,
                    key_fn=lambda row: int(row["group_id"]),
                ),
                debug_context={
                    "organization_id": ctx.organization.id,
                    "project_id": project.id,
                    "candidate_group_ids_count": len(group_id_to_group),
                    "start": ctx.start.isoformat(),
                    "end": ctx.end.isoformat(),
                },
            )

        key_performance_issues = []
        for result in query_result:
            count = result["count()"]
            group_id = result["group_id"]
            group = group_id_to_group.get(group_id)
            if group:
                key_performance_issues.append((group, count))

        return key_performance_issues


def _project_key_performance_issues_snuba(
    ctx: OrganizationReportContext,
    project: Project,
    referrer: str,
    group_ids: list[int],
) -> list[dict[str, Any]]:
    # Fine grained query for 3 most frequent events happened during last week.
    query = Query(
        match=Entity("search_issues"),
        select=[
            Column("group_id"),
            Function("count", []),
        ],
        where=[
            Condition(Column("group_id"), Op.IN, group_ids),
            Condition(Column("timestamp"), Op.GTE, ctx.start),
            Condition(Column("timestamp"), Op.LT, ctx.end),
            Condition(Column("project_id"), Op.EQ, project.id),
        ],
        groupby=[Column("group_id")],
        orderby=[OrderBy(Function("count", []), Direction.DESC)],
        limit=Limit(5),
    )
    request = Request(
        dataset=Dataset.IssuePlatform.value,
        app_id="reports",
        query=query,
        tenant_ids={"organization_id": ctx.organization.id},
    )
    return raw_snql_query(request, referrer=referrer)["data"]


def _project_key_performance_issues_eap(
    ctx: OrganizationReportContext,
    project: Project,
    referrer: str,
    group_ids: list[int],
) -> list[dict[str, Any]]:
    if len(group_ids) == 1:
        query_string = f"group_id:{group_ids[0]}"
    else:
        query_string = f"group_id:[{', '.join(str(group_id) for group_id in group_ids)}]"

    snuba_params = SnubaParams(
        start=ctx.start,
        end=ctx.end,
        organization=ctx.organization,
        projects=[project],
    )

    try:
        eap_response = Occurrences.run_table_query(
            params=snuba_params,
            query_string=query_string,
            selected_columns=["group_id", "count()"],
            orderby=["-count()"],
            offset=0,
            limit=5,
            referrer=referrer,
            config=SearchResolverConfig(),
            occurrence_category=OccurrenceCategory.ISSUE_PLATFORM,
        )
    except Exception:
        logger.exception(
            "summaries.key_performance_issues.eap_query_failed",
            extra={
                "organization_id": ctx.organization.id,
                "project_id": project.id,
                "group_ids_count": len(group_ids),
            },
        )
        return []

    normalized_rows = []
    for row in eap_response.get("data", []):
        group_id = row.get("group_id")
        count = row.get("count()")
        if group_id is None or count is None:
            continue
        normalized_rows.append({"group_id": int(group_id), "count()": int(count)})

    return normalized_rows


def fetch_key_error_issues(ctx: OrganizationReportContext) -> None:
    # Organization pass. Depends on org_key_error_issues.
    all_key_error_group_ids = []
    for project_ctx in ctx.projects_context_map.values():
        all_key_error_group_ids.extend(
            [group_id for group_id, _ in project_ctx.key_error_issues_by_id]
        )

    if len(all_key_error_group_ids) == 0:
        return

    group_id_to_group = {}
    for group in Group.objects.filter(id__in=all_key_error_group_ids).all():
        group_id_to_group[group.id] = group

    for project_ctx in ctx.projects_context_map.values():
        # note Snuba might have groups that have since been deleted
        # we should just ignore those
        project_ctx.key_error_issues = [
            (group, count)
            for group, count in (
                (group_id_to_group.get(group_id), count)
                for group_id, count in project_ctx.key_error_issues_by_id
            )
            if group is not None
        ]


def fetch_key_performance_issues(ctx: OrganizationReportContext):
    # Organization pass. Depends on project_key_performance_issue.
    all_groups = []
    for project_ctx in ctx.projects_context_map.values():
        all_groups.extend([group for group, count in project_ctx.key_performance_issues])

    if len(all_groups) == 0:
        return

    group_id_to_group = {group.id: group for group in all_groups}

    group_history = (
        GroupHistory.objects.filter(
            group_id__in=group_id_to_group.keys(), organization_id=ctx.organization.id
        )
        .order_by("group_id", "-date_added")
        .distinct("group_id")
        .all()
    )
    group_id_to_group_history = {g.group_id: g for g in group_history}

    for project_ctx in ctx.projects_context_map.values():
        project_ctx.key_performance_issues = [
            (group, group_id_to_group_history.get(group.id, None), count)
            for group, count in project_ctx.key_performance_issues
        ]


def project_event_counts_for_organization(start, end, ctx, referrer: str) -> list[dict[str, Any]]:
    """
    Populates context.projects which is { project_id: ProjectContext }
    """

    query = Query(
        match=Entity("outcomes"),
        select=[
            Function("sum", [Column("quantity")], "total"),
        ],
        where=[
            Condition(Column("timestamp"), Op.GTE, start),
            Condition(Column("timestamp"), Op.LT, end),
            Condition(Column("org_id"), Op.EQ, ctx.organization.id),
            Condition(Column("outcome"), Op.EQ, Outcome.ACCEPTED),
            Condition(
                Column("category"),
                Op.IN,
                [*DataCategory.error_categories()],
            ),
        ],
        groupby=[Column("project_id"), Column("time")],
        granularity=Granularity(ONE_DAY),
        orderby=[OrderBy(Column("time"), Direction.ASC)],
        limit=Limit(10000),
    )
    request = Request(
        dataset=Dataset.Outcomes.value,
        app_id="reports",
        query=query,
        tenant_ids={"organization_id": ctx.organization.id},
    )
    data = raw_snql_query(request, referrer=referrer)["data"]
    return data


def organization_project_issue_summaries(
    start: datetime, end: datetime, ctx: OrganizationReportContext
) -> list[dict[str, Any]]:
    """Query unresolved issues grouped by (project, substatus, day).

    Returns raw rows; callers roll up by substatus or by day as needed.
    """
    return list(
        Group.objects.filter(
            project_id__in=list(ctx.projects_context_map.keys()),
            last_seen__gte=start,
            last_seen__lt=end,
            status=GroupStatus.UNRESOLVED,
        )
        .annotate(day=TruncDay("last_seen"))
        .values("project_id", "substatus", "day")
        .annotate(total=Count("id"))
    )


PAST_ISSUES_CANDIDATE_LIMIT = 50
PAST_ISSUES_LINK_BOOST = 2


def project_past_resolved_issues(
    ctx: OrganizationReportContext, project: Project, referrer: str
) -> list[tuple[Group, int, bool]]:
    if not project.first_event:
        return []

    with start_span(
        op="weekly_reports.project_past_resolved_issues",
        name="weekly_reports.project_past_resolved_issues",
    ):
        candidates = list(
            Group.objects.filter(
                project_id=project.id,
                status=GroupStatus.RESOLVED,
                resolved_at__gte=ctx.start,
                resolved_at__lt=ctx.end,
            ).order_by("-times_seen")[:PAST_ISSUES_CANDIDATE_LIMIT]
        )

        if not candidates:
            return []

        # Filter out groups with unregistered type IDs (deprecated/removed issue types)
        valid_candidates = []
        for g in candidates:
            if g.type is None or g.type == DEFAULT_TYPE_ID:
                valid_candidates.append(g)
                continue
            try:
                g.issue_category
            except InvalidGroupTypeError:
                continue
            valid_candidates.append(g)

        group_id_to_group = {g.id: g for g in valid_candidates}

        # Legacy groups may have a None .type which crashes issue_category; treat as error group
        error_group_ids = [
            g.id
            for g in valid_candidates
            if g.type is None
            or g.type == DEFAULT_TYPE_ID
            or g.issue_category == GroupCategory.ERROR
        ]
        performance_group_ids = [
            g.id
            for g in valid_candidates
            if g.type is not None
            and g.type != DEFAULT_TYPE_ID
            and (
                g.issue_category == GroupCategory.PERFORMANCE
                or g.issue_category in PERFORMANCE_ISSUE_CATEGORIES
            )
        ]

        event_counts: dict[int, int] = {}

        if error_group_ids:
            error_counts = _past_resolved_error_counts(ctx, project, error_group_ids, referrer)
            event_counts.update(error_counts)

        if performance_group_ids:
            performance_counts = _past_resolved_performance_counts(
                ctx, project, performance_group_ids, referrer
            )
            event_counts.update(performance_counts)

        # has_link is initially False; updated by fetch_past_resolved_issue_links at org level
        scored = []
        for group_id, count in event_counts.items():
            group = group_id_to_group.get(group_id)
            if group is None:
                continue
            scored.append((group, count, False))

        scored.sort(key=lambda x: x[1], reverse=True)
        return scored


def _past_resolved_error_counts(
    ctx: OrganizationReportContext,
    project: Project,
    group_ids: list[int],
    referrer: str,
) -> dict[int, int]:
    events_entity = Entity("events", alias="events")
    group_attributes_entity = Entity("group_attributes", alias="group_attributes")
    query = Query(
        match=Join([Relationship(events_entity, "attributes", group_attributes_entity)]),
        select=[Column("group_id", entity=events_entity), Function("count", [])],
        where=[
            Condition(Column("timestamp", entity=events_entity), Op.GTE, ctx.start),
            Condition(
                Column("timestamp", entity=events_entity),
                Op.LT,
                ctx.end,
            ),
            Condition(Column("project_id", entity=events_entity), Op.EQ, project.id),
            Condition(Column("project_id", entity=group_attributes_entity), Op.EQ, project.id),
            Condition(
                Column("group_id", entity=events_entity),
                Op.IN,
                group_ids,
            ),
            Condition(
                Column("group_status", entity=group_attributes_entity),
                Op.EQ,
                GroupStatus.RESOLVED,
            ),
        ],
        groupby=[Column("group_id", entity=events_entity)],
        orderby=[OrderBy(Function("count", []), Direction.DESC)],
        limit=Limit(len(group_ids)),
    )

    request = Request(
        dataset=Dataset.Events.value,
        app_id="reports",
        query=query,
        tenant_ids={"organization_id": ctx.organization.id},
    )
    rows = raw_snql_query(request, referrer=referrer)["data"]
    return {row["events.group_id"]: row["count()"] for row in rows}


def _past_resolved_performance_counts(
    ctx: OrganizationReportContext,
    project: Project,
    group_ids: list[int],
    referrer: str,
) -> dict[int, int]:
    query = Query(
        match=Entity("search_issues"),
        select=[Column("group_id"), Function("count", [])],
        where=[
            Condition(Column("group_id"), Op.IN, group_ids),
            Condition(Column("timestamp"), Op.GTE, ctx.start),
            Condition(Column("timestamp"), Op.LT, ctx.end),
            Condition(Column("project_id"), Op.EQ, project.id),
        ],
        groupby=[Column("group_id")],
        orderby=[OrderBy(Function("count", []), Direction.DESC)],
        limit=Limit(len(group_ids)),
    )
    request = Request(
        dataset=Dataset.IssuePlatform.value,
        app_id="reports",
        query=query,
        tenant_ids={"organization_id": ctx.organization.id},
    )
    rows = raw_snql_query(request, referrer=referrer)["data"]
    return {row["group_id"]: row["count()"] for row in rows}


def fetch_past_resolved_issue_links(ctx: OrganizationReportContext) -> None:
    all_group_ids: list[int] = []
    for project_ctx in ctx.projects_context_map.values():
        all_group_ids.extend(
            group.id for group, _count, _has_link in project_ctx.past_resolved_issues
        )

    if not all_group_ids:
        return

    groups_with_links = set(
        GroupLink.objects.filter(
            group_id__in=all_group_ids,
            linked_type__in=[GroupLink.LinkedType.commit, GroupLink.LinkedType.pull_request],
            relationship=GroupLink.Relationship.resolves,
        ).values_list("group_id", flat=True)
    )

    for project_ctx in ctx.projects_context_map.values():
        project_ctx.past_resolved_issues = [
            (group, count, group.id in groups_with_links)
            for group, count, _has_link in project_ctx.past_resolved_issues
        ]

    # Re-sort with link boost applied, then truncate to top 3
    for project_ctx in ctx.projects_context_map.values():
        project_ctx.past_resolved_issues.sort(
            key=lambda x: x[1] * (PAST_ISSUES_LINK_BOOST if x[2] else 1),
            reverse=True,
        )
        project_ctx.past_resolved_issues = project_ctx.past_resolved_issues[:3]
