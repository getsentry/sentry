from __future__ import annotations

import heapq
import logging
import uuid
import zoneinfo
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from functools import partial
from typing import Any, Final

import sentry_sdk
from django.conf import settings
from django.db.models import F
from django.utils import dateformat, timezone
from sentry_redis_tools.clients import RedisCluster, StrictRedis
from sentry_sdk import set_tag

from sentry import analytics
from sentry.analytics.events.weekly_report import WeeklyReportSent
from sentry.models.group import Group, GroupStatus
from sentry.models.grouphistory import GroupHistoryStatus
from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.organizationmember import OrganizationMember
from sentry.notifications.services import notifications_service
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry
from sentry.tasks.summaries.metrics import (
    WeeklyReportHaltReason,
    WeeklyReportOperationType,
    WeeklyReportSLO,
)
from sentry.tasks.summaries.organization_report_context_factory import (
    OrganizationReportContextFactory,
)
from sentry.tasks.summaries.utils import ONE_DAY, OrganizationReportContext
from sentry.taskworker.namespaces import reports_tasks
from sentry.taskworker.retry import Retry
from sentry.taskworker.workerchild import ProcessingDeadlineExceeded
from sentry.types.group import GroupSubStatus
from sentry.users.services.user_option import user_option_service
from sentry.users.services.user_option.service import get_option_from_list
from sentry.utils import json, redis
from sentry.utils.dates import floor_to_utc_day, to_datetime
from sentry.utils.email import MessageBuilder
from sentry.utils.query import RangeQuerySetWrapper

date_format = partial(dateformat.format, format_string="F jS, Y")

logger = logging.getLogger(__name__)


@dataclass
class WeeklyReportProgressTracker:
    """
    This class is used to track the last processed org ID for a given
    weekly report. It can either be configured with an explicit start time and
    watermark TTL, or it will assume beginning of day, with a 7 day TTL.
    """

    beginning_of_day_timestamp: float
    duration: int
    _redis_connection: RedisCluster[str] | StrictRedis[str]

    REPORT_REDIS_CLIENT_KEY: Final[str] = "weekly_reports_org_id_min"

    def __init__(self, timestamp: float | None = None, duration: int | None = None):
        if timestamp is None:
            # The time that the report was generated
            timestamp = floor_to_utc_day(timezone.now()).timestamp()

        self.beginning_of_day_timestamp = timestamp

        if duration is None:
            # The total timespan that the task covers
            duration = ONE_DAY * 7

        self.duration = duration
        self._redis_connection = redis.redis_clusters.get(
            settings.SENTRY_WEEKLY_REPORTS_REDIS_CLUSTER
        )

    @property
    def min_org_id_redis_key(self) -> str:
        return f"{self.REPORT_REDIS_CLIENT_KEY}:{self.beginning_of_day_timestamp}"

    def get_last_processed_org_id(self) -> int | None:
        min_org_id_from_redis = self._redis_connection.get(self.min_org_id_redis_key)
        return int(min_org_id_from_redis) if min_org_id_from_redis else None

    def set_last_processed_org_id(self, org_id: int) -> None:
        self._redis_connection.set(self.min_org_id_redis_key, org_id)

    def delete_min_org_id(self) -> None:
        self._redis_connection.delete(self.min_org_id_redis_key)


