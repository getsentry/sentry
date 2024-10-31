from datetime import timedelta
from typing import Any, cast

import sentry_sdk
from django.db.models import Count
from snuba_sdk import Request
from snuba_sdk.column import Column
from snuba_sdk.conditions import Condition, Op
from snuba_sdk.entity import Entity
from snuba_sdk.expressions import Granularity
from snuba_sdk.function import Function
from snuba_sdk.orderby import Direction, OrderBy
from snuba_sdk.query import Join, Limit, Query
from snuba_sdk.relationships import Relationship

from sentry.api.serializers.snuba import zerofill
from sentry.constants import DataCategory
from sentry.models.group import Group, GroupStatus
from sentry.models.grouphistory import GroupHistory
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.models.project import Project
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.types.group import GroupSubStatus
from sentry.utils.dates import to_datetime
from sentry.utils.outcomes import Outcome
from sentry.utils.snuba import raw_snql_query

ONE_DAY = int(timedelta(days=1).total_seconds())
COMPARISON_PERIOD = 14


class OrganizationReportContext:
    def __init__(
        self, timestamp: float, duration: int, organization: Organization, daily: bool = False
    ):
        self.timestamp = timestamp
        self.duration = duration

        self.start = to_datetime(timestamp - duration)
        self.end = to_datetime(timestamp)

        self.organization: Organization = organization
        self.projects_context_map: dict[int, ProjectContext | DailySummaryProjectContext] = (
            {}
        )  # { project_id: ProjectContext }

        self.project_ownership: dict[int, set[int]] = {}  # { user_id: set<project_id> }
        self.daily = daily
        for project in organization.project_set.all():
            if self.daily:
                self.projects_context_map[project.id] = DailySummaryProjectContext(project)
            else:
                self.projects_context_map[project.id] = ProjectContext(project)

    def __repr__(self):
        return self.projects_context_map.__repr__()


class ProjectContext:
    accepted_error_count = 0
    dropped_error_count = 0
    accepted_transaction_count = 0
    dropped_transaction_count = 0
    accepted_replay_count = 0
    dropped_replay_count = 0

    new_substatus_count = 0
    ongoing_substatus_count = 0
    escalating_substatus_count = 0
    regression_substatus_count = 0
    total_substatus_count = 0

    def __init__(self, project):
        self.project = project

        self.key_errors_by_id: list[tuple[int, int]] = []
        self.key_errors_by_group: list[tuple[Group, int]] = []
        # Array of (transaction_name, count_this_week, p95_this_week, count_last_week, p95_last_week)
        self.key_transactions = []
        # Array of (Group, count)
        self.key_performance_issues = []

        self.key_replay_events = []

        # Dictionary of { timestamp: count }
        self.error_count_by_day = {}
        # Dictionary of { timestamp: count }
        self.transaction_count_by_day = {}
        # Dictionary of { timestamp: count }
        self.replay_count_by_day = {}

    def __repr__(self):
        return "\n".join(
            [
                f"{self.key_errors_by_group}, ",
                f"Errors: [Accepted {self.accepted_error_count}, Dropped {self.dropped_error_count}]",
                f"Transactions: [Accepted {self.accepted_transaction_count} Dropped {self.dropped_transaction_count}]",
                f"Replays: [Accepted {self.accepted_replay_count} Dropped {self.dropped_replay_count}]",
            ]
        )

    def check_if_project_is_empty(self):
        return (
            not self.key_errors_by_group
            and not self.key_transactions
            and not self.key_performance_issues
            and not self.accepted_error_count
            and not self.dropped_error_count
            and not self.accepted_transaction_count
            and not self.dropped_transaction_count
            and not self.accepted_replay_count
            and not self.dropped_replay_count
        )


class DailySummaryProjectContext:
    def __init__(self, project: Project):
        self.total_today = 0
        self.comparison_period_total = 0
        self.comparison_period_avg = 0
        self.project = project
        self.key_errors_by_id: list[tuple[int, int]] = []
        self.key_errors_by_group: list[tuple[Group, int]] = []
        self.key_performance_issues: list[tuple[Group, int]] = []
        self.escalated_today: list[Group] = []
        self.regressed_today: list[Group] = []
        self.new_in_release: dict[int, list[Group]] = {}

    def check_if_project_is_empty(self):
        return (
            not self.key_errors_by_group
            and not self.key_performance_issues
            and not self.total_today
            and not self.comparison_period_total
            and not self.comparison_period_avg
            and not self.escalated_today
            and not self.regressed_today
            and not self.new_in_release
        )


