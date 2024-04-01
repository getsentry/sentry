from __future__ import annotations

import heapq
import logging
import uuid
from collections.abc import Mapping
from functools import partial, reduce
from typing import Any, cast

import sentry_sdk
from django.db.models import F
from django.utils import dateformat, timezone
from sentry_sdk import set_tag

from sentry import analytics, features
from sentry.constants import DataCategory
from sentry.models.group import Group, GroupStatus
from sentry.models.grouphistory import GroupHistoryStatus
from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.organizationmember import OrganizationMember
from sentry.models.user import User
from sentry.services.hybrid_cloud.notifications import notifications_service
from sentry.silo import SiloMode
from sentry.snuba.referrer import Referrer
from sentry.tasks.base import instrumented_task, retry
from sentry.tasks.summaries.utils import (
    ONE_DAY,
    OrganizationReportContext,
    ProjectContext,
    check_if_ctx_is_empty,
    fetch_key_error_groups,
    fetch_key_performance_issue_groups,
    organization_project_issue_substatus_summaries,
    project_event_counts_for_organization,
    project_key_errors,
    project_key_performance_issues,
    project_key_transactions_last_week,
    project_key_transactions_this_week,
    user_project_ownership,
)
from sentry.types.group import GroupSubStatus
from sentry.utils import json
from sentry.utils.dates import floor_to_utc_day, to_datetime
from sentry.utils.email import MessageBuilder
from sentry.utils.outcomes import Outcome
from sentry.utils.query import RangeQuerySetWrapper
from sentry.utils.snuba import parse_snuba_datetime

date_format = partial(dateformat.format, format_string="F jS, Y")

logger = logging.getLogger(__name__)


# The entry point. This task is scheduled to run every week.
@instrumented_task(
    name="sentry.tasks.summaries.weekly_reports.schedule_organizations",
    queue="reports.prepare",
    max_retries=5,
    acks_late=True,
    silo_mode=SiloMode.REGION,
)
@retry
def schedule_organizations(
    dry_run: bool = False, timestamp: float | None = None, duration: int | None = None
) -> None:
    if timestamp is None:
        # The time that the report was generated
        timestamp = floor_to_utc_day(timezone.now()).timestamp()

    if duration is None:
        # The total timespan that the task covers
        duration = ONE_DAY * 7

    organizations = Organization.objects.filter(status=OrganizationStatus.ACTIVE)
    for organization in RangeQuerySetWrapper(
        organizations, step=10000, result_value_getter=lambda item: item.id
    ):
        # Create a celery task per organization
        prepare_organization_report.delay(timestamp, duration, organization.id, dry_run=dry_run)