# The entry point. This task is scheduled to run every week.
@instrumented_task(
    name="sentry.tasks.summaries.weekly_reports.schedule_organizations",
    namespace=reports_tasks,
    retry=Retry(times=5),
    processing_deadline_duration=timedelta(minutes=30),
    silo_mode=SiloMode.REGION,
)
@retry(timeouts=True)
def schedule_organizations(
    dry_run: bool = False, timestamp: float | None = None, duration: int | None = None
) -> None:
    batching = WeeklyReportProgressTracker(timestamp, duration)
    minimum_organization_id = batching.get_last_processed_org_id()

    organizations = Organization.objects.filter(status=OrganizationStatus.ACTIVE)

    with WeeklyReportSLO(
        operation_type=WeeklyReportOperationType.SCHEDULE_ORGANIZATION_REPORTS, dry_run=dry_run
    ).capture() as lifecycle:
        try:
            batch_id = str(uuid.uuid4())

            lifecycle.add_extras(
                {
                    "batch_id": batch_id,
                    "organization_starting_batch_id": minimum_organization_id,
                    "report_timestamp": batching.beginning_of_day_timestamp,
                }
            )
            for organization in RangeQuerySetWrapper(
                organizations,
                step=10000,
                result_value_getter=lambda item: item.id,
                min_id=minimum_organization_id,
            ):
                # Create a task per organization
                logger.info(
                    "weekly_reports.schedule_organizations",
                    extra={
                        "batch_id": str(batch_id),
                        "organization": organization.id,
                        "minimum_organization_id": minimum_organization_id,
                    },
                )
                prepare_organization_report.delay(
                    batching.beginning_of_day_timestamp,
                    batching.duration,
                    organization.id,
                    batch_id,
                    dry_run=dry_run,
                )
                batching.set_last_processed_org_id(organization.id)

            batching.delete_min_org_id()
        except ProcessingDeadlineExceeded:
            lifecycle.record_halt(WeeklyReportHaltReason.TIMEOUT)
            raise


# This task is launched per-organization.
@instrumented_task(
    name="sentry.tasks.summaries.weekly_reports.prepare_organization_report",
    namespace=reports_tasks,
    processing_deadline_duration=60 * 10,
    retry=Retry(times=5, delay=5),
    silo_mode=SiloMode.REGION,
)
@retry
def prepare_organization_report(
    timestamp: float,
    duration: int,
    organization_id: int,
    batch_id: str,
    dry_run: bool = False,
    target_user: int | None = None,
    email_override: str | None = None,
):
    batch_id = str(batch_id)
    if email_override and not isinstance(target_user, int):
        logger.error(
            "Target user must have an ID",
            extra={
                "batch_id": str(batch_id),
                "organization": organization_id,
                "target_user": target_user,
                "email_override": email_override,
            },
        )
        return
    organization = Organization.objects.get(id=organization_id)
    set_tag("org.slug", organization.slug)
    set_tag("org.id", organization_id)
    with WeeklyReportSLO(
        operation_type=WeeklyReportOperationType.PREPARE_ORGANIZATION_REPORT, dry_run=dry_run
    ).capture() as lifecycle:
        lifecycle.add_extras(
            {
                "batch_id": batch_id,
                "organization_id": organization_id,
                "timestamp": timestamp,
                "duration": duration,
            }
        )
        ctx = OrganizationReportContextFactory(
            timestamp=timestamp, duration=duration, organization=organization
        ).create_context()

        with sentry_sdk.start_span(op="weekly_reports.check_if_ctx_is_empty"):
            report_is_available = not ctx.is_empty()
        set_tag("report.available", report_is_available)

        if not report_is_available:
            lifecycle.record_halt(WeeklyReportHaltReason.EMPTY_REPORT)
            return

    # Finally, deliver the reports
    batch = OrganizationReportBatch(ctx, batch_id, dry_run, target_user, email_override)
    with sentry_sdk.start_span(op="weekly_reports.deliver_reports"):
        logger.info(
            "weekly_reports.deliver_reports",
            extra={"batch_id": str(batch_id), "organization": organization_id},
        )
        batch.deliver_reports()


