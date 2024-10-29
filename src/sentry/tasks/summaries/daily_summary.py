import logging
import math
import zoneinfo
from collections import defaultdict
from datetime import datetime
from typing import cast

import sentry_sdk
from django.utils import timezone
from sentry_sdk import set_tag

from sentry import features
from sentry.constants import DataCategory
from sentry.integrations.types import ExternalProviders
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.organizationmember import OrganizationMember
from sentry.models.release import Release
from sentry.models.releases.release_project import ReleaseProject
from sentry.notifications.notifications.daily_summary import DailySummaryNotification
from sentry.notifications.services import notifications_service
from sentry.silo.base import SiloMode
from sentry.snuba.referrer import Referrer
from sentry.tasks.base import instrumented_task, retry
from sentry.tasks.summaries.utils import (
    COMPARISON_PERIOD,
    ONE_DAY,
    DailySummaryProjectContext,
    OrganizationReportContext,
    check_if_ctx_is_empty,
    fetch_key_error_groups,
    fetch_key_performance_issue_groups,
    project_event_counts_for_organization,
    project_key_errors,
    project_key_performance_issues,
    user_project_ownership,
)
from sentry.types.activity import ActivityType
from sentry.types.actor import Actor
from sentry.types.group import GroupSubStatus
from sentry.users.services.user.service import user_service
from sentry.users.services.user_option import user_option_service
from sentry.utils import json
from sentry.utils.dates import to_datetime
from sentry.utils.outcomes import Outcome
from sentry.utils.query import RangeQuerySetWrapper

logger = logging.getLogger(__name__)

HOUR_TO_SEND_REPORT = 16


# The entry point. This task is scheduled to run every day at 4pm PST.
@instrumented_task(
    name="sentry.tasks.summaries.daily_summary.schedule_organizations",
    queue="reports.prepare",
    max_retries=5,
    acks_late=True,
    silo_mode=SiloMode.REGION,
)
@retry
def schedule_organizations(timestamp: float | None = None, duration: int | None = None) -> None:
    if timestamp is None:
        # The time that the report was generated
        timestamp = timezone.now().timestamp()

    if duration is None:
        # The total timespan that the task covers
        duration = ONE_DAY

    organizations = Organization.objects.filter(status=OrganizationStatus.ACTIVE)
    for organization in RangeQuerySetWrapper(
        organizations, step=10000, result_value_getter=lambda item: item.id
    ):
        if features.has("organizations:daily-summary", organization):
            user_ids = {
                user_id
                for user_id in OrganizationMember.objects.filter(
                    organization_id=organization.id,
                    teams__projectteam__project__isnull=False,
                    user_id__isnull=False,
                ).values_list("user_id", flat=True)
            }
            if not user_ids:
                continue

            # TODO: convert timezones to UTC offsets and group
            users_by_tz = defaultdict(list)
            users_with_tz = user_option_service.get_many(
                filter=dict(user_ids=user_ids, key="timezone")
            )
            # if a user has not set a timezone, default to UTC
            users_without_tz = set(user_ids) - {
                user_option.user_id for user_option in users_with_tz
            }
            if users_with_tz:
                users_by_tz["UTC"] = list(users_without_tz)
            for user_option in users_with_tz:
                users_by_tz[user_option.value].append(user_option.user_id)

            # if it's ~4pm (btwn 4 and 5) for any of the users, generate the report for them
            users_to_send_to = []
            for user_tz, users in users_by_tz.items():
                utc_datetime = to_datetime(timestamp)
                local_timezone = zoneinfo.ZoneInfo(user_tz)
                local_datetime = utc_datetime.astimezone(local_timezone)
                if local_datetime.hour == HOUR_TO_SEND_REPORT:
                    for user in users:
                        users_to_send_to.append(user)

            if any(users_to_send_to):
                # Create a celery task per timezone
                prepare_summary_data.delay(timestamp, duration, organization.id, users_to_send_to)