# This task is launched per-organization.
@instrumented_task(
    name="sentry.tasks.summaries.weekly_reports.prepare_organization_report",
    queue="reports.prepare",
    max_retries=5,
    acks_late=True,
    silo_mode=SiloMode.REGION,
)
@retry
def prepare_organization_report(
    timestamp: float,
    duration: int,
    organization_id: int,
    dry_run: bool = False,
    target_user: User | None = None,
    email_override: str | None = None,
):
    if target_user and not hasattr(target_user, "id"):
        logger.error(
            "Target user must have an ID",
            extra={
                "organization": organization_id,
                "target_user": target_user,
                "email_override": email_override,
            },
        )
        return
    organization = Organization.objects.get(id=organization_id)
    set_tag("org.slug", organization.slug)
    set_tag("org.id", organization_id)
    ctx = OrganizationReportContext(timestamp, duration, organization)

    # Run organization passes
    with sentry_sdk.start_span(op="weekly_reports.user_project_ownership"):
        user_project_ownership(ctx)
    with sentry_sdk.start_span(op="weekly_reports.project_event_counts_for_organization"):
        event_counts = project_event_counts_for_organization(
            start=ctx.start, end=ctx.end, ctx=ctx, referrer=Referrer.REPORTS_OUTCOMES.value
        )
        for data in event_counts:
            project_id = data["project_id"]
            # Project no longer in organization, but events still exist
            if project_id not in ctx.projects_context_map:
                continue
            project_ctx = cast(ProjectContext, ctx.projects_context_map[project_id])
            total = data["total"]
            timestamp = int(parse_snuba_datetime(data["time"]).timestamp())
            if data["category"] == DataCategory.TRANSACTION:
                # Transaction outcome
                if data["outcome"] == Outcome.RATE_LIMITED or data["outcome"] == Outcome.FILTERED:
                    project_ctx.dropped_transaction_count += total
                else:
                    project_ctx.accepted_transaction_count += total
                    project_ctx.transaction_count_by_day[timestamp] = total
            elif data["category"] == DataCategory.REPLAY:
                # Replay outcome
                if data["outcome"] == Outcome.RATE_LIMITED or data["outcome"] == Outcome.FILTERED:
                    project_ctx.dropped_replay_count += total
                else:
                    project_ctx.accepted_replay_count += total
                    project_ctx.replay_count_by_day[timestamp] = total
            else:
                # Error outcome
                if data["outcome"] == Outcome.RATE_LIMITED or data["outcome"] == Outcome.FILTERED:
                    project_ctx.dropped_error_count += total
                else:
                    project_ctx.accepted_error_count += total
                    project_ctx.error_count_by_day[timestamp] = (
                        project_ctx.error_count_by_day.get(timestamp, 0) + total
                    )

    with sentry_sdk.start_span(op="weekly_reports.organization_project_issue_substatus_summaries"):
        organization_project_issue_substatus_summaries(ctx)

    with sentry_sdk.start_span(op="weekly_reports.project_passes"):
        # Run project passes
        for project in organization.project_set.all():
            key_errors = project_key_errors(
                ctx, project, referrer=Referrer.REPORTS_KEY_ERRORS.value
            )
            if project.id not in ctx.projects_context_map:
                continue

            project_ctx = cast(ProjectContext, ctx.projects_context_map[project.id])
            if key_errors:
                group_id_alias = (
                    "events.group_id"
                    if features.has("organizations:snql-join-reports", project.organization)
                    else "group_id"
                )
                project_ctx.key_errors = [(e[group_id_alias], e["count()"]) for e in key_errors]

                if ctx.organization.slug == "sentry":
                    logger.info(
                        "project_key_errors.results",
                        extra={"project_id": project.id, "num_key_errors": len(key_errors)},
                    )
            key_transactions_this_week = project_key_transactions_this_week(ctx, project)
            if key_transactions_this_week:
                project_ctx.key_transactions = [
                    (i["transaction_name"], i["count"], i["p95"])
                    for i in key_transactions_this_week
                ]
                query_result = project_key_transactions_last_week(
                    ctx, project, key_transactions_this_week
                )
                # Join this week with last week
                last_week_data = {
                    i["transaction_name"]: (i["count"], i["p95"]) for i in query_result["data"]
                }

                project_ctx.key_transactions = [
                    (i["transaction_name"], i["count"], i["p95"])
                    + last_week_data.get(i["transaction_name"], (0, 0))
                    for i in key_transactions_this_week
                ]

            key_performance_issues = project_key_performance_issues(
                ctx, project, referrer=Referrer.REPORTS_KEY_PERFORMANCE_ISSUES.value
            )
            if key_performance_issues:
                ctx.projects_context_map[project.id].key_performance_issues = key_performance_issues

    with sentry_sdk.start_span(op="weekly_reports.fetch_key_error_groups"):
        fetch_key_error_groups(ctx)
    with sentry_sdk.start_span(op="weekly_reports.fetch_key_performance_issue_groups"):
        fetch_key_performance_issue_groups(ctx)

    with sentry_sdk.start_span(op="weekly_reports.check_if_ctx_is_empty"):
        report_is_available = not check_if_ctx_is_empty(ctx)
    set_tag("report.available", report_is_available)

    if not report_is_available:
        logger.info(
            "prepare_organization_report.skipping_empty", extra={"organization": organization_id}
        )
        return

    # Finally, deliver the reports
    with sentry_sdk.start_span(op="weekly_reports.deliver_reports"):
        deliver_reports(
            ctx, dry_run=dry_run, target_user=target_user, email_override=email_override
        )