@dataclass(frozen=True)
class OrganizationReportBatch:
    ctx: OrganizationReportContext
    batch_id: str

    dry_run: bool = False
    target_user: int | None = None
    email_override: str | None = None

    def deliver_reports(self) -> None:
        """
        For all users in the organization, we generate the template context for the user, and send the email.
        """
        if self.email_override:
            # if target user is None, generates report for a user with access to all projects
            user_template_context_by_user_id_list = prepare_template_context(
                ctx=self.ctx, user_ids=[self.target_user]
            )
            if user_template_context_by_user_id_list:
                self._send_to_user(user_template_context_by_user_id_list[0])
        else:
            user_list = list(
                OrganizationMember.objects.filter(
                    user_is_active=True,
                    organization_id=self.ctx.organization.id,
                )
                .filter(
                    flags=F("flags").bitand(~OrganizationMember.flags["member-limit:restricted"])
                )
                .values_list("user_id", flat=True)
            )
            user_list = [v for v in user_list if v is not None]
            user_ids = notifications_service.get_users_for_weekly_reports(
                organization_id=self.ctx.organization.id, user_ids=user_list
            )
            user_template_context_by_user_id_list = []
            if user_ids:
                user_template_context_by_user_id_list = prepare_template_context(
                    ctx=self.ctx, user_ids=user_ids
                )
            if user_template_context_by_user_id_list:
                for user_template in user_template_context_by_user_id_list:
                    self._send_to_user(user_template)

    def _send_to_user(self, user_template_context: Mapping[str, Any]) -> None:
        with WeeklyReportSLO(
            operation_type=WeeklyReportOperationType.SEND_EMAIL, dry_run=self.dry_run
        ).capture() as lifecycle:
            lifecycle.add_extras(
                {
                    "batch_id": self.batch_id,
                    "organization": self.ctx.organization.id,
                }
            )

            template_context: Mapping[str, Any] | None = user_template_context.get("context")
            user_id: int | None = user_template_context.get("user_id")

            lifecycle.add_extra("user_id", user_id)

            if template_context and user_id:
                dupe_check = _DuplicateDeliveryCheck(self, user_id, self.ctx.timestamp)
                if not dupe_check.check_for_duplicate_delivery():
                    self.send_email(template_ctx=template_context, user_id=user_id)
                    dupe_check.record_delivery()
                else:
                    lifecycle.record_halt(WeeklyReportHaltReason.DUPLICATE_DELIVERY)

    def send_email(self, template_ctx: Mapping[str, Any], user_id: int) -> None:
        # get user options timezone for this user, then format the timestamp according to the timezone
        local_start, local_end = get_local_dates(self.ctx, user_id)

        message = MessageBuilder(
            subject=f"Weekly Report for {self.ctx.organization.name}: {date_format(local_start)} - {date_format(local_end)}",
            template="sentry/emails/reports/body.txt",
            html_template="sentry/emails/reports/body.html",
            type="report.organization",
            context=template_ctx,
            headers={"X-SMTPAPI": json.dumps({"category": "organization_weekly_report"})},
        )
        if self.dry_run:
            return

        if self.email_override:
            message.send(to=(self.email_override,))
        else:
            try:
                analytics.record(
                    WeeklyReportSent(
                        user_id=user_id,
                        organization_id=self.ctx.organization.id,
                        notification_uuid=template_ctx["notification_uuid"],
                        user_project_count=template_ctx["user_project_count"],
                    )
                )
            except Exception as e:
                sentry_sdk.capture_exception(e)

            # TODO: see if we can use the UUID to track if the email was sent or not
            logger.info(
                "weekly_report.send_email",
                extra={
                    "batch_id": self.batch_id,
                    "organization": self.ctx.organization.id,
                    "uuid": template_ctx["notification_uuid"],
                    "user_id": user_id,
                },
            )

            message.add_users((user_id,))
            message.send_async()


