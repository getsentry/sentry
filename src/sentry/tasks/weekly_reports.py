import heapq
from datetime import timedelta
from functools import partial, reduce

from django.db.models import Count, F
from django.utils import dateformat, timezone
from snuba_sdk import Request
from snuba_sdk.column import Column
from snuba_sdk.conditions import Condition, Op
from snuba_sdk.entity import Entity
from snuba_sdk.expressions import Granularity
from snuba_sdk.function import Function
from snuba_sdk.orderby import Direction, OrderBy
from snuba_sdk.query import Limit, Query

from sentry.api.serializers.snuba import zerofill
from sentry.constants import DataCategory
from sentry.models import (
    Activity,
    Group,
    GroupHistory,
    GroupHistoryStatus,
    GroupStatus,
    Organization,
    OrganizationMember,
    OrganizationStatus,
    UserOption,
)
from sentry.snuba.dataset import Dataset
from sentry.tasks.base import instrumented_task
from sentry.types.activity import ActivityType
from sentry.utils import json
from sentry.utils.dates import floor_to_utc_day, to_datetime, to_timestamp
from sentry.utils.email import MessageBuilder
from sentry.utils.outcomes import Outcome
from sentry.utils.query import RangeQuerySetWrapper
from sentry.utils.snuba import parse_snuba_datetime, raw_snql_query

ONE_DAY = int(timedelta(days=1).total_seconds())
date_format = partial(dateformat.format, format_string="F jS, Y")


class OrganizationReportContext:
    def __init__(self, timestamp, duration, organization):
        self.timestamp = timestamp
        self.duration = duration

        self.start = to_datetime(timestamp - duration)
        self.end = to_datetime(timestamp)

        self.organization = organization
        self.projects = {}  # { project_id: ProjectContext }

        self.project_ownership = {}  # { user_id: set<project_id> }
        for project in organization.project_set.all():
            self.projects[project.id] = ProjectContext(project)

    def __repr__(self):
        return self.projects.__repr__()


class ProjectContext:
    accepted_error_count = 0
    dropped_error_count = 0
    accepted_transaction_count = 0
    dropped_transaction_count = 0

    all_issue_count = 0
    existing_issue_count = 0
    reopened_issue_count = 0
    new_issue_count = 0

    def __init__(self, project):
        self.project = project

        # Array of (group_id, group_history, count)
        self.key_errors = []
        # Array of (transaction_name, count_this_week, p95_this_week, count_last_week, p95_last_week)
        self.key_transactions = []

        # Dictionary of { timestamp: count }
        self.error_count_by_day = {}
        # Dictionary of { timestamp: count }
        self.transaction_count_by_day = {}

    def __repr__(self):
        return f"{self.key_errors}, Errors: [Accepted {self.accepted_error_count}, Dropped {self.dropped_error_count}]\nTransactions: [Accepted {self.accepted_transaction_count} Dropped {self.dropped_transaction_count}]"


# The entry point. This task is scheduled to run every week.
@instrumented_task(
    name="sentry.tasks.weekly_reports.schedule_organizations",
    queue="reports.prepare",
    max_retries=5,
    acks_late=True,
)
def schedule_organizations(dry_run=False, timestamp=None, duration=None):
    if timestamp is None:
        # The time that the report was generated
        timestamp = to_timestamp(floor_to_utc_day(timezone.now()))

    if duration is None:
        # The total timespan that the task covers
        duration = ONE_DAY * 7

    organizations = Organization.objects.filter(status=OrganizationStatus.ACTIVE)
    for i, organization in enumerate(
        RangeQuerySetWrapper(organizations, step=10000, result_value_getter=lambda item: item.id)
    ):
        # if not features.has("organizations:weekly-email-refresh", organization):
        #    continue
        # Create a celery task per organization
        prepare_organization_report.delay(timestamp, duration, organization.id, dry_run=dry_run)


# This task is launched per-organization.
@instrumented_task(
    name="sentry.tasks.weekly_reports.prepare_organization_report",
    queue="reports.prepare",
    max_retries=5,
    acks_late=True,
)
def prepare_organization_report(timestamp, duration, organization_id, dry_run=False):
    organization = Organization.objects.get(id=organization_id)
    ctx = OrganizationReportContext(timestamp, duration, organization)

    # Run organization passes
    user_project_ownership(ctx)
    project_event_counts_for_organization(ctx)
    organization_project_issue_summaries(ctx)

    # Run project passes
    for project in organization.project_set.all():
        project_key_errors(ctx, project)
        project_key_transactions(ctx, project)

    fetch_key_error_groups(ctx)

    # TODO: Run user passes

    # Finally, deliver the reports
    deliver_reports(ctx, dry_run=dry_run)