def deliver_reports(
    ctx: OrganizationReportContext,
    dry_run: bool = False,
    target_user: User | None = None,
    email_override: str | None = None,
) -> None:
    """
    For all users in the organization, we generate the template context for the user, and send the email.
    """
    # Specify a sentry user to send this email.
    template_context: Mapping[str, Any] | None = None
    user_id: int | None = None

    if email_override:
        target_user_id = (
            target_user.id if target_user else None
        )  # if None, generates report for a user with access to all projects
        user_template_context_by_user_id_list = prepare_template_context(
            ctx=ctx, user_ids=[target_user_id]
        )
        if user_template_context_by_user_id_list:
            user_template_context_by_user_id = user_template_context_by_user_id_list[0]
            template_context = user_template_context_by_user_id.get("context")
            user_id = user_template_context_by_user_id.get("user_id")
            if template_context and user_id:
                send_email(
                    ctx=ctx,
                    template_ctx=template_context,
                    user_id=user_id,
                    dry_run=dry_run,
                    email_override=email_override,
                )
    else:
        user_list = list(
            OrganizationMember.objects.filter(
                user_is_active=True,
                organization_id=ctx.organization.id,
            )
            .filter(flags=F("flags").bitand(~OrganizationMember.flags["member-limit:restricted"]))
            .values_list("user_id", flat=True)
        )
        user_list = list(filter(lambda v: v is not None, user_list))
        user_ids = notifications_service.get_users_for_weekly_reports(
            organization_id=ctx.organization.id, user_ids=user_list
        )
        user_template_context_by_user_id_list = []
        for user_id in user_ids:
            user_template_context_by_user_id_list = prepare_template_context(
                ctx=ctx, user_ids=user_ids
            )
        if user_template_context_by_user_id_list:
            for user_template in user_template_context_by_user_id_list:
                template_context = user_template.get("context")
                user_id = user_template.get("user_id")
                if template_context and user_id:
                    send_email(
                        ctx=ctx, template_ctx=template_context, user_id=user_id, dry_run=dry_run
                    )


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
    GroupHistoryStatus.ESCALATING: "#FAD473",
    GroupHistoryStatus.ARCHIVED_UNTIL_ESCALATING: "#FAD473",
    GroupHistoryStatus.ARCHIVED_FOREVER: "#FAD473",
    GroupHistoryStatus.ARCHIVED_UNTIL_CONDITION_MET: "#FAD473",
    GroupHistoryStatus.PRIORITY_LOW: "#FAD473",
    GroupHistoryStatus.PRIORITY_MEDIUM: "#FAD473",
    GroupHistoryStatus.PRIORITY_HIGH: "#FAD473",
}


def get_group_status_badge(group: Group) -> tuple[str, str, str]:
    """
    Returns a tuple of (text, background_color, border_color)
    Should be similar to GroupStatusBadge.tsx in the frontend
    """
    if group.status == GroupStatus.RESOLVED:
        return ("Resolved", "rgba(108, 95, 199, 0.08)", "rgba(108, 95, 199, 0.5)")
    if group.status == GroupStatus.UNRESOLVED:
        if group.substatus == GroupSubStatus.NEW:
            return ("New", "rgba(245, 176, 0, 0.08)", "rgba(245, 176, 0, 0.55)")
        if group.substatus == GroupSubStatus.REGRESSED:
            return ("Regressed", "rgba(108, 95, 199, 0.08)", "rgba(108, 95, 199, 0.5)")
        if group.substatus == GroupSubStatus.ESCALATING:
            return ("Escalating", "rgba(245, 84, 89, 0.09)", "rgba(245, 84, 89, 0.5)")
    return ("Ongoing", "rgba(219, 214, 225, 1)", "rgba(219, 214, 225, 1)")


