from datetime import datetime, timezone
from unittest.mock import patch

import pytest
from django.utils import timezone as dj_timezone

from sentry.explore.models import ExploreSavedQuery, ExploreSavedQueryDataset
from sentry.reports.models import (
    ScheduledReport,
    ScheduledReportFrequency,
    ScheduledReportSourceType,
)
from sentry.reports.tasks import execute_scheduled_report, schedule_reports
from sentry.testutils.cases import TestCase


class ScheduleReportsTest(TestCase):
    def setUp(self):
        super().setUp()
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.saved_query = ExploreSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="Test Query",
            query={
                "query": [{"fields": ["span.op"], "query": ""}],
                "range": "24h",
            },
            dataset=ExploreSavedQueryDataset.SPANS,
        )
        self.saved_query.set_projects([self.project.id])

    def _create_report(self, **kwargs):
        defaults = {
            "organization": self.org,
            "created_by_id": self.user.id,
            "name": "Test Report",
            "source_type": ScheduledReportSourceType.EXPLORE_SAVED_QUERY,
            "source_id": self.saved_query.id,
            "frequency": ScheduledReportFrequency.DAILY,
            "hour": 9,
            "recipient_emails": ["test@example.com"],
            "next_run_at": datetime(2026, 2, 17, 9, 0, 0, tzinfo=timezone.utc),
        }
        defaults.update(kwargs)
        return ScheduledReport.objects.create(**defaults)

    @patch("sentry.reports.tasks.execute_scheduled_report")
    @patch("sentry.reports.tasks.feature_has")
    def test_schedule_reports_dispatches_due_reports(self, mock_feature_has, mock_execute):
        mock_feature_has.return_value = True
        report = self._create_report(
            next_run_at=datetime(2026, 2, 17, 9, 0, 0, tzinfo=timezone.utc)
        )

        with patch("sentry.reports.tasks.timezone.now") as mock_now:
            mock_now.return_value = datetime(2026, 2, 17, 9, 15, 0, tzinfo=timezone.utc)
            schedule_reports()

        mock_execute.delay.assert_called_once_with(report.id)
        report.refresh_from_db()
        assert report.next_run_at == datetime(2026, 2, 18, 9, 0, 0, tzinfo=timezone.utc)

    @patch("sentry.reports.tasks.execute_scheduled_report")
    @patch("sentry.reports.tasks.feature_has")
    def test_schedule_reports_skips_reports_without_feature_flag(
        self, mock_feature_has, mock_execute
    ):
        mock_feature_has.return_value = False
        self._create_report(next_run_at=datetime(2026, 2, 17, 9, 0, 0, tzinfo=timezone.utc))

        with patch("sentry.reports.tasks.timezone.now") as mock_now:
            mock_now.return_value = datetime(2026, 2, 17, 9, 15, 0, tzinfo=timezone.utc)
            schedule_reports()

        mock_execute.delay.assert_not_called()

    @patch("sentry.reports.tasks.execute_scheduled_report")
    @patch("sentry.reports.tasks.feature_has")
    def test_schedule_reports_skips_future_reports(self, mock_feature_has, mock_execute):
        mock_feature_has.return_value = True
        self._create_report(next_run_at=datetime(2026, 2, 18, 9, 0, 0, tzinfo=timezone.utc))

        with patch("sentry.reports.tasks.timezone.now") as mock_now:
            mock_now.return_value = datetime(2026, 2, 17, 9, 15, 0, tzinfo=timezone.utc)
            schedule_reports()

        mock_execute.delay.assert_not_called()

    @patch("sentry.reports.tasks.execute_scheduled_report")
    @patch("sentry.reports.tasks.feature_has")
    def test_schedule_reports_atomic_update_prevents_double_dispatch(
        self, mock_feature_has, mock_execute
    ):
        """Verify that concurrent scheduler ticks cannot double-dispatch the same report."""
        mock_feature_has.return_value = True
        report = self._create_report(
            next_run_at=datetime(2026, 2, 17, 9, 0, 0, tzinfo=timezone.utc)
        )

        now = datetime(2026, 2, 17, 9, 15, 0, tzinfo=timezone.utc)

        with patch("sentry.reports.tasks.timezone.now") as mock_now:
            mock_now.return_value = now
            schedule_reports()

        # Report's next_run_at has been advanced
        report.refresh_from_db()
        assert report.next_run_at > now

        # Running again with the same `now` should NOT dispatch again
        mock_execute.delay.reset_mock()
        with patch("sentry.reports.tasks.timezone.now") as mock_now:
            mock_now.return_value = now
            schedule_reports()

        mock_execute.delay.assert_not_called()

    @patch("sentry.reports.tasks.execute_scheduled_report")
    @patch("sentry.reports.tasks.feature_has")
    def test_schedule_reports_skips_inactive_reports(self, mock_feature_has, mock_execute):
        mock_feature_has.return_value = True
        self._create_report(
            is_active=False,
            next_run_at=datetime(2026, 2, 17, 9, 0, 0, tzinfo=timezone.utc),
        )

        with patch("sentry.reports.tasks.timezone.now") as mock_now:
            mock_now.return_value = datetime(2026, 2, 17, 9, 15, 0, tzinfo=timezone.utc)
            schedule_reports()

        mock_execute.delay.assert_not_called()