# Organization Passes
def user_project_ownership(ctx):
    for (project_id, user_id) in OrganizationMember.objects.filter(
        organization_id=ctx.organization.id, teams__projectteam__project__isnull=False
    ).values_list("teams__projectteam__project_id", "user_id"):
        ctx.project_ownership.setdefault(user_id, set()).add(project_id)


def project_event_counts_for_organization(ctx):
    def zerofill_data(data):
        return zerofill(data, ctx.start, ctx.end, ONE_DAY, fill_default=0)

    query = Query(
        match=Entity("outcomes"),
        select=[
            Column("outcome"),
            Column("category"),
            Function("sum", [Column("quantity")], "total"),
        ],
        where=[
            Condition(Column("timestamp"), Op.GTE, ctx.start),
            Condition(Column("timestamp"), Op.LT, ctx.end + timedelta(days=1)),
            Condition(Column("project_id"), Op.EQ, 1),
            Condition(Column("org_id"), Op.EQ, ctx.organization.id),
            Condition(
                Column("outcome"), Op.IN, [Outcome.ACCEPTED, Outcome.FILTERED, Outcome.RATE_LIMITED]
            ),
            Condition(
                Column("category"),
                Op.IN,
                [*DataCategory.error_categories(), DataCategory.TRANSACTION],
            ),
        ],
        groupby=[Column("outcome"), Column("category"), Column("project_id"), Column("time")],
        granularity=Granularity(ONE_DAY),
        orderby=[OrderBy(Column("time"), Direction.ASC)],
    )
    request = Request(dataset=Dataset.Outcomes.value, app_id="reports", query=query)
    data = raw_snql_query(request, referrer="reports.outcomes")["data"]

    for dat in data:
        project_id = dat["project_id"]
        project_ctx = ctx.projects[project_id]
        total = dat["total"]
        timestamp = int(to_timestamp(parse_snuba_datetime(dat["time"])))
        if dat["category"] == DataCategory.TRANSACTION:
            # Transaction outcome
            if dat["outcome"] == Outcome.RATE_LIMITED:
                project_ctx.dropped_transaction_count += total
            else:
                project_ctx.accepted_transaction_count += total
                project_ctx.transaction_count_by_day[timestamp] = total
        else:
            # Error outcome
            if dat["outcome"] == Outcome.RATE_LIMITED:
                project_ctx.dropped_error_count += total
            else:
                project_ctx.accepted_error_count += total
                project_ctx.error_count_by_day[timestamp] = (
                    project_ctx.error_count_by_day.get(timestamp, 0) + total
                )


def organization_project_issue_summaries(ctx):
    all_issues = Group.objects.exclude(status=GroupStatus.IGNORED)
    new_issue_counts = (
        all_issues.filter(
            project__organization_id=ctx.organization.id,
            first_seen__gte=ctx.start,
            first_seen__lt=ctx.end,
        )
        .values("project_id")
        .annotate(total=Count("*"))
    )
    new_issue_counts = {item["project_id"]: item["total"] for item in new_issue_counts}

    # Fetch all regressions. This is a little weird, since there's no way to
    # tell *when* a group regressed using the Group model. Instead, we query
    # all groups that have been seen in the last week and have ever regressed
    # and query the Activity model to find out if they regressed within the
    # past week. (In theory, the activity table *could* be used to answer this
    # query without the subselect, but there's no suitable indexes to make it's
    # performance predictable.)
    reopened_issue_counts = (
        Activity.objects.filter(
            project__organization_id=ctx.organization.id,
            group__in=all_issues.filter(
                last_seen__gte=ctx.start,
                last_seen__lt=ctx.end,
                resolved_at__isnull=False,  # signals this has *ever* been resolved
            ),
            type__in=(ActivityType.SET_REGRESSION.value, ActivityType.SET_UNRESOLVED.value),
            datetime__gte=ctx.start,
            datetime__lt=ctx.end,
        )
        .values("group__project_id")
        .annotate(total=Count("group_id"))
    )  # TODO: maybe set distinct here?
    reopened_issue_counts = {item["project_id"]: item["total"] for item in reopened_issue_counts}

    # Issues seen at least once over the past week
    active_issue_counts = (
        all_issues.filter(
            project__organization_id=ctx.organization.id,
            last_seen__gte=ctx.start,
            last_seen__lt=ctx.end,
        )
        .values("project_id")
        .annotate(total=Count("*"))
    )
    active_issue_counts = {item["project_id"]: item["total"] for item in active_issue_counts}

    for project_ctx in ctx.projects.values():
        project_id = project_ctx.project.id
        active_issue_count = active_issue_counts.get(project_id, 0)
        project_ctx.reopened_issue_count = reopened_issue_counts.get(project_id, 0)
        project_ctx.new_issue_count = new_issue_counts.get(project_id, 0)
        project_ctx.existing_issue_count = max(
            active_issue_count - project_ctx.reopened_issue_count - project_ctx.new_issue_count, 0
        )
        project_ctx.all_issue_count = (
            project_ctx.reopened_issue_count
            + project_ctx.new_issue_count
            + project_ctx.existing_issue_count
        )


