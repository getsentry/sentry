from collections import defaultdict
from datetime import datetime

from django.utils import timezone

from sentry.constants import DataCategory
from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.user import User
from sentry.services.hybrid_cloud.user_option import user_option_service
from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task, retry
from sentry.tasks.weekly_reports import (
    ONE_DAY,
    OrganizationReportContext,
    project_event_counts_for_organization,
    project_key_errors,
    project_key_performance_issues,
    user_project_ownership,
)
from sentry.utils.dates import floor_to_utc_day, to_datetime, to_timestamp
from sentry.utils.outcomes import Outcome
from sentry.utils.query import RangeQuerySetWrapper


# TODO refactor this to be reusable, this is copied from weekly.reports.py and slightly modified
# The entry point. This task is scheduled to run every day at 4pm PST.
@instrumented_task(
    name="sentry.tasks.daily_summary.schedule_organizations",
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
        timestamp = to_timestamp(floor_to_utc_day(timezone.now()))

    if duration is None:
        # The total timespan that the task covers
        duration = ONE_DAY

    organizations = Organization.objects.filter(status=OrganizationStatus.ACTIVE)
    for organization in RangeQuerySetWrapper(
        organizations, step=10000, result_value_getter=lambda item: item.id
    ):
        # Create a celery task per organization
        prepare_summary_data.delay(timestamp, duration, organization.id, dry_run=dry_run)


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
    dry_run: bool = False,
    target_user: User | None = None,
    email_override: str | None = None,
):
    organization = Organization.objects.get(id=organization_id)
    ctx = OrganizationReportContext(timestamp, duration, organization)
    user_project_ownership(ctx)
    # TODO: convert timezones to UTC offsets and group
    users_by_tz = defaultdict(list)
    uos = user_option_service.get_many(
        filter=dict(user_ids=list(ctx.project_ownership.keys()), key="timezone")
    )
    for uo in uos:
        users_by_tz[uo.value].append(uo.user_id)

    for tz in users_by_tz.keys():
        # build 'Today's Event Count vs. 14 day average'
        fourteen_days = ONE_DAY * 14
        start = to_datetime(timestamp - fourteen_days)
        # TODO: create new referrers, simply passing a new string seems to not work
        event_counts = project_event_counts_for_organization(
            start=start, end=ctx.end, org_id=ctx.organization.id, referrer="weekly_reports.outcomes"
        )
        # TODO: probably create another class like ProjectContext instead of putting this and project_data in dicts
        today_vs_fourteen_day_avg = {}
        for data in event_counts:
            project_id = data["project_id"]
            # Project no longer in organization, but events still exist
            if project_id not in ctx.projects:
                continue

            today_vs_fourteen_day_avg["project_id"] = {"total_today": 0, "14_day_avg": 0}

            total = data["total"]
            if data["category"] == DataCategory.ERROR:
                if data["outcome"] == Outcome.ACCEPTED:
                    time = datetime.fromisoformat(data["time"])
                    if time.date() == ctx.start.date():
                        today_vs_fourteen_day_avg["project_id"]["total_today"] = total
                    else:
                        # should today's count be included in this?
                        today_vs_fourteen_day_avg["project_id"]["14_day_avg"] += total

        # substatus_counts = organization_project_issue_substatus_summaries(start=ctx.start, end=ctx.end, org_id=ctx.organization.id)
        project_data = {}
        for project in organization.project_set.all():
            project_data[project.id] = {}
            # Today's Top 3 Error Issues
            key_errors = project_key_errors(
                start=ctx.start, end=ctx.end, project=project, referrer="reports.key_errors"
            )
            project_data[project.id]["key_errors"] = key_errors
            # Today's Top 3 Performance Issues
            key_performance_issues = project_key_performance_issues(
                start=ctx.start,
                end=ctx.end,
                project=project,
                referrer="reports.key_performance_issues",
            )
            project_data[project.id]["key_perf"] = key_performance_issues
    return project_data
