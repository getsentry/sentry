import math
from collections import defaultdict
from datetime import datetime
from typing import cast

import sentry_sdk
from django.utils import timezone
from sentry_sdk import set_tag

from sentry import features
from sentry.constants import DataCategory
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.organizationmember import OrganizationMember
from sentry.models.release import Release, ReleaseProject
from sentry.services.hybrid_cloud.user_option import user_option_service
from sentry.silo import SiloMode
from sentry.snuba.referrer import Referrer
from sentry.tasks.base import instrumented_task, retry
from sentry.tasks.summaries.utils import (
    ONE_DAY,
    DailySummaryProjectContext,
    OrganizationReportContext,
    fetch_key_error_groups,
    fetch_key_performance_issue_groups,
    project_event_counts_for_organization,
    project_key_errors,
    project_key_performance_issues,
    user_project_ownership,
)
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus
from sentry.utils.dates import floor_to_utc_day, to_datetime, to_timestamp
from sentry.utils.outcomes import Outcome
from sentry.utils.query import RangeQuerySetWrapper


# The entry point. This task is scheduled to run every day at 4pm PST.
@instrumented_task(
    name="sentry.tasks.daily_summary.schedule_organizations",
    queue="reports.prepare",
    max_retries=5,
    acks_late=True,
    silo_mode=SiloMode.REGION,
)
@retry
def schedule_organizations(timestamp: float | None = None, duration: int | None = None) -> None:
    if timestamp is None:
        # The time that the report was generated
        timestamp = to_timestamp(floor_to_utc_day(timezone.now()))

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
                    organization_id=organization.id, teams__projectteam__project__isnull=False
                ).values_list("user_id", flat=True)
            }

            # TODO: convert timezones to UTC offsets and group
            users_by_tz = defaultdict(list)
            users_with_tz = user_option_service.get_many(
                filter=dict(user_ids=user_ids, key="timezone")
            )
            # if a user has not set a timezone, default to UTC
            users_without_tz = set(user_ids) - {uo.user_id for uo in users_with_tz}
            if users_with_tz:
                users_by_tz["UTC"] = list(users_without_tz)
            for uo in users_with_tz:
                users_by_tz[uo.value].append(uo.user_id)
            for tz in users_by_tz.keys():
                # Create a celery task per timezone
                prepare_summary_data(timestamp, duration, organization.id)


@instrumented_task(
    name="sentry.tasks.daily_summary.prepare_summary_data",
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
):
    # build 'Today's Event Count vs. 14 day average'. we need 15 days of data for this
    COMPARISON_PERIOD = 14
    comparison_offset = ONE_DAY * COMPARISON_PERIOD + 1
    organization = Organization.objects.get(id=organization_id)
    set_tag("org.slug", organization.slug)
    set_tag("org.id", organization_id)
    ctx = OrganizationReportContext(timestamp, duration, organization, daily=True)
    with sentry_sdk.start_span(op="daily_summary.user_project_ownership"):
        user_project_ownership(ctx)

    start = to_datetime(to_timestamp(ctx.end) - comparison_offset)
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
                project_ctx.key_errors = [(e["group_id"], e["count()"]) for e in key_errors]

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
                group__in=(regressed_or_escalated_groups),
                type__in=(ActivityType.SET_REGRESSION.value, ActivityType.SET_ESCALATING.value),
            )
            if regressed_or_escalated_groups_today:
                for activity in regressed_or_escalated_groups_today:
                    if activity.type == ActivityType.SET_REGRESSION.value:
                        project_ctx.regressed_today.append(activity.group)
                    else:
                        project_ctx.escalated_today.append(activity.group)

            # The project's releases and the (max) top 3 new errors e.g. release - group1, group2
            release_projects = ReleaseProject.objects.filter(project_id=project_id).values_list(
                "release_id", flat=True
            )
            releases = Release.objects.filter(
                id__in=release_projects, date_added__gte=ctx.end.date()
            )
            for release in releases[:2]:  # or whatever we limit this to
                new_groups_in_release = Group.objects.filter(project=project, first_release=release)
                if new_groups_in_release:
                    project_ctx.new_in_release = {
                        release.id: [group for group in new_groups_in_release]
                    }
    with sentry_sdk.start_span(op="daily_summary.fetch_key_error_groups"):
        fetch_key_error_groups(ctx)

    with sentry_sdk.start_span(op="daily_summary.fetch_key_performance_issue_groups"):
        fetch_key_performance_issue_groups(ctx)

    return ctx