# Project passes
def project_key_errors(ctx, project):
    if not project.first_event:
        return
    # Take the 3 most frequently occuring events
    query = Query(
        match=Entity("events"),
        select=[Column("group_id"), Function("count", [])],
        where=[
            Condition(Column("timestamp"), Op.GTE, ctx.start),
            Condition(Column("timestamp"), Op.LT, ctx.end + timedelta(days=1)),
            Condition(Column("project_id"), Op.EQ, project.id),
        ],
        groupby=[Column("group_id")],
        orderby=[OrderBy(Function("count", []), Direction.DESC)],
        limit=Limit(3),
    )
    request = Request(dataset=Dataset.Events.value, app_id="reports", query=query)
    query_result = raw_snql_query(request, referrer="reports.key_errors")
    key_errors = query_result["data"]
    # Set project_ctx.key_errors to be an array of (group_id, count) for now.
    # We will query the group history later on in `fetch_key_error_groups`, batched in a per-organization basis
    ctx.projects[project.id].key_errors = [(e["group_id"], e["count()"]) for e in key_errors]


# Organization pass. Depends on project_key_errors.
def fetch_key_error_groups(ctx):
    all_key_error_group_ids = []
    for project_ctx in ctx.projects.values():
        all_key_error_group_ids.extend([group_id for group_id, count in project_ctx.key_errors])

    if len(all_key_error_group_ids) == 0:
        return

    group_id_to_group = {}
    for group in Group.objects.filter(id__in=all_key_error_group_ids).all():
        group_id_to_group[group.id] = group

    group_history = (
        GroupHistory.objects.filter(
            group_id__in=all_key_error_group_ids, organization_id=ctx.organization.id
        )
        .order_by("group_id", "-date_added")
        .distinct("group_id")
        .all()
    )
    group_id_to_group_history = {g.group_id: g for g in group_history}

    for project_ctx in ctx.projects.values():
        project_ctx.key_errors = [
            (group_id_to_group[group_id], group_id_to_group_history.get(group_id, None), count)
            for group_id, count in project_ctx.key_errors
        ]


def project_key_transactions(ctx, project):
    if not project.flags.has_transactions:
        return
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
    ctx.projects[project.id].key_transactions_this_week = [
        (i["transaction_name"], i["count"], i["p95"]) for i in key_transactions
    ]

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
                Column("transaction_name"), Op.IN, [i["transaction_name"] for i in key_transactions]
            ),
        ],
        groupby=[Column("transaction_name")],
    )
    request = Request(dataset=Dataset.Transactions.value, app_id="reports", query=query)
    query_result = raw_snql_query(request, referrer="weekly_reports.key_transactions.last_week")

    # Join this week with last week
    last_week_data = {i["transaction_name"]: (i["count"], i["p95"]) for i in query_result["data"]}

    ctx.projects[project.id].key_transactions = [
        (i["transaction_name"], i["count"], i["p95"])
        + last_week_data.get(i["transaction_name"], (0, 0))
        for i in key_transactions
    ]


# Deliver reports
# For all users in the organization, we generate the template context for the user, and send the email.
def user_subscribed_to_organization_reports(user, organization):
    return organization.id not in (
        UserOption.objects.get_value(user, key="reports:disabled-organizations")
        or []  # A small number of users have incorrect data stored
    )


def deliver_reports(ctx, dry_run=False):
    member_set = ctx.organization.member_set.filter(
        user_id__isnull=False, user__is_active=True
    ).exclude(flags=F("flags").bitor(OrganizationMember.flags["member-limit:restricted"]))

    for member in member_set:
        user = member.user
        if not user_subscribed_to_organization_reports(user, ctx.organization):
            return
        send_email(ctx, user, dry_run=dry_run)