def user_project_ownership(ctx: OrganizationReportContext) -> None:
    """Find the projects associated with each user.
    Populates context.project_ownership which is { user_id: set<project_id> }
    """
    for project_id, user_id in OrganizationMember.objects.filter(
        organization_id=ctx.organization.id, teams__projectteam__project__isnull=False
    ).values_list("teams__projectteam__project_id", "user_id"):
        if user_id is not None:
            ctx.project_ownership.setdefault(user_id, set()).add(project_id)


def project_key_errors(
    ctx: OrganizationReportContext, project: Project, referrer: str
) -> list[dict[str, Any]] | None:
    if not project.first_event:
        return None
    # Take the 3 most frequently occuring events
    prefix = (
        "daily_summary" if referrer == Referrer.DAILY_SUMMARY_KEY_ERRORS.value else "weekly_reports"
    )
    op = f"{prefix}.project_key_errors"

    with sentry_sdk.start_span(op=op):
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
                    ctx.end + timedelta(days=1),
                ),
                Condition(
                    Column(
                        "project_id",
                        entity=events_entity,
                    ),
                    Op.EQ,
                    project.id,
                ),
                Condition(
                    Column(
                        "project_id",
                        entity=group_attributes_entity,
                    ),
                    Op.EQ,
                    project.id,
                ),
                Condition(
                    Column("group_status", entity=group_attributes_entity),
                    Op.IN,
                    GroupStatus.UNRESOLVED,
                ),
                Condition(Column("level", entity=events_entity), Op.EQ, "error"),
            ],
            groupby=[Column("group_id", entity=events_entity)],
            orderby=[OrderBy(Function("count", []), Direction.DESC)],
            limit=Limit(3),
        )

        request = Request(
            dataset=Dataset.Events.value,
            app_id="reports",
            query=query,
            tenant_ids={"organization_id": ctx.organization.id},
        )
        query_result = raw_snql_query(request, referrer=referrer)
        key_errors = query_result["data"]
        # Set project_ctx.key_errors_by_id to be an array of (group_id, count) for now.
        # We will query the group history later on in `fetch_key_error_groups`, batched in a per-organization basis
        return key_errors


def project_key_performance_issues(ctx: OrganizationReportContext, project: Project, referrer: str):
    if not project.first_event:
        return

    prefix = (
        "daily_summary"
        if referrer == Referrer.DAILY_SUMMARY_KEY_PERFORMANCE_ISSUES.value
        else "weekly_reports"
    )
    op = f"{prefix}.project_key_performance_issues"

    with sentry_sdk.start_span(op=op):
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

        # Fine grained query for 3 most frequent events happend during last week
        query = Query(
            match=Entity("search_issues"),
            select=[
                Column("group_id"),
                Function("count", []),
            ],
            where=[
                Condition(Column("group_id"), Op.IN, list(group_id_to_group.keys())),
                Condition(Column("timestamp"), Op.GTE, ctx.start),
                Condition(Column("timestamp"), Op.LT, ctx.end + timedelta(days=1)),
                Condition(Column("project_id"), Op.EQ, project.id),
            ],
            groupby=[Column("group_id")],
            orderby=[OrderBy(Function("count", []), Direction.DESC)],
            limit=Limit(3),
        )
        request = Request(
            dataset=Dataset.IssuePlatform.value,
            app_id="reports",
            query=query,
            tenant_ids={"organization_id": ctx.organization.id},
        )
        query_result = raw_snql_query(request, referrer=referrer)["data"]

        key_performance_issues = []
        for result in query_result:
            count = result["count()"]
            group_id = result["group_id"]
            group = group_id_to_group.get(group_id)
            if group:
                key_performance_issues.append((group, count))

        return key_performance_issues


def project_key_transactions_this_week(ctx, project):
    if not project.flags.has_transactions:
        return
    with sentry_sdk.start_span(op="weekly_reports.project_key_transactions"):
        # Take the 3 most frequently occuring transactions this week
        query = Query(
            match=Entity("transactions"),
            select=[
                Column("transaction_name"),
                Function("quantile(0.95)", [Column("duration")], "p95"),
                Function("count", [], "count"),
            ],
            where=[
                Condition(Column("finish_ts"), Op.GTE, ctx.start),
                Condition(Column("finish_ts"), Op.LT, ctx.end + timedelta(days=1)),
                Condition(Column("project_id"), Op.EQ, project.id),
            ],
            groupby=[Column("transaction_name")],
            orderby=[OrderBy(Function("count", []), Direction.DESC)],
            limit=Limit(3),
        )
        request = Request(dataset=Dataset.Transactions.value, app_id="reports", query=query)
        query_result = raw_snql_query(request, referrer="weekly_reports.key_transactions.this_week")
        key_transactions = query_result["data"]
        return key_transactions