class _DuplicateDeliveryCheck:
    def __init__(self, batch: OrganizationReportBatch, user_id: int, timestamp: float):
        self.batch = batch
        self.user_id = user_id
        # note that if the timestamps between batches cross a UTC day boundary,
        # this will not work correctly. but we always start reports at midnight UTC,
        # so that is unlikely to be an issue.
        self.report_date = datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d")

        # Tracks state from `check_for_duplicate_delivery` to `record_delivery`
        self.count: int | None = None

    def _get_redis_cluster(self) -> RedisCluster[str] | StrictRedis[str]:
        return redis.redis_clusters.get(settings.SENTRY_WEEKLY_REPORTS_REDIS_CLUSTER)

    @property
    def _redis_name(self) -> str:
        name_parts = (
            self.report_date,
            self.batch.ctx.organization.id,
            self.user_id,
        )
        return ":".join(str(part) for part in name_parts)

    def _get_log_extras(self) -> dict[str, Any]:
        return {
            "batch_id": str(self.batch.batch_id),
            "organization": self.batch.ctx.organization.id,
            "user_id": self.user_id,
            "has_email_override": bool(self.batch.email_override),
            "report_date": self.report_date,
        }

    def check_for_duplicate_delivery(self) -> bool:
        """Check whether this delivery has been recorded in Redis already."""
        if self.count is not None:
            raise ValueError("This object has already checked a delivery")
        cluster = self._get_redis_cluster()
        self.count = int(cluster.get(self._redis_name) or 0)

        is_duplicate_detected = self.count > 0
        if is_duplicate_detected:
            logger.error(
                "weekly_report.delivery_record.duplicate_detected", extra=self._get_log_extras()
            )
        return is_duplicate_detected

    def record_delivery(self) -> bool:
        """Record in Redis that the delivery was completed successfully."""
        if self.count is None:
            raise ValueError("This object has not had `check_for_duplicate_delivery` called yet")
        cluster = self._get_redis_cluster()
        count_after = cluster.incr(self._redis_name)
        cluster.expire(self._redis_name, timedelta(days=3))

        is_duplicate_detected = count_after > self.count + 1
        if is_duplicate_detected:
            # There is no lock for concurrency, which leaves open the possibility of
            # a race condition, in case another thread or server node received a
            # duplicate task somehow. But we do not think this is a likely
            # failure mode.
            #
            # Nonetheless, the `cluster.incr` operation is atomic, so if concurrent
            # duplicates are happening, this should reliably detect them after the fact.
            logger.error(
                "weekly_report.delivery_record.concurrent_detected", extra=self._get_log_extras()
            )
        return is_duplicate_detected


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


def get_local_dates(ctx: OrganizationReportContext, user_id: int) -> tuple[datetime, datetime]:
    user_tz = get_option_from_list(
        user_option_service.get_many(filter={"user_ids": [user_id], "keys": ["timezone"]}),
        key="timezone",
        default="UTC",
    )
    local_timezone = zoneinfo.ZoneInfo(user_tz)
    local_start = ctx.start.astimezone(local_timezone)
    local_end = ctx.end.astimezone(local_timezone)

    return (local_start, local_end)


