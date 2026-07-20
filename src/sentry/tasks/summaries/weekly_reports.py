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
from urllib.parse import urlencode

import sentry_sdk
from django.conf import settings
from django.db.models import F
from django.utils import dateformat, timezone
from sentry_redis_tools.clients import RedisCluster, StrictRedis
from taskbroker_client.retry import Retry
from taskbroker_client.worker.workerchild import ProcessingDeadlineExceeded

from sentry import analytics, features
from sentry.analytics.events.weekly_report import WeeklyReportSent
from sentry.models.group import Group, GroupStatus
from sentry.models.grouphistory import GroupHistoryStatus
from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.organizationmember import OrganizationMember
from sentry.models.weeklyreportprojectexclusion import WeeklyReportProjectExclusion
from sentry.notifications.services import notifications_service
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.tasks.summaries.metrics import (
    WeeklyReportHaltReason,
    WeeklyReportOperationType,
    WeeklyReportSLO,
)
from sentry.tasks.summaries.organization_report_context_factory import (
    OrganizationReportContextFactory,
)
from sentry.tasks.summaries.utils import (
    ONE_DAY,
    PAST_ISSUES_LINK_BOOST,
    OrganizationReportContext,
    ProjectContext,
)
from sentry.tasks.summaries.weekly_report_cache import cache_project_metrics
from sentry.taskworker.namespaces import reports_tasks
from sentry.types.group import GroupSubStatus
from sentry.users.services.user_option import user_option_service
from sentry.users.services.user_option.service import get_option_from_list
from sentry.utils import json, metrics, redis
from sentry.utils.dates import floor_to_utc_day, to_datetime
from sentry.utils.email import MessageBuilder
from sentry.utils.email.sanitize import sanitize_outbound_name
from sentry.utils.query import RangeQuerySetWrapper
from sentry.utils.tracing import set_span_tag, start_span

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
    retry=Retry(
        times=5,
        on=(
            Exception,
            ProcessingDeadlineExceeded,
        ),
    ),
    processing_deadline_duration=timedelta(minutes=30),
    silo_mode=SiloMode.CELL,
)
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
                metrics.incr("weekly_report.organization.scheduled")
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
    retry=Retry(times=5, delay=5, on=(Exception,)),
    silo_mode=SiloMode.CELL,
)
def prepare_organization_report(
    timestamp: float,
    duration: int,
    organization_id: int,
    batch_id: str,
    dry_run: bool = False,
    target_user: int | None = None,
    email_override: str | None = None,
):
    with start_span(
        name="weekly_reports.prepare_organization_report",
        op="weekly_reports.prepare_organization_report",
        transaction=True,
        custom_sampling_context={"sample_rate": 0.1 * settings.SENTRY_BACKEND_APM_SAMPLING},
    ) as span:
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
        set_span_tag(span, "org.slug", organization.slug)
        sentry_sdk.set_attribute("org.slug", organization.slug)
        set_span_tag(span, "org.id", organization_id)
        sentry_sdk.set_attribute("org.id", organization_id)
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

            with start_span(
                op="weekly_reports.check_if_ctx_is_empty",
                name="weekly_reports.check_if_ctx_is_empty",
            ):
                report_is_available = not ctx.is_empty()
            set_span_tag(span, "report.available", report_is_available)
            sentry_sdk.set_attribute("report.available", report_is_available)

            if not report_is_available:
                lifecycle.record_halt(WeeklyReportHaltReason.EMPTY_REPORT)
                return

        # Deliver the reports
        batch = OrganizationReportBatch(ctx, batch_id, dry_run, target_user, email_override)
        with start_span(op="weekly_reports.deliver_reports", name="weekly_reports.deliver_reports"):
            logger.info(
                "weekly_reports.deliver_reports",
                extra={"batch_id": str(batch_id), "organization": organization_id},
            )
            with metrics.timer("weekly_report.deliver_reports.duration"):
                batch.deliver_reports()

        # Cache after delivery so a failed attempt doesn't poison the
        # previous-week lookup on retry.
        if (
            not dry_run
            and not email_override
            and features.has("organizations:weekly-report-week-over-week-metric", ctx.organization)
        ):
            try:
                project_metrics: dict[int, dict[str, int]] = {}
                for project_id, project_ctx in ctx.projects_context_map.items():
                    project_metrics[project_id] = {
                        "e": project_ctx.accepted_error_count,
                        "i": project_ctx.total_substatus_count,
                    }
                if project_metrics:
                    cache_project_metrics(organization_id, project_metrics)
            except Exception:
                sentry_sdk.capture_exception()


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
            metrics.distribution(
                "weekly_report.deliver_reports.org_member_count",
                len(user_list),
            )
            user_ids = notifications_service.get_users_for_weekly_reports(
                organization_id=self.ctx.organization.id, user_ids=user_list
            )
            metrics.distribution(
                "weekly_report.deliver_reports.eligible_user_count",
                len(user_ids),
            )
            filtered_by_preference = len(user_list) - len(user_ids)
            if filtered_by_preference > 0:
                metrics.incr(
                    "weekly_report.user.filtered",
                    amount=filtered_by_preference,
                    tags={"reason": "notification_preference"},
                )
            user_template_context_by_user_id_list = []
            if user_ids:
                user_template_context_by_user_id_list = prepare_template_context(
                    ctx=self.ctx, user_ids=user_ids
                )
                skipped_no_projects = len(user_ids) - len(user_template_context_by_user_id_list)
                if skipped_no_projects > 0:
                    metrics.incr(
                        "weekly_report.user.filtered",
                        amount=skipped_no_projects,
                        tags={"reason": "no_project_access"},
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
                # Admin sends (email_override) bypass duplicate detection so
                # support/debugging re-sends always go through.
                if self.email_override:
                    self.send_email(template_ctx=template_context, user_id=user_id)
                else:
                    dupe_check = _DuplicateDeliveryCheck(self, user_id, self.ctx.timestamp)
                    if not dupe_check.check_for_duplicate_delivery():
                        was_sent = self.send_email(template_ctx=template_context, user_id=user_id)

                        # Record delivery if email was sent successfully
                        if was_sent:
                            dupe_check.record_delivery()
                    else:
                        lifecycle.record_halt(WeeklyReportHaltReason.DUPLICATE_DELIVERY)
                        metrics.incr("weekly_report.email.skipped", tags={"reason": "duplicate"})

    def send_email(self, template_ctx: Mapping[str, Any], user_id: int) -> bool:
        local_start, local_end = get_local_dates(self.ctx, user_id)

        message = MessageBuilder(
            subject=f"Weekly Report for {sanitize_outbound_name(self.ctx.organization.name)}: {date_format(local_start)} - {date_format(local_end)}",
            template="sentry/emails/reports/body.txt",
            html_template="sentry/emails/reports/body.html",
            type="report.organization",
            context=template_ctx,
            headers={"X-SMTPAPI": json.dumps({"category": "organization_weekly_report"})},
        )
        # Admin sends (email_override) always deliver the email regardless of
        # dry_run so the admin tool is useful for debugging.  The dry_run
        # script (schedule_organizations) never sets email_override.
        if self.dry_run and not self.email_override:
            metrics.incr("weekly_report.email.skipped", tags={"reason": "dry_run"})
            return False

        if self.email_override:
            message.send(to=(self.email_override,))
            metrics.incr("weekly_report.email.sent")
            return True
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
            if message._send_to:
                message.send_async()
                metrics.incr("weekly_report.email.sent")
                return True
            else:
                metrics.incr("weekly_report.email.skipped", tags={"reason": "no_email"})
                return False


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


project_breakdown_colors = ["#7553FF", "#3A1873", "#F0369A", "#FF9838", "#FFD00E"]
total_color = """
linear-gradient(
    -45deg,
    #A29FAA 25%,
    transparent 25%,
    transparent 50%,
    #A29FAA 50%,
    #A29FAA 75%,
    transparent 75%,
    transparent
);
"""
other_color = "#DAD9DE"
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


def _pct_change(current: int, previous: int) -> dict[str, str] | None:
    if previous == 0:
        return None
    change = (current - previous) / previous
    pct = round(change * 100)
    if pct == 0:
        return {"arrow": "", "pct": "—0%", "bg_color": "#F0F0F2", "text_color": "#80708F"}
    if change > 0:
        return {"arrow": "↑", "pct": f"{abs(pct)}%", "bg_color": "#F9F0D2", "text_color": "#A45200"}
    return {"arrow": "↓", "pct": f"{abs(pct)}%", "bg_color": "#E3F7E3", "text_color": "#008900"}


def get_group_status_badge(group: Group) -> tuple[str, str, str]:
    """
    Returns a tuple of (text, background_color, text_color)
    Matches frontend Tag component: background.transparent.*.muted blended on white, content.* text.
    """
    if group.status == GroupStatus.RESOLVED:
        return ("Resolved", "#E3F7E3", "#008900")
    if group.status == GroupStatus.UNRESOLVED:
        if group.substatus == GroupSubStatus.NEW:
            return ("New", "#F9F0D2", "#A45200")
        if group.substatus == GroupSubStatus.REGRESSED:
            return ("Regressed", "#EDEEFE", "#653DE9")
        if group.substatus == GroupSubStatus.ESCALATING:
            return ("Escalating", "#FEE7E4", "#D50000")
    return ("Ongoing", "#F0F0F2", "#6A6772")


def get_group_display(group: Group) -> dict[str, str]:
    metadata = group.get_event_metadata()
    event_type = group.get_event_type()
    custom_title = metadata.get("title")

    if event_type == "error":
        title = (
            custom_title
            if custom_title and custom_title != "<unlabeled event>"
            else metadata.get("type") or metadata.get("function") or "<unknown>"
        )
        message = metadata.get("value")
    elif event_type in ("transaction", "generic"):
        title = custom_title or group.title
        message = metadata.get("value")
    elif event_type == "csp":
        title = custom_title or metadata.get("directive") or ""
        message = metadata.get("message")
    else:
        title = custom_title or group.title
        message = group.culprit

    return {
        "title": title,
        "message": message or group.message or "",
    }


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


def render_template_context(
    ctx,
    user_id: int | None,
    excluded_project_ids: set[int] | None = None,
) -> dict[str, Any] | None:
    # Serialize ctx for template, and calculate view parameters (like graph bar heights)
    # Fetch the list of projects associated with the user.
    # Projects owned by teams that the user has membership of.
    if user_id and user_id in ctx.project_ownership:
        user_projects = [
            project_ctx
            for project_ctx in ctx.projects_context_map.values()
            if project_ctx.project.id in ctx.project_ownership[user_id]
            and (excluded_project_ids is None or project_ctx.project.id not in excluded_project_ids)
        ]
        if len(user_projects) == 0:
            return None
    else:
        return None

    notification_uuid = str(uuid.uuid4())
    local_start, local_end = get_local_dates(ctx, user_id)

    # Render the first section of the email where we had the table showing the
    # number of errors, new/escalating/regressed issues for each project.
    def _substatus_url(project_ctx: ProjectContext, query: str) -> str:
        return project_ctx.project.get_absolute_url(
            params={
                "referrer": "weekly_report",
                "notification_uuid": notification_uuid,
                "query": query,
            }
        )

    def _multi_project_substatus_url(project_ctxs: list[ProjectContext], query: str) -> str:
        path = f"/organizations/{ctx.organization.slug}/issues/"
        params = [
            ("referrer", "weekly_report"),
            ("notification_uuid", notification_uuid),
            ("query", query),
        ]
        for pc in project_ctxs:
            params.append(("project", pc.project.id))
        return ctx.organization.absolute_url(path, query=urlencode(params))

    def trends():
        # Given an iterator of event counts, sum up their accepted errors/transaction counts.
        def sum_error_counts(project_ctxs):
            return sum(project_ctx.accepted_error_count for project_ctx in project_ctxs)

        # Highest volume projects go first
        projects_associated_with_user = sorted(
            user_projects,
            reverse=True,
            key=lambda item: item.accepted_error_count,
        )
        # Calculate total
        total_error = sum_error_counts(projects_associated_with_user)

        # The number of reports to keep is the same as the number of colors
        # available to use in the legend.
        projects_taken = projects_associated_with_user[: len(project_breakdown_colors)]
        # All other items are merged to "Others"
        projects_not_taken = projects_associated_with_user[len(project_breakdown_colors) :]

        total_issue = sum(p.total_substatus_count for p in projects_associated_with_user)

        # Calculate legend
        legend: list[dict[str, Any]] = [
            {
                "slug": project_ctx.project.slug,
                "url": project_ctx.project.get_absolute_url(
                    params={"referrer": "weekly_report", "notification_uuid": notification_uuid}
                ),
                "color": project_breakdown_colors[i],
                "accepted_error_count": project_ctx.accepted_error_count,
                "new_substatus_count": project_ctx.new_substatus_count,
                "new_substatus_url": _substatus_url(project_ctx, "is:new"),
                "escalating_substatus_count": project_ctx.escalating_substatus_count,
                "escalating_substatus_url": _substatus_url(project_ctx, "is:escalating"),
                "regression_substatus_count": project_ctx.regression_substatus_count,
                "regression_substatus_url": _substatus_url(project_ctx, "is:regressed"),
            }
            for i, project_ctx in enumerate(projects_taken)
        ]

        if len(projects_not_taken) > 0:
            others_error = sum_error_counts(projects_not_taken)
            legend.append(
                {
                    "slug": f"Other ({len(projects_not_taken)})",
                    "color": other_color,
                    "accepted_error_count": others_error,
                    "new_substatus_count": sum(p.new_substatus_count for p in projects_not_taken),
                    "new_substatus_url": _multi_project_substatus_url(projects_not_taken, "is:new"),
                    "escalating_substatus_count": sum(
                        p.escalating_substatus_count for p in projects_not_taken
                    ),
                    "escalating_substatus_url": _multi_project_substatus_url(
                        projects_not_taken, "is:escalating"
                    ),
                    "regression_substatus_count": sum(
                        p.regression_substatus_count for p in projects_not_taken
                    ),
                    "regression_substatus_url": _multi_project_substatus_url(
                        projects_not_taken, "is:regressed"
                    ),
                }
            )
        if len(projects_taken) > 1:
            legend.append(
                {
                    "slug": f"Total ({len(projects_associated_with_user)})",
                    "color": total_color,
                    "accepted_error_count": total_error,
                    "new_substatus_count": sum(
                        p.new_substatus_count for p in projects_associated_with_user
                    ),
                    "new_substatus_url": _multi_project_substatus_url(
                        projects_associated_with_user, "is:new"
                    ),
                    "escalating_substatus_count": sum(
                        p.escalating_substatus_count for p in projects_associated_with_user
                    ),
                    "escalating_substatus_url": _multi_project_substatus_url(
                        projects_associated_with_user, "is:escalating"
                    ),
                    "regression_substatus_count": sum(
                        p.regression_substatus_count for p in projects_associated_with_user
                    ),
                    "regression_substatus_url": _multi_project_substatus_url(
                        projects_associated_with_user, "is:regressed"
                    ),
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
                    "issue_count": project_ctx.issue_count_by_day.get(t, 0),
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
                        "issue_count": sum(
                            project_ctx.issue_count_by_day.get(t, 0)
                            for project_ctx in projects_not_taken
                        ),
                    }
                )
            series.append((to_datetime(t), project_series))
        prev_week_error = sum(
            p.prev_week_accepted_error_count for p in projects_associated_with_user
        )
        prev_week_issue = sum(
            p.prev_week_total_substatus_count for p in projects_associated_with_user
        )

        return {
            "legend": legend,
            "series": series,
            "total_error_count": total_error,
            "total_issue_count": total_issue,
            "error_pct_change": _pct_change(total_error, prev_week_error),
            "issue_pct_change": _pct_change(total_issue, prev_week_issue),
            "error_maximum": max(  # The max error count on any single day
                sum(value["error_count"] for value in values) for timestamp, values in series
            ),
            "issue_maximum": max(  # The max issue count on any single day
                sum(value["issue_count"] for value in values) for timestamp, values in series
            ),
        }

    def top_issues():
        def all_issues():
            for project_ctx in user_projects:
                for group, count in project_ctx.key_error_issues:
                    display = get_group_display(group)
                    (
                        substatus,
                        substatus_color,
                        substatus_text_color,
                    ) = get_group_status_badge(group)

                    yield {
                        "count": count,
                        "group": group,
                        "title": display["title"],
                        "message": display["message"],
                        "status": "Unresolved",
                        "status_color": (group_status_to_color[GroupHistoryStatus.NEW]),
                        "group_substatus": substatus,
                        "group_substatus_color": substatus_color,
                        "group_substatus_text_color": substatus_text_color,
                    }

                for group, group_history, count in project_ctx.key_performance_issues:
                    display = get_group_display(group)
                    (
                        substatus,
                        substatus_color,
                        substatus_text_color,
                    ) = get_group_status_badge(group)
                    yield {
                        "count": count,
                        "group": group,
                        "title": display["title"],
                        "message": display["message"],
                        "status": (
                            group_history.get_status_display() if group_history else "Unresolved"
                        ),
                        "status_color": (
                            group_status_to_color[group_history.status]
                            if group_history
                            else group_status_to_color[GroupHistoryStatus.NEW]
                        ),
                        "group_substatus": substatus,
                        "group_substatus_color": substatus_color,
                        "group_substatus_text_color": substatus_text_color,
                    }

        return heapq.nlargest(5, all_issues(), lambda d: d["count"])

    def past_issues():
        def all_past_issues():
            for project_ctx in user_projects:
                for group, count, has_linked_pr_or_commit in project_ctx.past_resolved_issues:
                    display = get_group_display(group)
                    yield {
                        "count": count,
                        "group": group,
                        "title": display["title"],
                        "message": display["message"],
                        "has_linked_pr_or_commit": has_linked_pr_or_commit,
                        "_relevance": count
                        * (PAST_ISSUES_LINK_BOOST if has_linked_pr_or_commit else 1),
                    }

        return heapq.nlargest(3, all_past_issues(), lambda d: d["_relevance"])

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

    show_past_issues = features.has("organizations:weekly-report-past-issues", ctx.organization)

    errors_discover_params: list[tuple[str, str | int]] = [
        ("field", "title"),
        ("field", "event.type"),
        ("field", "project"),
        ("field", "user.display"),
        ("field", "timestamp"),
        ("dataset", "errors"),
        ("sort", "-timestamp"),
        ("referrer", "weekly_report"),
        ("notification_uuid", notification_uuid),
    ]
    for pc in user_projects:
        errors_discover_params.append(("project", pc.project.id))
    errors_discover_query = urlencode(errors_discover_params)

    view_all_issues_url = _multi_project_substatus_url(user_projects, "is:unresolved")

    return {
        "organization": ctx.organization,
        "start": date_format(local_start),
        "end": date_format(local_end),
        "trends": trends(),
        "top_issues": top_issues(),
        "past_issues": past_issues() if show_past_issues else [],
        "show_past_issues": show_past_issues,
        "issue_summary": issue_summary(),
        "user_project_count": len(user_projects),
        "notification_uuid": notification_uuid,
        "errors_discover_query": errors_discover_query,
        "view_all_issues_url": view_all_issues_url,
        "enhanced_privacy": ctx.organization.flags.enhanced_privacy,
        "show_week_over_week_metric": features.has(
            "organizations:weekly-report-week-over-week-metric", ctx.organization
        ),
        "notification_settings_link": "/settings/account/notifications/reports/",
    }


def prepare_template_context(
    ctx: OrganizationReportContext, user_ids: Sequence[int | None]
) -> list[Mapping[str, Any]] | list:
    exclusions_by_user: dict[int, set[int]] = {}
    valid_user_ids = [uid for uid in user_ids if uid is not None]
    if valid_user_ids:
        for exc_user_id, exc_project_id in WeeklyReportProjectExclusion.objects.filter(
            user_id__in=valid_user_ids,
            project__organization_id=ctx.organization.id,
        ).values_list("user_id", "project_id"):
            exclusions_by_user.setdefault(exc_user_id, set()).add(exc_project_id)

    user_template_context_by_user_id_list = []
    for user_id in user_ids:
        excluded = exclusions_by_user.get(user_id) if isinstance(user_id, int) else None
        template_ctx = render_template_context(ctx, user_id, excluded_project_ids=excluded)
        if not template_ctx:
            logger.debug(
                "Skipping report for %s to <User: %s>, no qualifying reports to deliver.",
                ctx.organization.id,
                user_id,
            )
            continue
        user_template_context_by_user_id_list.append({"context": template_ctx, "user_id": user_id})
    return user_template_context_by_user_id_list