def project_key_transactions_last_week(ctx, project, key_transactions):
    # Query the p95 for those transactions last week
    query = Query(
        match=Entity("transactions"),
        select=[
            Column("transaction_name"),
            Function("quantile(0.95)", [Column("duration")], "p95"),
            Function("count", [], "count"),
        ],
        where=[
            Condition(Column("finish_ts"), Op.GTE, ctx.start - timedelta(days=7)),
            Condition(Column("finish_ts"), Op.LT, ctx.end - timedelta(days=7)),
            Condition(Column("project_id"), Op.EQ, project.id),
            Condition(
                Column("transaction_name"),
                Op.IN,
                [i["transaction_name"] for i in key_transactions],
            ),
        ],
        groupby=[Column("transaction_name")],
    )
    request = Request(dataset=Dataset.Transactions.value, app_id="reports", query=query)
    query_result = raw_snql_query(request, referrer="weekly_reports.key_transactions.last_week")
    return query_result


def fetch_key_error_groups(ctx: OrganizationReportContext) -> None:
    # Organization pass. Depends on project_key_errors.
    all_key_error_group_ids = []
    for project_ctx in ctx.projects_context_map.values():
        all_key_error_group_ids.extend([group_id for group_id, _ in project_ctx.key_errors_by_id])

    if len(all_key_error_group_ids) == 0:
        return

    group_id_to_group = {}
    for group in Group.objects.filter(id__in=all_key_error_group_ids).all():
        group_id_to_group[group.id] = group

    for project_ctx in ctx.projects_context_map.values():
        # note Snuba might have groups that have since been deleted
        # we should just ignore those
        project_ctx.key_errors_by_group = [
            (group, count)
            for group, count in (
                (group_id_to_group.get(group_id), count)
                for group_id, count in project_ctx.key_errors_by_id
            )
            if group is not None
        ]


def fetch_key_performance_issue_groups(ctx: OrganizationReportContext):
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

    def zerofill_data(data):
        return zerofill(data, start, end, ONE_DAY, fill_default=0)

    query = Query(
        match=Entity("outcomes"),
        select=[
            Column("outcome"),
            Column("category"),
            Function("sum", [Column("quantity")], "total"),
        ],
        where=[
            Condition(Column("timestamp"), Op.GTE, start),
            Condition(Column("timestamp"), Op.LT, end + timedelta(days=1)),
            Condition(Column("org_id"), Op.EQ, ctx.organization.id),
            Condition(
                Column("outcome"), Op.IN, [Outcome.ACCEPTED, Outcome.FILTERED, Outcome.RATE_LIMITED]
            ),
            Condition(
                Column("category"),
                Op.IN,
                [*DataCategory.error_categories(), DataCategory.TRANSACTION, DataCategory.REPLAY],
            ),
        ],
        groupby=[Column("outcome"), Column("category"), Column("project_id"), Column("time")],
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


def organization_project_issue_substatus_summaries(ctx: OrganizationReportContext) -> None:
    substatus_counts = (
        Group.objects.filter(
            project__organization_id=ctx.organization.id,
            last_seen__gte=ctx.start,
            last_seen__lt=ctx.end,
            status=GroupStatus.UNRESOLVED,
        )
        .values("project_id", "substatus")
        .annotate(total=Count("substatus"))
    )
    for item in substatus_counts:
        project_ctx = cast(ProjectContext, ctx.projects_context_map[item["project_id"]])
        if item["substatus"] == GroupSubStatus.NEW:
            project_ctx.new_substatus_count = item["total"]
        if item["substatus"] == GroupSubStatus.ESCALATING:
            project_ctx.escalating_substatus_count = item["total"]
        if item["substatus"] == GroupSubStatus.ONGOING:
            project_ctx.ongoing_substatus_count = item["total"]
        if item["substatus"] == GroupSubStatus.REGRESSED:
            project_ctx.regression_substatus_count = item["total"]
        project_ctx.total_substatus_count += item["total"]


def check_if_ctx_is_empty(ctx: OrganizationReportContext) -> bool:
    """
    Check if the context is empty. If it is, we don't want to send a notification.
    """
    return all(
        project_ctx.check_if_project_is_empty() for project_ctx in ctx.projects_context_map.values()
    )