@instrumented_task(
    name="sentry.tasks.summaries.daily_summary.prepare_summary_data",
    queue="reports.prepare",
    max_retries=5,
    acks_late=True,
    silo_mode=SiloMode.REGION,
)
@retry
def prepare_summary_data(
    timestamp: float,
    duration: int,
    organization_id: int,
    users_to_send_to: list[int],
):
    organization = Organization.objects.get(id=organization_id)
    ctx = build_summary_data(
        timestamp=timestamp, duration=duration, organization=organization, daily=True
    )
    with sentry_sdk.start_span(op="daily_summary.check_if_ctx_is_empty"):
        report_is_available = not check_if_ctx_is_empty(ctx)
    set_tag("report.available", report_is_available)
    if not report_is_available:
        logger.info("prepare_summary_data.skipping_empty", extra={"organization": organization.id})
        return

    with sentry_sdk.start_span(op="daily_summary.deliver_summary"):
        deliver_summary(ctx=ctx, users=users_to_send_to)


def build_summary_data(
    timestamp: float, duration: int, organization: Organization, daily: bool
) -> OrganizationReportContext:
    comparison_offset = ONE_DAY * COMPARISON_PERIOD + 1
    set_tag("org.slug", organization.slug)
    set_tag("org.id", organization.id)
    ctx = OrganizationReportContext(timestamp, duration, organization, daily=True)

    with sentry_sdk.start_span(op="daily_summary.user_project_ownership"):
        user_project_ownership(ctx)

    # build 'Today's Event Count vs. 14 day average'. we need 15 days of data for this
    start = to_datetime(ctx.end.timestamp() - comparison_offset)
    with sentry_sdk.start_span(op="daily_summary.project_event_counts_for_organization"):
        event_counts = project_event_counts_for_organization(
            start=start, end=ctx.end, ctx=ctx, referrer=Referrer.DAILY_SUMMARY_OUTCOMES.value
        )
        for data in event_counts:
            project_id = data["project_id"]
            # project no longer in organization, but events still exist
            if project_id not in ctx.projects_context_map:
                continue

            project_ctx = cast(DailySummaryProjectContext, ctx.projects_context_map[project_id])
            total = data["total"]
            if data["category"] == DataCategory.ERROR:
                if data["outcome"] == Outcome.ACCEPTED:
                    time = datetime.fromisoformat(data["time"])
                    if time.date() == ctx.end.date():
                        project_ctx.total_today = total
                    else:
                        project_ctx.comparison_period_total += total

    with sentry_sdk.start_span(op="daily_summary.project_passes"):
        for project in ctx.organization.project_set.all():
            project_id = project.id
            project_ctx = cast(DailySummaryProjectContext, ctx.projects_context_map[project_id])
            project_ctx.comparison_period_avg = math.ceil(
                project_ctx.comparison_period_total / COMPARISON_PERIOD
            )

            # Today's Top 3 Error Issues
            key_errors = project_key_errors(
                ctx=ctx, project=project, referrer=Referrer.DAILY_SUMMARY_KEY_ERRORS.value
            )
            if key_errors:
                project_ctx.key_errors_by_id = [
                    (e["events.group_id"], e["count()"]) for e in key_errors
                ]

            # Today's Top 3 Performance Issues
            key_performance_issues = project_key_performance_issues(
                ctx=ctx,
                project=project,
                referrer=Referrer.DAILY_SUMMARY_KEY_PERFORMANCE_ISSUES.value,
            )
            if key_performance_issues:
                project_ctx.key_performance_issues = key_performance_issues

            # Issues that escalated or regressed today
            regressed_or_escalated_groups = Group.objects.filter(
                project=project, substatus__in=(GroupSubStatus.ESCALATING, GroupSubStatus.REGRESSED)
            ).using_replica()
            regressed_or_escalated_groups_today = Activity.objects.filter(
                group__in=([group for group in regressed_or_escalated_groups]),
                type__in=(ActivityType.SET_REGRESSION.value, ActivityType.SET_ESCALATING.value),
                datetime__gte=ctx.start,
            )
            deduped_groups_by_activity_type: defaultdict[ActivityType, dict[Group, bool]]
            deduped_groups_by_activity_type = defaultdict(dict)

            for activity in regressed_or_escalated_groups_today:
                if activity.group is None:
                    continue

                deduped_groups_by_activity_type[ActivityType(activity.type)][activity.group] = True

                if (
                    activity.type == ActivityType.SET_ESCALATING.value
                    and activity.group
                    in deduped_groups_by_activity_type[ActivityType.SET_REGRESSION]
                ):
                    # if a group is already in the regressed set but we now see it in escalating, remove from regressed and add to escalating
                    # this means the group regressed and then later escalated, and we only want to list it once
                    del deduped_groups_by_activity_type[ActivityType.SET_REGRESSION][activity.group]

            for activity_type, groups in deduped_groups_by_activity_type.items():
                for group in list(groups)[:3]:
                    if activity_type == ActivityType.SET_REGRESSION:
                        project_ctx.regressed_today.append(group)
                    else:
                        project_ctx.escalated_today.append(group)

            # The project's releases and the (max) top 3 new errors e.g. release - group1, group2
            release_projects = ReleaseProject.objects.filter(project_id=project_id).values_list(
                "release_id", flat=True
            )
            releases = Release.objects.filter(id__in=release_projects, date_added__gte=ctx.end)
            for release in releases:
                if len(project_ctx.new_in_release) < 2:  # or whatever we limit this to
                    new_groups_in_release = Group.objects.filter(
                        project=project, first_release=release
                    )
                    if new_groups_in_release:
                        project_ctx.new_in_release[release.id] = [
                            group for group in new_groups_in_release
                        ][
                            :3
                        ]  # limit to 3 issues per release

            new_in_release = json.dumps([group for group in project_ctx.new_in_release])
            logger.info(
                "daily_summary.new_in_release",
                extra={
                    "organization": ctx.organization.id,
                    "project_id": project_id,
                    "new_in_release": new_in_release,
                },
            )
    with sentry_sdk.start_span(op="daily_summary.fetch_key_error_groups"):
        fetch_key_error_groups(ctx)

    with sentry_sdk.start_span(op="daily_summary.fetch_key_performance_issue_groups"):
        fetch_key_performance_issue_groups(ctx)

    return ctx


