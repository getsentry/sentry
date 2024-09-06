import time
from collections.abc import Mapping
from datetime import datetime, timedelta

from django.utils import timezone
from django.utils.timesince import timesince
from django.utils.translation import gettext as _

from sentry.models.group import Group

DAY_IN_SEC = 24 * 60 * 60


def get_approx_start_time(group: Group):
    event = group.get_recommended_event_for_environments()
    if event is None:
        return None

    occurrence = event.occurrence
    if occurrence is None:
        return None

    regression_time = occurrence.evidence_data.get("breakpoint", None)
    return regression_time


def time_since(value: datetime):
    """
    Display the relative time
    """
    now = timezone.now()
    if value < (now - timedelta(days=5)):
        return value.date()
    diff = timesince(value, now)
    if diff == timesince(now, now):
        return "Just now"
    if diff == "1 day":
        return _("Yesterday")
    return f"{diff} ago"


def get_relative_time(
    anchor: int, relative_days: int, retention_days: int = 90
) -> Mapping[str, datetime]:
    max_time = time.time()
    min_time = max_time - retention_days * DAY_IN_SEC
    before_time = anchor - relative_days * DAY_IN_SEC
    before_datetime = (
        datetime.fromtimestamp(before_time)
        if before_time >= min_time
        else datetime.fromtimestamp(min_time)
    )

    after_time = anchor + relative_days * DAY_IN_SEC
    after_datetime = (
        datetime.fromtimestamp(after_time)
        if after_time <= max_time
        else datetime.fromtimestamp(max_time)
    )
    return {
        "start": before_datetime,
        "end": after_datetime,
    }