project_breakdown_colors = ["#422C6E", "#895289", "#D6567F", "#F38150", "#F2B713"]
total_color = """
linear-gradient(
    -45deg,
    #ccc 25%,
    transparent 25%,
    transparent 50%,
    #ccc 50%,
    #ccc 75%,
    transparent 75%,
    transparent
);
"""
other_color = "#f2f0fa"
group_status_to_color = {
    GroupHistoryStatus.UNRESOLVED: "#FAD473",
    GroupHistoryStatus.RESOLVED: "#8ACBBC",
    GroupHistoryStatus.SET_RESOLVED_IN_RELEASE: "#8ACBBC",
    GroupHistoryStatus.SET_RESOLVED_IN_COMMIT: "#8ACBBC",
    GroupHistoryStatus.SET_RESOLVED_IN_PULL_REQUEST: "#8ACBBC",
    GroupHistoryStatus.AUTO_RESOLVED: "#8ACBBC",
    GroupHistoryStatus.IGNORED: "#DBD6E1",
    GroupHistoryStatus.UNIGNORED: "#FAD473",
    GroupHistoryStatus.ASSIGNED: "#FAAAAC",
    GroupHistoryStatus.UNASSIGNED: "#FAD473",
    GroupHistoryStatus.REGRESSED: "#FAAAAC",
    GroupHistoryStatus.DELETED: "#DBD6E1",
    GroupHistoryStatus.DELETED_AND_DISCARDED: "#DBD6E1",
    GroupHistoryStatus.REVIEWED: "#FAD473",
    GroupHistoryStatus.NEW: "#FAD473",
}


