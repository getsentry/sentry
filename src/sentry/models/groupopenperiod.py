import logging
from datetime import datetime, timedelta

from django.conf import settings
from django.contrib.postgres.constraints import ExclusionConstraint
from django.contrib.postgres.fields import DateTimeRangeField
from django.contrib.postgres.fields.ranges import RangeBoundary, RangeOperators
from django.db import models, router, transaction
from django.db.models import Q
from django.utils import timezone

from sentry import options
from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_model, sane_repr
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.issues.grouptype import get_group_type_by_type_id
from sentry.models.activity import Activity
from sentry.models.group import Group, GroupStatus
from sentry.models.groupopenperiodactivity import GroupOpenPeriodActivity, OpenPeriodActivityType

logger = logging.getLogger(__name__)


class TsTzRange(models.Func):
    function = "TSTZRANGE"
    output_field = DateTimeRangeField()


def should_create_open_periods(type_id: int) -> bool:
    grouptypes_without_open_periods = options.get(
        "workflow_engine.group.type_id.open_periods_type_denylist"
    )
    if type_id in grouptypes_without_open_periods:
        return False
    return True


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
    event_id = models.CharField(max_length=32, null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupopenperiod"
        indexes = (
            # get all open periods since a certain date
            models.Index(fields=("group", "date_started")),
            models.Index(
                models.F("data__pending_incident_detector_id"),
                name="data__pend_inc_detector_id_idx",
            ),
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

        if get_group_type_by_type_id(self.group.type).detector_settings is not None:
            GroupOpenPeriodActivity.objects.create(
                group_open_period=self,
                type=OpenPeriodActivityType.CLOSED,
            )

    def reopen_open_period(self) -> None:
        if self.date_ended is None:
            logger.warning("Open period is not closed", extra={"group_id": self.group.id})
            return

        self.update(date_ended=None, resolution_activity=None, user_id=None)


def get_last_checked_for_open_period(group: Group) -> datetime:
    from sentry.incidents.grouptype import MetricIssue
    from sentry.incidents.models.alert_rule import AlertRule

    event = group.get_latest_event()
    last_checked = group.last_seen
    if event and group.type == MetricIssue.type_id:
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
    limit: int | None = None,
) -> BaseQuerySet[GroupOpenPeriod]:
    """
    Get open periods for a group that overlap with the query time range.

    To overlap with [query_start, query_end], an open period must:
    1. Start before the query ends
    2. End after the query starts (or still be open)

    This covers all overlap cases:
    - Period starts before query and ends within query range
    - Period starts before query and ends after query (open period spans entire query range)
    - Period starts within query and ends within query (open period completely inside query range)
    - Period starts within query and ends after query
    - Period starts before query and is still open
    - Period starts within query and is still open
    """
    if not should_create_open_periods(group.type):
        return GroupOpenPeriod.objects.none()

    if not query_start:
        # use whichever date is more recent to reduce the query range. first_seen could be > 90 days ago
        query_start = max(group.first_seen, timezone.now() - timedelta(days=90))
    if not query_end:
        query_end = timezone.now()

    started_before_query_ends = Q(date_started__lte=query_end)
    ended_after_query_starts = Q(date_ended__gte=query_start)
    still_open = Q(date_ended__isnull=True)

    group_open_periods = (
        GroupOpenPeriod.objects.filter(
            group=group,
        )
        .filter(started_before_query_ends & (ended_after_query_starts | still_open))
        .order_by("-date_started")
    )

    return group_open_periods[:limit]


def create_open_period(group: Group, start_time: datetime, event_id: str | None = None) -> None:
    # no-op if the group does not create open periods
    if not should_create_open_periods(group.type):
        return None

    latest_open_period = get_latest_open_period(group)
    if latest_open_period and latest_open_period.date_ended is None:
        logger.warning("Latest open period is not closed", extra={"group_id": group.id})
        return

    # There are some historical cases where we log multiple regressions for the same group,
    # but we only want to create a new open period for the first regression
    with transaction.atomic(router.db_for_write(Group)):
        # Force a Group lock before the create to establish consistent lock ordering
        # This prevents deadlocks by ensuring we always acquire the Group lock first
        Group.objects.select_for_update().filter(id=group.id).first()

        # There are some historical cases where we log multiple regressions for the same group,
        # but we only want to create a new open period for the first regression
        open_period = GroupOpenPeriod.objects.create(
            group=group,
            project=group.project,
            date_started=start_time,
            date_ended=None,
            resolution_activity=None,
            event_id=event_id,
        )

        # If we care about this group's activity, create activity entry
        if get_group_type_by_type_id(group.type).detector_settings is not None:
            GroupOpenPeriodActivity.objects.create(
                date_added=start_time,
                group_open_period=open_period,
                type=OpenPeriodActivityType.OPENED,
                value=group.priority,
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
    # if the group does not track open periods, this is a no-op
    if not should_create_open_periods(group.type):
        return None

    # If a group was missed during backfill, we can create a new open period for it on unresolve.
    if not has_any_open_period(group) and new_status == GroupStatus.UNRESOLVED:
        create_open_period(group, timezone.now())
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


def has_any_open_period(group: Group) -> bool:
    return GroupOpenPeriod.objects.filter(group=group).exists()


def get_latest_open_period(group: Group) -> GroupOpenPeriod | None:
    if not should_create_open_periods(group.type):
        return None

    return GroupOpenPeriod.objects.filter(group=group).order_by("-date_started").first()