class ExecuteScheduledReportTest(TestCase):
    def setUp(self):
        super().setUp()
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.saved_query = ExploreSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="Test Query",
            query={
                "query": [{"fields": ["span.op"], "query": ""}],
                "range": "24h",
            },
            dataset=ExploreSavedQueryDataset.SPANS,
        )
        self.saved_query.set_projects([self.project.id])

    def _create_report(self, **kwargs):
        defaults = {
            "organization": self.org,
            "created_by_id": self.user.id,
            "name": "Test Report",
            "source_type": ScheduledReportSourceType.EXPLORE_SAVED_QUERY,
            "source_id": self.saved_query.id,
            "frequency": ScheduledReportFrequency.DAILY,
            "hour": 9,
            "recipient_emails": ["test@example.com"],
            "next_run_at": dj_timezone.now(),
        }
        defaults.update(kwargs)
        return ScheduledReport.objects.create(**defaults)

    @patch("sentry.reports.tasks.send_report_email")
    @patch("sentry.reports.tasks.generate_csv_for_explore_query")
    def test_execute_generates_and_sends_csv(self, mock_generate, mock_send):
        mock_generate.return_value = ("report.csv", b"col1,col2\na,b\n", False)
        report = self._create_report()

        execute_scheduled_report(report.id)

        mock_generate.assert_called_once_with(report, self.org)
        mock_send.assert_called_once_with(
            report, "report.csv", b"col1,col2\na,b\n", "text/csv", self.org, False
        )

    @patch("sentry.reports.tasks.send_report_email")
    @patch("sentry.reports.tasks.generate_csv_for_explore_query")
    def test_execute_skips_email_when_no_recipients(self, mock_generate, mock_send):
        mock_generate.return_value = ("report.csv", b"col1\n", False)
        report = self._create_report(recipient_emails=[])

        execute_scheduled_report(report.id)

        mock_generate.assert_called_once()
        mock_send.assert_not_called()

    def test_execute_returns_early_for_nonexistent_report(self):
        execute_scheduled_report(999999)

    @patch("sentry.reports.tasks.notify_report_deactivated")
    @patch("sentry.reports.tasks.send_report_email")
    def test_execute_deactivates_when_source_deleted(self, mock_send, mock_notify):
        report = self._create_report(source_id=999999)

        execute_scheduled_report(report.id)

        report.refresh_from_db()
        assert report.is_active is False
        mock_send.assert_not_called()
        mock_notify.assert_called_once_with(report, self.org, reason="source_deleted")

    @patch("sentry.reports.tasks.notify_report_deactivated")
    @patch("sentry.reports.tasks.send_report_email")
    def test_execute_deactivates_for_unsupported_dataset(self, mock_send, mock_notify):
        self.saved_query.dataset = ExploreSavedQueryDataset.METRICS
        self.saved_query.save()
        report = self._create_report()

        execute_scheduled_report(report.id)

        report.refresh_from_db()
        assert report.is_active is False
        mock_send.assert_not_called()
        mock_notify.assert_called_once_with(report, self.org, reason="unsupported_dataset")

    @patch("sentry.reports.tasks.generate_csv_for_explore_query")
    def test_execute_reraises_generation_errors(self, mock_generate):
        mock_generate.side_effect = RuntimeError("Snuba timeout")
        report = self._create_report()

        with pytest.raises(RuntimeError):
            execute_scheduled_report(report.id)

        report.refresh_from_db()
        assert report.is_active is True
