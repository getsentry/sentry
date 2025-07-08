import logging
from datetime import datetime, timedelta
from typing import Any

from django.conf import settings
from django.contrib.postgres.constraints import ExclusionConstraint
from django.contrib.postgres.fields import DateTimeRangeField
from django.contrib.postgres.fields.ranges import RangeBoundary, RangeOperators
from django.db import models
from django.utils import timezone

from sentry import features
from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_model, sane_repr
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.models.activity import Activity
from sentry.models.group import Group, GroupStatus
from sentry.types.activity import ActivityType

logger = logging.getLogger(__name__)


class TsTzRange(models.Func):
    function = "TSTZRANGE"
    output_field = DateTimeRangeField()


@region_silo_model
class GroupOpenPeriod(DefaultFieldsModel):
    """
    A GroupOpenPeriod is a period of time where a group is considered "open",
    i.e. having a status that is not resolved. This is primarily used for
    detector-based issues to track the period of time that an issue is open for.
    """

    __relocation_scope__ = RelocationScope.Excluded

    project = FlexibleForeignKey("sentry.Project")
    group = FlexibleForeignKey("sentry.Group")
    resolution_activity = FlexibleForeignKey(
        "sentry.Activity", null=True, on_delete=models.SET_NULL
    )

    # if the user is not set, it's assumed to be the system
    user_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete="SET_NULL")
    date_started = models.DateTimeField(default=timezone.now)
    date_ended = models.DateTimeField(null=True)

    data = models.JSONField(default=dict)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupopenperiod"
        indexes = (
            # get all open periods since a certain date
            models.Index(fields=("group", "date_started")),
        )

        constraints = (
            ExclusionConstraint(
                name="exclude_overlapping_date_start_end",
                expressions=[
                    (models.F("group"), RangeOperators.EQUAL),
                    (
                        TsTzRange(
                            "date_started",
                            "date_ended",
                            RangeBoundary(inclusive_lower=True, inclusive_upper=True),
                        ),
                        RangeOperators.OVERLAPS,
                    ),
                ],
            ),
        )

    __repr__ = sane_repr("project_id", "group_id", "date_started", "date_ended", "user_id")

    def close_open_period(
        self,
        resolution_activity: Activity,
        resolution_time: datetime,
    ) -> None:
        if self.date_ended is not None:
            logger.warning("Open period is already closed", extra={"group_id": self.group.id})
            return

        self.update(
            date_ended=resolution_time,
            resolution_activity=resolution_activity,
            user_id=resolution_activity.user_id,
        )

    def reopen_open_period(self) -> None:
        if self.date_ended is None:
            logger.warning("Open period is not closed", extra={"group_id": self.group.id})
            return

        self.update(date_ended=None, resolution_activity=None, user_id=None)


def get_last_checked_for_open_period(group: Group) -> datetime:
    from sentry.incidents.models.alert_rule import AlertRule
    from sentry.issues.grouptype import MetricIssuePOC

    event = group.get_latest_event()
    last_checked = group.last_seen
    if event and group.type == MetricIssuePOC.type_id:
        alert_rule_id = event.data.get("contexts", {}).get("metric_alert", {}).get("alert_rule_id")
        if alert_rule_id:
            try:
                alert_rule = AlertRule.objects.get(id=alert_rule_id)
                now = timezone.now()
                last_checked = now - timedelta(seconds=alert_rule.snuba_query.time_window)
            except AlertRule.DoesNotExist:
                pass

    return last_checked