def build_top_projects_map(context: OrganizationReportContext, user_id: int):
    """
    Order the projects by which of the user's projects have the highest error count for the day
    """
    user_projects_context_map: dict[int, DailySummaryProjectContext] = {}
    projects_context_map = cast(dict[int, DailySummaryProjectContext], context.projects_context_map)
    for project in context.project_ownership[user_id]:
        user_projects_context_map[project] = projects_context_map[project]

    projects_by_error_total = {
        project_id: context.total_today for project_id, context in user_projects_context_map.items()
    }
    top_projects = [
        k
        for k, v in sorted(projects_by_error_total.items(), key=lambda item: item[1], reverse=True)
    ]
    top_projects_context_map = {}
    # for now, hard code to the top 2 projects
    for project in top_projects[:2]:
        project_context = user_projects_context_map[project]
        top_projects_context_map[project] = project_context

    return top_projects_context_map


def deliver_summary(ctx: OrganizationReportContext, users: list[int]):
    # TODO: change this to some setting for daily summary
    user_ids = notifications_service.get_users_for_weekly_reports(
        organization_id=ctx.organization.id, user_ids=users
    )
    for user_id in user_ids:
        top_projects_context_map = build_top_projects_map(ctx, user_id)
        user = cast(Actor, user_service.get_user(user_id=user_id))
        logger.info(
            "daily_summary.delivering_summary",
            extra={"user": user_id, "organization": ctx.organization.id},
        )
        DailySummaryNotification(
            organization=ctx.organization,
            recipient=user,
            provider=ExternalProviders.SLACK,
            project_context=top_projects_context_map,
        ).send()
