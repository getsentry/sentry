from datetime import datetime, timezone

from sentry.reports.models import ScheduledReport, ScheduledReportFrequency
from sentry.reports.schedule import _next_monthly_occurrence, compute_next_run_at
from sentry.testutils.cases import TestCase


class ComputeNextRunAtDailyTest(TestCase):
    def test_daily_next_run_is_today_if_hour_not_passed(self):
        now = datetime(2026, 2, 17, 8, 0, 0, tzinfo=timezone.utc)
        report = ScheduledReport(
            frequency=ScheduledReportFrequency.DAILY,
            hour=17,
        )
        result = compute_next_run_at(report, now=now)
        assert result == datetime(2026, 2, 17, 17, 0, 0, tzinfo=timezone.utc)

    def test_daily_next_run_is_tomorrow_if_hour_passed(self):
        now = datetime(2026, 2, 17, 18, 30, 0, tzinfo=timezone.utc)
        report = ScheduledReport(
            frequency=ScheduledReportFrequency.DAILY,
            hour=17,
        )
        result = compute_next_run_at(report, now=now)
        assert result == datetime(2026, 2, 18, 17, 0, 0, tzinfo=timezone.utc)

    def test_daily_next_run_is_tomorrow_if_exact_hour(self):
        now = datetime(2026, 2, 17, 17, 0, 0, tzinfo=timezone.utc)
        report = ScheduledReport(
            frequency=ScheduledReportFrequency.DAILY,
            hour=17,
        )
        result = compute_next_run_at(report, now=now)
        assert result == datetime(2026, 2, 18, 17, 0, 0, tzinfo=timezone.utc)

    def test_daily_midnight_hour(self):
        now = datetime(2026, 2, 17, 23, 59, 0, tzinfo=timezone.utc)
        report = ScheduledReport(
            frequency=ScheduledReportFrequency.DAILY,
            hour=0,
        )
        result = compute_next_run_at(report, now=now)
        assert result == datetime(2026, 2, 18, 0, 0, 0, tzinfo=timezone.utc)


class ComputeNextRunAtWeeklyTest(TestCase):
    def test_weekly_same_day_before_hour(self):
        # 2026-02-17 is a Tuesday (weekday=1)
        now = datetime(2026, 2, 17, 8, 0, 0, tzinfo=timezone.utc)
        report = ScheduledReport(
            frequency=ScheduledReportFrequency.WEEKLY,
            day_of_week=1,  # Tuesday
            hour=17,
        )
        result = compute_next_run_at(report, now=now)
        assert result == datetime(2026, 2, 17, 17, 0, 0, tzinfo=timezone.utc)

    def test_weekly_same_day_after_hour(self):
        now = datetime(2026, 2, 17, 18, 0, 0, tzinfo=timezone.utc)
        report = ScheduledReport(
            frequency=ScheduledReportFrequency.WEEKLY,
            day_of_week=1,  # Tuesday
            hour=17,
        )
        result = compute_next_run_at(report, now=now)
        # Next Tuesday is Feb 24
        assert result == datetime(2026, 2, 24, 17, 0, 0, tzinfo=timezone.utc)

    def test_weekly_future_day_this_week(self):
        # Tuesday, looking for Friday (day_of_week=4)
        now = datetime(2026, 2, 17, 10, 0, 0, tzinfo=timezone.utc)
        report = ScheduledReport(
            frequency=ScheduledReportFrequency.WEEKLY,
            day_of_week=4,  # Friday
            hour=9,
        )
        result = compute_next_run_at(report, now=now)
        assert result == datetime(2026, 2, 20, 9, 0, 0, tzinfo=timezone.utc)

    def test_weekly_past_day_next_week(self):
        # Tuesday, looking for Monday (day_of_week=0)
        now = datetime(2026, 2, 17, 10, 0, 0, tzinfo=timezone.utc)
        report = ScheduledReport(
            frequency=ScheduledReportFrequency.WEEKLY,
            day_of_week=0,  # Monday
            hour=9,
        )
        result = compute_next_run_at(report, now=now)
        # Next Monday is Feb 23
        assert result == datetime(2026, 2, 23, 9, 0, 0, tzinfo=timezone.utc)