def get_open_periods_for_group(
    group: Group,
    query_start: datetime | None = None,
    query_end: datetime | None = None,
    offset: int | None = None,
    limit: int | None = None,
) -> list[Any]:
    from sentry.incidents.utils.metric_issue_poc import OpenPeriod

    if not features.has("organizations:issue-open-periods", group.organization):
        return []

    # Try to get open periods from the GroupOpenPeriod table first
    group_open_periods = GroupOpenPeriod.objects.filter(group=group)
    if group_open_periods.exists() and query_start:
        group_open_periods = group_open_periods.filter(
            date_started__gte=query_start, date_ended__lte=query_end, id__gte=offset or 0
        ).order_by("-date_started")[:limit]

        return [
            OpenPeriod(
                start=period.date_started,
                end=period.date_ended,
                duration=period.date_ended - period.date_started if period.date_ended else None,
                is_open=period.date_ended is None,
                last_checked=get_last_checked_for_open_period(group),
            )
            for period in group_open_periods
        ]

    # If there are no open periods in the table, we need to calculate them
    # from the activity log.
    # TODO(snigdha): This is temporary until we have backfilled the GroupOpenPeriod table

    if query_start is None or query_end is None:
        query_start = timezone.now() - timedelta(days=90)
        query_end = timezone.now()

    query_limit = limit * 2 if limit else None
    # Filter to REGRESSION and RESOLVED activties to find the bounds of each open period.
    # The only UNRESOLVED activity we would care about is the first UNRESOLVED activity for the group creation,
    # but we don't create an entry for that .
    activities = Activity.objects.filter(
        group=group,
        type__in=[ActivityType.SET_REGRESSION.value, ActivityType.SET_RESOLVED.value],
        datetime__gte=query_start,
        datetime__lte=query_end,
    ).order_by("-datetime")[:query_limit]

    open_periods = []
    start: datetime | None = None
    end: datetime | None = None
    last_checked = get_last_checked_for_open_period(group)

    # Handle currently open period
    if group.status == GroupStatus.UNRESOLVED and len(activities) > 0:
        open_periods.append(
            OpenPeriod(
                start=activities[0].datetime,
                end=None,
                duration=None,
                is_open=True,
                last_checked=last_checked,
            )
        )
        activities = activities[1:]

    for activity in activities:
        if activity.type == ActivityType.SET_RESOLVED.value:
            end = activity.datetime
        elif activity.type == ActivityType.SET_REGRESSION.value:
            start = activity.datetime
            if end is not None:
                open_periods.append(
                    OpenPeriod(
                        start=start,
                        end=end,
                        duration=end - start,
                        is_open=False,
                        last_checked=end,
                    )
                )
                end = None

    # Add the very first open period, which has no UNRESOLVED activity for the group creation
    open_periods.append(
        OpenPeriod(
            start=group.first_seen,
            end=end if end else None,
            duration=end - group.first_seen if end else None,
            is_open=False if end else True,
            last_checked=end if end else last_checked,
        )
    )

    if offset and limit:
        return open_periods[offset : offset + limit]

    if limit:
        return open_periods[:limit]

    return open_periods


def create_open_period(group: Group, start_time: datetime) -> None:
    if not features.has("organizations:issue-open-periods", group.project.organization):
        return

    latest_open_period = get_latest_open_period(group)
    if latest_open_period and latest_open_period.date_ended is None:
        logger.warning("Latest open period is not closed", extra={"group_id": group.id})
        return

    # There are some historical cases where we log multiple regressions for the same group,
    # but we only want to create a new open period for the first regression
    GroupOpenPeriod.objects.create(
        group=group,
        project=group.project,
        date_started=start_time,
        date_ended=None,
        resolution_activity=None,
    )


def update_group_open_period(
    group: Group,
    new_status: int,
    resolution_time: datetime | None = None,
    resolution_activity: Activity | None = None,
) -> None:
    """
    Update an existing open period when the group is resolved or unresolved.

    On resolution, we set the date_ended to the resolution time and link the activity to the open period.
    On unresolved, we clear the date_ended and resolution_activity fields. This is only done if the group
    is unresolved manually without a regression. If the group is unresolved due to a regression, the
    open periods will be updated during ingestion.
    """
    if not features.has("organizations:issue-open-periods", group.project.organization):
        return

    # Until we've backfilled the GroupOpenPeriod table, we don't want to update open periods for
    # groups that weren't initially created with one.
    if not has_initial_open_period(group):
        return

    open_period = get_latest_open_period(group)
    if open_period is None:
        logger.warning("No open period found for group", extra={"group_id": group.id})
        return

    if new_status == GroupStatus.RESOLVED:
        if resolution_activity is None or resolution_time is None:
            logger.warning(
                "Missing information to close open period",
                extra={"group_id": group.id},
            )
            return

        open_period.close_open_period(
            resolution_activity=resolution_activity,
            resolution_time=resolution_time,
        )
    elif new_status == GroupStatus.UNRESOLVED:
        open_period.reopen_open_period()


def has_initial_open_period(group: Group) -> bool:
    return GroupOpenPeriod.objects.filter(group=group, date_started__lte=group.first_seen).exists()


def get_latest_open_period(group: Group) -> GroupOpenPeriod | None:
    return GroupOpenPeriod.objects.filter(group=group).order_by("-date_started").first()