# Serialize ctx for template, and calculate view parameters (like graph bar heights)
def render_template_context(ctx, user):
    # Fetch the list of projects associated with the user.
    # Projects owned by teams that the user has membership of.
    if user and user.id in ctx.project_ownership:
        user_projects = list(
            filter(
                lambda project_ctx: project_ctx.project.id in ctx.project_ownership[user.id],
                ctx.projects.values(),
            )
        )
        if len(user_projects) == 0:
            return None
    else:
        # If user is None, or if the user is not a member of the organization, we assume that the email was directed to a user who joined all teams.
        user_projects = ctx.projects.values()

    # Render the first section of the email where we had the table showing the
    # number of accepted/dropped errors/transactions for each project.
    def trends():
        # Given an iterator of event counts, sum up their accepted/dropped errors/transaction counts.
        def sum_event_counts(project_ctxs):
            return reduce(
                lambda a, b: (a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3]),
                [
                    (
                        project_ctx.accepted_error_count,
                        project_ctx.dropped_error_count,
                        project_ctx.accepted_transaction_count,
                        project_ctx.dropped_transaction_count,
                    )
                    for project_ctx in project_ctxs
                ],
                (0, 0, 0, 0),
            )

        # Highest volume projects go first
        projects_associated_with_user = sorted(
            user_projects,
            reverse=True,
            key=lambda item: item.accepted_error_count * item.accepted_transaction_count,
        )
        # Calculate total
        (
            total_error,
            total_dropped_error,
            total_transaction,
            total_dropped_transaction,
        ) = sum_event_counts(projects_associated_with_user)
        # The number of reports to keep is the same as the number of colors
        # available to use in the legend.
        projects_taken = projects_associated_with_user[: len(project_breakdown_colors)]
        # All other items are merged to "Others"
        projects_not_taken = projects_associated_with_user[len(project_breakdown_colors) :]

        # Calculate legend
        legend = [
            {
                "slug": project_ctx.project.slug,
                "url": project_ctx.project.get_absolute_url(),
                "color": project_breakdown_colors[i],
                "dropped_error_count": project_ctx.dropped_error_count,
                "accepted_error_count": project_ctx.accepted_error_count,
                "dropped_transaction_count": project_ctx.dropped_transaction_count,
                "accepted_transaction_count": project_ctx.accepted_transaction_count,
            }
            for i, project_ctx in enumerate(projects_taken)
        ]

        if len(projects_not_taken) > 0:
            (
                others_error,
                others_dropped_error,
                others_transaction,
                others_dropped_transaction,
            ) = sum_event_counts(projects_not_taken)
            legend.append(
                {
                    "slug": f"Other ({len(projects_not_taken)})",
                    "color": other_color,
                    "dropped_error_count": others_dropped_error,
                    "accepted_error_count": others_error,
                    "dropped_transaction_count": others_dropped_transaction,
                    "accepted_transaction_count": others_transaction,
                }
            )
        if len(projects_taken) > 1:
            legend.append(
                {
                    "slug": f"Total ({len(projects_associated_with_user)})",
                    "color": total_color,
                    "dropped_error_count": total_dropped_error,
                    "accepted_error_count": total_error,
                    "dropped_transaction_count": total_dropped_transaction,
                    "accepted_transaction_count": total_transaction,
                }
            )

        # Calculate series
        series = []
        for i in range(0, 7):
            t = int(to_timestamp(ctx.start)) + ONE_DAY * i
            project_series = [
                {
                    "color": project_breakdown_colors[i],
                    "error_count": project_ctx.error_count_by_day.get(t, 0),
                    "transaction_count": project_ctx.transaction_count_by_day.get(t, 0),
                }
                for i, project_ctx in enumerate(projects_taken)
            ]
            if len(projects_not_taken) > 0:
                project_series.append(
                    {
                        "color": other_color,
                        "error_count": sum(
                            map(
                                lambda project_ctx: project_ctx.error_count_by_day.get(t, 0),
                                projects_not_taken,
                            )
                        ),
                        "transaction_count": sum(
                            map(
                                lambda project_ctx: project_ctx.transaction_count_by_day.get(t, 0),
                                projects_not_taken,
                            )
                        ),
                    }
                )
            series.append((to_datetime(t), project_series))
        return {
            "legend": legend,
            "series": series,
            "total_error_count": total_error,
            "total_transaction_count": total_transaction,
            "error_maximum": max(  # The max error count on any single day
                sum(value["error_count"] for value in values) for timestamp, values in series
            ),
            "transaction_maximum": max(  # The max transaction count on any single day
                sum(value["transaction_count"] for value in values) for timestamp, values in series
            )
            if len(projects_taken) > 0
            else 0,
        }

    def key_errors():
        def all_key_errors():
            for project_ctx in user_projects:
                for group, group_history, count in project_ctx.key_errors:
                    yield {
                        "count": count,
                        "group": group,
                        "status": group_history.get_status_display()
                        if group_history
                        else "Unresolved",
                        "status_color": group_status_to_color[group_history.status]
                        if group_history
                        else group_status_to_color[GroupHistoryStatus.NEW],
                    }

        return heapq.nlargest(3, all_key_errors(), lambda d: d["count"])

    def key_transactions():
        def all_key_transactions():
            for project_ctx in user_projects:
                for (
                    transaction_name,
                    count_this_week,
                    p95_this_week,
                    count_last_week,
                    p95_last_week,
                ) in project_ctx.key_transactions:
                    yield {
                        "name": transaction_name,
                        "count": count_this_week,
                        "p95": p95_this_week,
                        "p95_prev_week": p95_last_week,
                        "project": project_ctx.project,
                    }

        return heapq.nlargest(3, all_key_transactions(), lambda d: d["count"])

    def issue_summary():
        all_issue_count = 0
        existing_issue_count = 0
        reopened_issue_count = 0
        new_issue_count = 0
        for project_ctx in user_projects:
            all_issue_count += project_ctx.all_issue_count
            existing_issue_count += project_ctx.existing_issue_count
            reopened_issue_count += project_ctx.reopened_issue_count
            new_issue_count += project_ctx.new_issue_count
        return {
            "all_issue_count": all_issue_count,
            "existing_issue_count": existing_issue_count,
            "reopened_issue_count": reopened_issue_count,
            "new_issue_count": new_issue_count,
        }

    return {
        "organization": ctx.organization,
        "start": date_format(ctx.start),
        "end": date_format(ctx.end),
        "trends": trends(),
        "key_errors": key_errors(),
        "key_transactions": key_transactions(),
        "issue_summary": issue_summary(),
    }


def send_email(ctx, user, dry_run=False):
    template_ctx = render_template_context(ctx, user)
    if not template_ctx:
        return

    message = MessageBuilder(
        subject=f"Weekly Report for {ctx.organization.name}: {date_format(ctx.start)} - {date_format(ctx.end)}",
        template="sentry/emails/reports/new.txt",
        html_template="sentry/emails/reports/new.html",
        type="report.organization",
        context=template_ctx,
        headers={"X-SMTPAPI": json.dumps({"category": "organization_weekly_report"})},
    )
    message.add_users((user.id,))
    if not dry_run:
        message.send()