class ComputeNextRunAtMonthlyTest(TestCase):
    def test_monthly_same_month_future_day(self):
        now = datetime(2026, 2, 10, 8, 0, 0, tzinfo=timezone.utc)
        report = ScheduledReport(
            frequency=ScheduledReportFrequency.MONTHLY,
            day_of_month=15,
            hour=9,
        )
        result = compute_next_run_at(report, now=now)
        assert result == datetime(2026, 2, 15, 9, 0, 0, tzinfo=timezone.utc)

    def test_monthly_same_day_after_hour_rolls_to_next_month(self):
        now = datetime(2026, 2, 15, 10, 0, 0, tzinfo=timezone.utc)
        report = ScheduledReport(
            frequency=ScheduledReportFrequency.MONTHLY,
            day_of_month=15,
            hour=9,
        )
        result = compute_next_run_at(report, now=now)
        assert result == datetime(2026, 3, 15, 9, 0, 0, tzinfo=timezone.utc)

    def test_monthly_past_day_rolls_to_next_month(self):
        now = datetime(2026, 2, 20, 10, 0, 0, tzinfo=timezone.utc)
        report = ScheduledReport(
            frequency=ScheduledReportFrequency.MONTHLY,
            day_of_month=15,
            hour=9,
        )
        result = compute_next_run_at(report, now=now)
        assert result == datetime(2026, 3, 15, 9, 0, 0, tzinfo=timezone.utc)

    def test_monthly_december_rolls_to_january(self):
        now = datetime(2026, 12, 25, 10, 0, 0, tzinfo=timezone.utc)
        report = ScheduledReport(
            frequency=ScheduledReportFrequency.MONTHLY,
            day_of_month=15,
            hour=9,
        )
        result = compute_next_run_at(report, now=now)
        assert result == datetime(2027, 1, 15, 9, 0, 0, tzinfo=timezone.utc)


class NextMonthlyOccurrenceTest(TestCase):
    def test_clamps_day_31_to_feb_28(self):
        now = datetime(2026, 2, 1, 0, 0, 0, tzinfo=timezone.utc)
        result = _next_monthly_occurrence(now, day_of_month=31, hour=9)
        assert result == datetime(2026, 2, 28, 9, 0, 0, tzinfo=timezone.utc)

    def test_clamps_day_31_to_feb_29_leap_year(self):
        now = datetime(2028, 2, 1, 0, 0, 0, tzinfo=timezone.utc)
        result = _next_monthly_occurrence(now, day_of_month=31, hour=9)
        assert result == datetime(2028, 2, 29, 9, 0, 0, tzinfo=timezone.utc)

    def test_clamps_day_31_in_april(self):
        now = datetime(2026, 4, 1, 0, 0, 0, tzinfo=timezone.utc)
        result = _next_monthly_occurrence(now, day_of_month=31, hour=9)
        assert result == datetime(2026, 4, 30, 9, 0, 0, tzinfo=timezone.utc)

    def test_exact_day_exists_in_month(self):
        now = datetime(2026, 3, 1, 0, 0, 0, tzinfo=timezone.utc)
        result = _next_monthly_occurrence(now, day_of_month=31, hour=9)
        assert result == datetime(2026, 3, 31, 9, 0, 0, tzinfo=timezone.utc)

    def test_rolls_to_next_month_when_past(self):
        now = datetime(2026, 1, 31, 10, 0, 0, tzinfo=timezone.utc)
        result = _next_monthly_occurrence(now, day_of_month=31, hour=9)
        # Feb has 28 days in 2026
        assert result == datetime(2026, 2, 28, 9, 0, 0, tzinfo=timezone.utc)

    def test_same_day_same_hour_rolls_forward(self):
        now = datetime(2026, 3, 15, 9, 0, 0, tzinfo=timezone.utc)
        result = _next_monthly_occurrence(now, day_of_month=15, hour=9)
        assert result == datetime(2026, 4, 15, 9, 0, 0, tzinfo=timezone.utc)
