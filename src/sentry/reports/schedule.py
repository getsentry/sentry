from __future__ import annotations

import calendar
from datetime import datetime, timedelta

from django.utils import timezone

from sentry.reports.models import ScheduledReport, ScheduledReportFrequency


def _next_monthly_occurrence(now_utc: datetime, day_of_month: int, hour: int) -> datetime:
    """
    Return the next UTC datetime matching the given day-of-month and hour.

    Handles months with fewer days by clamping to the last day of the month.
    For example, day_of_month=31 in February returns Feb 28 (or 29 in leap years).
    """
    year, month = now_utc.year, now_utc.month
    max_day = calendar.monthrange(year, month)[1]
    day = min(day_of_month, max_day)
    candidate = now_utc.replace(day=day, hour=hour, minute=0, second=0, microsecond=0)

    if candidate <= now_utc:
        if month == 12:
            year += 1
            month = 1
        else:
            month += 1
        max_day = calendar.monthrange(year, month)[1]
        day = min(day_of_month, max_day)
        candidate = now_utc.replace(
            year=year, month=month, day=day, hour=hour, minute=0, second=0, microsecond=0
        )

    return candidate


def compute_next_run_at(report: ScheduledReport, now: datetime | None = None) -> datetime:
    """
    Compute the next execution time in UTC based on frequency and schedule config.
    All times are in UTC.
    """
    now_utc = now or timezone.now()

    if report.frequency == ScheduledReportFrequency.DAILY:
        candidate = now_utc.replace(hour=report.hour, minute=0, second=0, microsecond=0)
        if candidate <= now_utc:
            candidate += timedelta(days=1)

    elif report.frequency == ScheduledReportFrequency.WEEKLY:
        days_ahead = report.day_of_week - now_utc.weekday()
        if days_ahead < 0 or (days_ahead == 0 and now_utc.hour >= report.hour):
            days_ahead += 7
        candidate = now_utc.replace(hour=report.hour, minute=0, second=0, microsecond=0)
        candidate += timedelta(days=days_ahead)

    elif report.frequency == ScheduledReportFrequency.MONTHLY:
        candidate = _next_monthly_occurrence(now_utc, report.day_of_month, report.hour)

    else:
        raise ValueError(f"Unknown frequency: {report.frequency}")

    return candidate