def render_template_context(ctx, user_id):
    # Serialize ctx for template, and calculate view parameters (like graph bar heights)
    # Fetch the list of projects associated with the user.
    # Projects owned by teams that the user has membership of.
    if user_id and user_id in ctx.project_ownership:
        user_projects = list(
            filter(
                lambda project_ctx: project_ctx.project.id in ctx.project_ownership[user_id],
                ctx.projects_context_map.values(),
            )
        )
        if len(user_projects) == 0:
            return None
    else:
        # If user is None, or if the user is not a member of the organization, we assume that the email was directed to a user who joined all teams.
        user_projects = ctx.projects_context_map.values()

    notification_uuid = str(uuid.uuid4())

    # Render the first section of the email where we had the table showing the
    # number of accepted/dropped errors/transactions for each project.
    def trends():
        # Given an iterator of event counts, sum up their accepted/dropped errors/transaction counts.
        def sum_event_counts(project_ctxs):
            return reduce(
                lambda a, b: (
                    a[0] + b[0],
                    a[1] + b[1],
                    a[2] + b[2],
                    a[3] + b[3],
                    a[4] + b[4],
                    a[5] + b[5],
                ),
                [
                    (
                        project_ctx.accepted_error_count,
                        project_ctx.dropped_error_count,
                        project_ctx.accepted_transaction_count,
                        project_ctx.dropped_transaction_count,
                        project_ctx.accepted_replay_count,
                        project_ctx.dropped_replay_count,
                    )
                    for project_ctx in project_ctxs
                ],
                (0, 0, 0, 0, 0, 0),
            )

        # Highest volume projects go first
        projects_associated_with_user = sorted(
            user_projects,
            reverse=True,
            key=lambda item: item.accepted_error_count + (item.accepted_transaction_count / 10),
        )
        # Calculate total
        (
            total_error,
            total_dropped_error,
            total_transaction,
            total_dropped_transaction,
            total_replays,
            total_dropped_replays,
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
                "url": project_ctx.project.get_absolute_url(
                    params={"referrer": "weekly_report", "notification_uuid": notification_uuid}
                ),
                "color": project_breakdown_colors[i],
                "dropped_error_count": project_ctx.dropped_error_count,
                "accepted_error_count": project_ctx.accepted_error_count,
                "dropped_transaction_count": project_ctx.dropped_transaction_count,
                "accepted_transaction_count": project_ctx.accepted_transaction_count,
                "dropped_replay_count": project_ctx.dropped_replay_count,
                "accepted_replay_count": project_ctx.accepted_replay_count,
            }
            for i, project_ctx in enumerate(projects_taken)
        ]

        if len(projects_not_taken) > 0:
            (
                others_error,
                others_dropped_error,
                others_transaction,
                others_dropped_transaction,
                others_replays,
                others_dropped_replays,
            ) = sum_event_counts(projects_not_taken)
            legend.append(
                {
                    "slug": f"Other ({len(projects_not_taken)})",
                    "color": other_color,
                    "dropped_error_count": others_dropped_error,
                    "accepted_error_count": others_error,
                    "dropped_transaction_count": others_dropped_transaction,
                    "accepted_transaction_count": others_transaction,
                    "dropped_replay_count": others_dropped_replays,
                    "accepted_replay_count": others_replays,
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
                    "dropped_replay_count": total_dropped_replays,
                    "accepted_replay_count": total_replays,
                }
            )

        # Calculate series
        series = []
        for i in range(0, 7):
            t = int(ctx.start.timestamp()) + ONE_DAY * i
            project_series = [
                {
                    "color": project_breakdown_colors[i],
                    "error_count": project_ctx.error_count_by_day.get(t, 0),
                    "transaction_count": project_ctx.transaction_count_by_day.get(t, 0),
                    "replay_count": project_ctx.replay_count_by_day.get(t, 0),
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
                        "replay_count": sum(
                            map(
                                lambda project_ctx: project_ctx.replay_count_by_day.get(t, 0),
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
            "total_replay_count": total_replays,
            "error_maximum": max(  # The max error count on any single day
                sum(value["error_count"] for value in values) for timestamp, values in series
            ),
            "transaction_maximum": max(  # The max transaction count on any single day
                sum(value["transaction_count"] for value in values) for timestamp, values in series
            ),
            "replay_maximum": max(  # The max replay count on any single day
                sum(value["replay_count"] for value in values) for timestamp, values in series
            )
            if len(projects_taken) > 0
            else 0,
        }

    def key_errors():
        # TODO(Steve): Remove debug logging for Sentry
        def all_key_errors():
            if ctx.organization.slug == "sentry":
                logger.info(
                    "render_template_context.all_key_errors.num_projects",
                    extra={
                        "user_id": user_id if user_id else "",
                        "num_user_projects": len(user_projects),
                    },
                )
            for project_ctx in user_projects:
                if ctx.organization.slug == "sentry":
                    logger.info(
                        "render_template_context.all_key_errors.project",
                        extra={
                            "user_id": user_id,
                            "project_id": project_ctx.project.id,
                        },
                    )
                for group, group_history, count in project_ctx.key_errors:
                    if ctx.organization.slug == "sentry":
                        logger.info(
                            "render_template_context.all_key_errors.found_error",
                            extra={
                                "group_id": group.id,
                                "user_id": user_id,
                                "project_id": project_ctx.project.id,
                            },
                        )

                    (
                        substatus,
                        substatus_color,
                        substatus_border_color,
                    ) = get_group_status_badge(group)

                    yield {
                        "count": count,
                        "group": group,
                        "status": group_history.get_status_display()
                        if group_history
                        else "Unresolved",
                        "status_color": group_status_to_color[group_history.status]
                        if group_history
                        else group_status_to_color[GroupHistoryStatus.NEW],
                        "group_substatus": substatus,
                        "group_substatus_color": substatus_color,
                        "group_substatus_border_color": substatus_border_color,
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

    def key_performance_issues():
        def all_key_performance_issues():
            for project_ctx in user_projects:
                for group, group_history, count in project_ctx.key_performance_issues:
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

        return heapq.nlargest(3, all_key_performance_issues(), lambda d: d["count"])

    def key_replays():
        return []

    def issue_summary():
        new_substatus_count = 0
        escalating_substatus_count = 0
        ongoing_substatus_count = 0
        regression_substatus_count = 0
        total_substatus_count = 0
        for project_ctx in user_projects:
            new_substatus_count += project_ctx.new_substatus_count
            escalating_substatus_count += project_ctx.escalating_substatus_count
            ongoing_substatus_count += project_ctx.ongoing_substatus_count
            regression_substatus_count += project_ctx.regression_substatus_count
            total_substatus_count += project_ctx.total_substatus_count
        return {
            "new_substatus_count": new_substatus_count,
            "escalating_substatus_count": escalating_substatus_count,
            "ongoing_substatus_count": ongoing_substatus_count,
            "regression_substatus_count": regression_substatus_count,
            "total_substatus_count": total_substatus_count,
        }

    return {
        "organization": ctx.organization,
        "start": date_format(ctx.start),
        "end": date_format(ctx.end),
        "trends": trends(),
        "key_errors": key_errors(),
        "key_transactions": key_transactions(),
        "key_performance_issues": key_performance_issues(),
        "issue_summary": issue_summary(),
        "user_project_count": len(user_projects),
        "notification_uuid": notification_uuid,
    }


def prepare_template_context(
    ctx: OrganizationReportContext, user_ids: list[int]
) -> list[Mapping[str, Any]] | list:
    user_template_context_by_user_id_list = []
    for user_id in user_ids:
        template_ctx = render_template_context(ctx, user_id)
        if not template_ctx:
            logger.debug(
                "Skipping report for %s to <User: %s>, no qualifying reports to deliver.",
                ctx.organization.id,
                user_id,
            )
            continue
        user_template_context_by_user_id_list.append({"context": template_ctx, "user_id": user_id})
    return user_template_context_by_user_id_list


def send_email(
    ctx: OrganizationReportContext,
    template_ctx: Mapping[str, Any],
    user_id: int,
    dry_run: bool = False,
    email_override: str | None = None,
) -> None:
    message = MessageBuilder(
        subject=f"Weekly Report for {ctx.organization.name}: {date_format(ctx.start)} - {date_format(ctx.end)}",
        template="sentry/emails/reports/body.txt",
        html_template="sentry/emails/reports/body.html",
        type="report.organization",
        context=template_ctx,
        headers={"X-SMTPAPI": json.dumps({"category": "organization_weekly_report"})},
    )
    if dry_run:
        return

    if email_override:
        message.send(to=(email_override,))
    else:
        analytics.record(
            "weekly_report.sent",
            user_id=user_id,
            organization_id=ctx.organization.id,
            notification_uuid=template_ctx["notification_uuid"],
            user_project_count=template_ctx["user_project_count"],
        )
        message.add_users((user_id,))
        message.send_async()