def render_template_context(ctx, user_id: int | None) -> dict[str, Any] | None:
    # Serialize ctx for template, and calculate view parameters (like graph bar heights)
    # Fetch the list of projects associated with the user.
    # Projects owned by teams that the user has membership of.
    if user_id and user_id in ctx.project_ownership:
        user_projects = [
            project_ctx
            for project_ctx in ctx.projects_context_map.values()
            if project_ctx.project.id in ctx.project_ownership[user_id]
        ]
        if len(user_projects) == 0:
            return None
    else:
        return None

    notification_uuid = str(uuid.uuid4())
    local_start, local_end = get_local_dates(ctx, user_id)

    # Render the first section of the email where we had the table showing the
    # number of accepted/dropped errors/transactions for each project.
    def trends():
        # Given an iterator of event counts, sum up their accepted/dropped errors/transaction counts.
        def sum_event_counts(project_ctxs):
            event_counts = [
                (
                    project_ctx.accepted_error_count,
                    project_ctx.dropped_error_count,
                    project_ctx.accepted_transaction_count,
                    project_ctx.dropped_transaction_count,
                    project_ctx.accepted_replay_count,
                    project_ctx.dropped_replay_count,
                    project_ctx.accepted_log_count,
                    project_ctx.dropped_log_count,
                )
                for project_ctx in project_ctxs
            ]
            return tuple(sum(event[i] for event in event_counts) for i in range(8))

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
            total_logs,
            total_dropped_logs,
        ) = sum_event_counts(projects_associated_with_user)

        # The number of reports to keep is the same as the number of colors
        # available to use in the legend.
        projects_taken = projects_associated_with_user[: len(project_breakdown_colors)]
        # All other items are merged to "Others"
        projects_not_taken = projects_associated_with_user[len(project_breakdown_colors) :]

        # Calculate legend
        legend: list[dict[str, Any]] = [
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
                "dropped_log_count": project_ctx.dropped_log_count,
                "accepted_log_count": project_ctx.accepted_log_count,
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
                others_logs,
                others_dropped_logs,
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
                    "dropped_log_count": others_dropped_logs,
                    "accepted_log_count": others_logs,
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
                    "dropped_log_count": total_dropped_logs,
                    "accepted_log_count": total_logs,
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
                    "log_count": project_ctx.log_count_by_day.get(t, 0),
                }
                for i, project_ctx in enumerate(projects_taken)
            ]
            if len(projects_not_taken) > 0:
                project_series.append(
                    {
                        "color": other_color,
                        "error_count": sum(
                            project_ctx.error_count_by_day.get(t, 0)
                            for project_ctx in projects_not_taken
                        ),
                        "transaction_count": sum(
                            project_ctx.transaction_count_by_day.get(t, 0)
                            for project_ctx in projects_not_taken
                        ),
                        "replay_count": sum(
                            project_ctx.replay_count_by_day.get(t, 0)
                            for project_ctx in projects_not_taken
                        ),
                        "log_count": sum(
                            project_ctx.log_count_by_day.get(t, 0)
                            for project_ctx in projects_not_taken
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
            "total_log_count": total_logs,
            "error_maximum": max(  # The max error count on any single day
                sum(value["error_count"] for value in values) for timestamp, values in series
            ),
            "transaction_maximum": max(  # The max transaction count on any single day
                sum(value["transaction_count"] for value in values) for timestamp, values in series
            ),
            "replay_maximum": (
                max(  # The max replay count on any single day
                    sum(value["replay_count"] for value in values) for timestamp, values in series
                )
                if len(projects_taken) > 0
                else 0
            ),
            "log_maximum": (
                max(  # The max log count on any single day
                    sum(value["log_count"] for value in values) for timestamp, values in series
                )
                if len(projects_taken) > 0
                else 0
            ),
        }

    def key_errors():
        def all_key_errors():
            for project_ctx in user_projects:
                for group, count in project_ctx.key_errors_by_group:
                    (
                        substatus,
                        substatus_color,
                        substatus_border_color,
                    ) = get_group_status_badge(group)

                    yield {
                        "count": count,
                        "group": group,
                        "status": "Unresolved",
                        "status_color": (group_status_to_color[GroupHistoryStatus.NEW]),
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
                        "status": (
                            group_history.get_status_display() if group_history else "Unresolved"
                        ),
                        "status_color": (
                            group_status_to_color[group_history.status]
                            if group_history
                            else group_status_to_color[GroupHistoryStatus.NEW]
                        ),
                    }

        return heapq.nlargest(3, all_key_performance_issues(), lambda d: d["count"])

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

    def key_error_logs():
        def all_key_error_logs():
            for project_ctx in user_projects:
                for severity, message, count in project_ctx.key_error_logs:
                    yield {
                        "severity": severity,
                        "message": message,
                        "count": count,
                        "project": project_ctx.project,
                    }

        return heapq.nlargest(5, all_key_error_logs(), lambda d: d["count"])

    def log_volume_by_severity():
        error_count = 0
        fatal_count = 0
        warning_count = 0
        info_count = 0
        debug_count = 0
        for project_ctx in user_projects:
            error_count += project_ctx.log_volume_by_severity.get("error", 0)
            fatal_count += project_ctx.log_volume_by_severity.get("fatal", 0)
            warning_count += project_ctx.log_volume_by_severity.get("warning", 0)
            info_count += project_ctx.log_volume_by_severity.get("info", 0)
            debug_count += project_ctx.log_volume_by_severity.get("debug", 0)

        total = error_count + fatal_count + warning_count + info_count + debug_count
        return {
            "error_count": error_count,
            "fatal_count": fatal_count,
            "warning_count": warning_count,
            "info_count": info_count,
            "debug_count": debug_count,
            "total_count": total,
        }

    return {
        "organization": ctx.organization,
        "start": date_format(local_start),
        "end": date_format(local_end),
        "trends": trends(),
        "key_errors": key_errors(),
        "key_transactions": key_transactions(),
        "key_performance_issues": key_performance_issues(),
        "issue_summary": issue_summary(),
        "key_error_logs": key_error_logs(),
        "log_volume_by_severity": log_volume_by_severity(),
        "user_project_count": len(user_projects),
        "notification_uuid": notification_uuid,
    }


def prepare_template_context(
    ctx: OrganizationReportContext, user_ids: Sequence[int | None]
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
