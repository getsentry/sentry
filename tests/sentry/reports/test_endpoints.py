from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import patch

from sentry.explore.models import ExploreSavedQuery, ExploreSavedQueryDataset
from sentry.reports.models import (
    ScheduledReport,
    ScheduledReportFrequency,
    ScheduledReportSourceType,
)
from sentry.testutils.cases import APITestCase


class ScheduledReportsListTest(APITestCase):
    endpoint = "sentry-api-0-organization-scheduled-reports"
    method = "get"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)
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
            "recipient_emails": [self.user.email],
            "next_run_at": datetime(2026, 2, 18, 9, 0, 0, tzinfo=timezone.utc),
        }
        defaults.update(kwargs)
        return ScheduledReport.objects.create(**defaults)

    def test_list_empty(self):
        with self.feature("organizations:scheduled-reports"):
            response = self.get_success_response(self.org.slug)
        assert response.data == []

    def test_list_returns_reports(self):
        report = self._create_report()
        with self.feature("organizations:scheduled-reports"):
            response = self.get_success_response(self.org.slug)
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(report.id)
        assert response.data[0]["name"] == "Test Report"
        assert response.data[0]["sourceType"] == "explore_saved_query"
        assert response.data[0]["frequency"] == "daily"
        assert response.data[0]["hour"] == 9

    def test_list_filter_by_source_type(self):
        self._create_report()
        with self.feature("organizations:scheduled-reports"):
            response = self.get_success_response(
                self.org.slug,
                qs_params={"sourceType": "explore_saved_query"},
            )
        assert len(response.data) == 1

        with self.feature("organizations:scheduled-reports"):
            response = self.get_success_response(
                self.org.slug,
                qs_params={"sourceType": "dashboard"},
            )
        assert len(response.data) == 0

    def test_list_filter_by_source_id(self):
        self._create_report()
        with self.feature("organizations:scheduled-reports"):
            response = self.get_success_response(
                self.org.slug,
                qs_params={"sourceId": str(self.saved_query.id)},
            )
        assert len(response.data) == 1

        with self.feature("organizations:scheduled-reports"):
            response = self.get_success_response(
                self.org.slug,
                qs_params={"sourceId": "999999"},
            )
        assert len(response.data) == 0

    def test_list_requires_feature_flag(self):
        response = self.get_response(self.org.slug)
        assert response.status_code == 404

    def test_list_does_not_expose_other_org_reports(self):
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        other_query = ExploreSavedQuery.objects.create(
            organization=other_org,
            created_by_id=self.user.id,
            name="Other Org Query",
            query={"query": [{"fields": ["span.op"], "query": ""}], "range": "24h"},
            dataset=ExploreSavedQueryDataset.SPANS,
        )
        other_query.set_projects([other_project.id])
        ScheduledReport.objects.create(
            organization=other_org,
            created_by_id=self.user.id,
            name="Other Org Report",
            source_type=ScheduledReportSourceType.EXPLORE_SAVED_QUERY,
            source_id=other_query.id,
            frequency=ScheduledReportFrequency.DAILY,
            hour=9,
            recipient_emails=[self.user.email],
            next_run_at=datetime(2026, 2, 18, 9, 0, 0, tzinfo=timezone.utc),
        )

        with self.feature("organizations:scheduled-reports"):
            response = self.get_success_response(self.org.slug)
        assert len(response.data) == 0


class ScheduledReportsCreateTest(APITestCase):
    endpoint = "sentry-api-0-organization-scheduled-reports"
    method = "post"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)
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

    def _valid_payload(self, **overrides):
        payload = {
            "name": "Daily Span Report",
            "sourceType": "explore_saved_query",
            "sourceId": self.saved_query.id,
            "frequency": "daily",
            "hour": 14,
            "recipientEmails": [self.user.email],
        }
        payload.update(overrides)
        return payload

    def test_create_daily_report(self):
        with self.feature("organizations:scheduled-reports"):
            response = self.get_success_response(
                self.org.slug,
                status_code=201,
                **self._valid_payload(),
            )

        assert response.data["name"] == "Daily Span Report"
        assert response.data["sourceType"] == "explore_saved_query"
        assert response.data["sourceId"] == str(self.saved_query.id)
        assert response.data["frequency"] == "daily"
        assert response.data["hour"] == 14
        assert response.data["isActive"] is True
        assert response.data["nextRunAt"] is not None
        assert ScheduledReport.objects.count() == 1

    def test_create_weekly_report(self):
        with self.feature("organizations:scheduled-reports"):
            response = self.get_success_response(
                self.org.slug,
                status_code=201,
                **self._valid_payload(frequency="weekly", dayOfWeek=0),
            )

        assert response.data["frequency"] == "weekly"
        assert response.data["dayOfWeek"] == 0

    def test_create_monthly_report(self):
        with self.feature("organizations:scheduled-reports"):
            response = self.get_success_response(
                self.org.slug,
                status_code=201,
                **self._valid_payload(frequency="monthly", dayOfMonth=15),
            )

        assert response.data["frequency"] == "monthly"
        assert response.data["dayOfMonth"] == 15

    def test_create_with_time_range_override(self):
        with self.feature("organizations:scheduled-reports"):
            response = self.get_success_response(
                self.org.slug,
                status_code=201,
                **self._valid_payload(timeRange="7d"),
            )

        assert response.data["timeRange"] == "7d"

    def test_create_requires_feature_flag(self):
        response = self.get_response(self.org.slug, **self._valid_payload())
        assert response.status_code == 404

    def test_create_validates_weekly_requires_day_of_week(self):
        with self.feature("organizations:scheduled-reports"):
            response = self.get_error_response(
                self.org.slug,
                status_code=400,
                **self._valid_payload(frequency="weekly"),
            )
        assert "dayOfWeek" in str(response.data)

    def test_create_validates_monthly_requires_day_of_month(self):
        with self.feature("organizations:scheduled-reports"):
            response = self.get_error_response(
                self.org.slug,
                status_code=400,
                **self._valid_payload(frequency="monthly"),
            )
        assert "dayOfMonth" in str(response.data)

    def test_create_validates_invalid_time_range(self):
        with self.feature("organizations:scheduled-reports"):
            response = self.get_error_response(
                self.org.slug,
                status_code=400,
                **self._valid_payload(timeRange="999d"),
            )
        assert "timeRange" in str(response.data)

    def test_create_validates_source_id_exists(self):
        with self.feature("organizations:scheduled-reports"):
            response = self.get_error_response(
                self.org.slug,
                status_code=400,
                **self._valid_payload(sourceId=999999),
            )
        assert "sourceId" in str(response.data)

    def test_create_validates_source_id_belongs_to_org(self):
        """IDOR prevention: source_id from another org is rejected."""
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        other_query = ExploreSavedQuery.objects.create(
            organization=other_org,
            created_by_id=self.user.id,
            name="Other Org Query",
            query={"query": [{"fields": ["span.op"], "query": ""}], "range": "24h"},
            dataset=ExploreSavedQueryDataset.SPANS,
        )
        other_query.set_projects([other_project.id])

        with self.feature("organizations:scheduled-reports"):
            response = self.get_error_response(
                self.org.slug,
                status_code=400,
                **self._valid_payload(sourceId=other_query.id),
            )
        assert "sourceId" in str(response.data)

    def test_create_validates_unsupported_dataset(self):
        metrics_query = ExploreSavedQuery.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="Metrics Query",
            query={"query": [{"fields": ["span.op"], "query": ""}], "range": "24h"},
            dataset=ExploreSavedQueryDataset.METRICS,
        )
        metrics_query.set_projects([self.project.id])

        with self.feature("organizations:scheduled-reports"):
            response = self.get_error_response(
                self.org.slug,
                status_code=400,
                **self._valid_payload(sourceId=metrics_query.id),
            )
        assert "sourceId" in str(response.data)
        assert "unsupported dataset" in str(response.data).lower()

    def test_create_validates_recipient_emails_are_org_members(self):
        with self.feature("organizations:scheduled-reports"):
            response = self.get_error_response(
                self.org.slug,
                status_code=400,
                **self._valid_payload(recipientEmails=["nonexistent@example.com"]),
            )
        assert "recipientEmails" in str(response.data)

    def test_create_enforces_per_org_limit(self):
        for i in range(25):
            ScheduledReport.objects.create(
                organization=self.org,
                created_by_id=self.user.id,
                name=f"Report {i}",
                source_type=ScheduledReportSourceType.EXPLORE_SAVED_QUERY,
                source_id=self.saved_query.id,
                frequency=ScheduledReportFrequency.DAILY,
                hour=9,
                recipient_emails=[self.user.email],
                next_run_at=datetime(2026, 2, 18, 9, 0, 0, tzinfo=timezone.utc),
            )

        with self.feature("organizations:scheduled-reports"):
            response = self.get_error_response(
                self.org.slug,
                status_code=400,
                **self._valid_payload(),
            )
        assert "maximum" in response.data["detail"].lower()


class ScheduledReportDetailGetTest(APITestCase):
    endpoint = "sentry-api-0-organization-scheduled-report-detail"
    method = "get"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)
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
        self.report = ScheduledReport.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="Test Report",
            source_type=ScheduledReportSourceType.EXPLORE_SAVED_QUERY,
            source_id=self.saved_query.id,
            frequency=ScheduledReportFrequency.DAILY,
            hour=9,
            recipient_emails=[self.user.email],
            next_run_at=datetime(2026, 2, 18, 9, 0, 0, tzinfo=timezone.utc),
        )

    def test_get_report(self):
        with self.feature("organizations:scheduled-reports"):
            response = self.get_success_response(self.org.slug, self.report.id)
        assert response.data["id"] == str(self.report.id)
        assert response.data["name"] == "Test Report"

    def test_get_report_requires_feature_flag(self):
        response = self.get_response(self.org.slug, self.report.id)
        assert response.status_code == 404

    def test_get_nonexistent_report(self):
        with self.feature("organizations:scheduled-reports"):
            self.get_error_response(self.org.slug, 999999, status_code=404)

    def test_get_report_from_different_org_returns_404(self):
        """IDOR prevention: cannot access reports from other orgs."""
        other_org = self.create_organization(owner=self.user)
        with self.feature("organizations:scheduled-reports"):
            self.get_error_response(other_org.slug, self.report.id, status_code=404)


class ScheduledReportDetailPutTest(APITestCase):
    endpoint = "sentry-api-0-organization-scheduled-report-detail"
    method = "put"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)
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
        self.report = ScheduledReport.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="Test Report",
            source_type=ScheduledReportSourceType.EXPLORE_SAVED_QUERY,
            source_id=self.saved_query.id,
            frequency=ScheduledReportFrequency.DAILY,
            hour=9,
            recipient_emails=[self.user.email],
            next_run_at=datetime(2026, 2, 18, 9, 0, 0, tzinfo=timezone.utc),
        )

    def _valid_payload(self, **overrides):
        payload = {
            "name": "Updated Report",
            "sourceType": "explore_saved_query",
            "sourceId": self.saved_query.id,
            "frequency": "weekly",
            "dayOfWeek": 1,
            "hour": 17,
            "recipientEmails": [self.user.email],
        }
        payload.update(overrides)
        return payload

    def test_update_report(self):
        with self.feature("organizations:scheduled-reports"):
            response = self.get_success_response(
                self.org.slug, self.report.id, **self._valid_payload()
            )

        assert response.data["name"] == "Updated Report"
        assert response.data["frequency"] == "weekly"
        assert response.data["dayOfWeek"] == 1
        assert response.data["hour"] == 17

        self.report.refresh_from_db()
        assert self.report.name == "Updated Report"
        assert self.report.frequency == ScheduledReportFrequency.WEEKLY
        assert self.report.day_of_week == 1

    def test_update_recomputes_next_run_at(self):
        old_next_run = self.report.next_run_at
        with self.feature("organizations:scheduled-reports"):
            self.get_success_response(self.org.slug, self.report.id, **self._valid_payload(hour=20))

        self.report.refresh_from_db()
        assert self.report.next_run_at != old_next_run

    def test_update_requires_feature_flag(self):
        response = self.get_response(self.org.slug, self.report.id, **self._valid_payload())
        assert response.status_code == 404

    def test_non_creator_non_admin_cannot_update(self):
        other_user = self.create_user("other@example.com")
        self.create_member(organization=self.org, user=other_user, role="member")
        self.login_as(other_user)

        with self.feature("organizations:scheduled-reports"):
            self.get_error_response(
                self.org.slug,
                self.report.id,
                status_code=403,
                **self._valid_payload(),
            )

    def test_org_admin_can_update_any_report(self):
        admin_user = self.create_user("admin@example.com")
        self.create_member(organization=self.org, user=admin_user, role="owner")
        self.login_as(admin_user)

        with self.feature("organizations:scheduled-reports"):
            response = self.get_success_response(
                self.org.slug, self.report.id, **self._valid_payload()
            )
        assert response.data["name"] == "Updated Report"


class ScheduledReportDetailDeleteTest(APITestCase):
    endpoint = "sentry-api-0-organization-scheduled-report-detail"
    method = "delete"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)
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
        self.report = ScheduledReport.objects.create(
            organization=self.org,
            created_by_id=self.user.id,
            name="Test Report",
            source_type=ScheduledReportSourceType.EXPLORE_SAVED_QUERY,
            source_id=self.saved_query.id,
            frequency=ScheduledReportFrequency.DAILY,
            hour=9,
            recipient_emails=[self.user.email],
            next_run_at=datetime(2026, 2, 18, 9, 0, 0, tzinfo=timezone.utc),
        )

    def test_delete_report(self):
        with self.feature("organizations:scheduled-reports"):
            self.get_success_response(self.org.slug, self.report.id, status_code=204)
        assert not ScheduledReport.objects.filter(id=self.report.id).exists()

    def test_delete_requires_feature_flag(self):
        response = self.get_response(self.org.slug, self.report.id)
        assert response.status_code == 404

    def test_non_creator_non_admin_cannot_delete(self):
        other_user = self.create_user("other@example.com")
        self.create_member(organization=self.org, user=other_user, role="member")
        self.login_as(other_user)

        with self.feature("organizations:scheduled-reports"):
            self.get_error_response(self.org.slug, self.report.id, status_code=403)
        assert ScheduledReport.objects.filter(id=self.report.id).exists()

    def test_creator_can_delete_own_report(self):
        with self.feature("organizations:scheduled-reports"):
            self.get_success_response(self.org.slug, self.report.id, status_code=204)
        assert not ScheduledReport.objects.filter(id=self.report.id).exists()

    def test_org_admin_can_delete_any_report(self):
        admin_user = self.create_user("admin@example.com")
        self.create_member(organization=self.org, user=admin_user, role="owner")
        self.login_as(admin_user)

        with self.feature("organizations:scheduled-reports"):
            self.get_success_response(self.org.slug, self.report.id, status_code=204)
        assert not ScheduledReport.objects.filter(id=self.report.id).exists()


class ScheduledReportTestSendTest(APITestCase):
    endpoint = "sentry-api-0-organization-scheduled-report-test"
    method = "post"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)
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

    def _valid_payload(self, **overrides):
        payload = {
            "name": "Test Send Report",
            "sourceType": "explore_saved_query",
            "sourceId": self.saved_query.id,
            "frequency": "daily",
            "hour": 14,
            "recipientEmails": [self.user.email],
        }
        payload.update(overrides)
        return payload

    @patch("sentry.reports.endpoints.scheduled_report_test.send_report_email")
    @patch("sentry.reports.endpoints.scheduled_report_test.generate_csv_for_explore_query")
    def test_test_send_generates_and_sends(self, mock_generate, mock_send):
        mock_generate.return_value = ("report.csv", b"col1,col2\na,b\n", False)

        with self.feature("organizations:scheduled-reports"):
            response = self.get_success_response(self.org.slug, **self._valid_payload())

        assert response.data["detail"] == "Test email sent."
        mock_generate.assert_called_once()
        mock_send.assert_called_once()

        # The generator should receive a transient report with correct fields
        call_args = mock_generate.call_args
        report_arg = call_args[0][0]
        assert report_arg.source_id == self.saved_query.id
        assert report_arg.name == "Test Send Report"
        assert report_arg.pk is None  # not persisted to db
        assert ScheduledReport.objects.count() == 0

    def test_test_send_requires_feature_flag(self):
        response = self.get_response(self.org.slug, **self._valid_payload())
        assert response.status_code == 404

    def test_test_send_validates_payload(self):
        with self.feature("organizations:scheduled-reports"):
            response = self.get_error_response(
                self.org.slug,
                status_code=400,
                name="Test",
                sourceType="explore_saved_query",
                sourceId=999999,
                frequency="daily",
                hour=14,
                recipientEmails=[self.user.email],
            )
        assert "sourceId" in str(response.data)

    @patch("sentry.reports.endpoints.scheduled_report_test.generate_csv_for_explore_query")
    def test_test_send_handles_generation_runtime_error(self, mock_generate):
        mock_generate.side_effect = RuntimeError("Snuba timeout")

        with self.feature("organizations:scheduled-reports"):
            response = self.get_error_response(
                self.org.slug,
                status_code=500,
                **self._valid_payload(),
            )
        assert "failed" in response.data["detail"].lower()

    def test_test_send_rejects_dashboard_source_type(self):
        with self.feature("organizations:scheduled-reports"):
            response = self.get_error_response(
                self.org.slug,
                status_code=400,
                name="Dashboard Report",
                sourceType="dashboard",
                sourceId=1,
                frequency="daily",
                hour=14,
                recipientEmails=[self.user.email],
            )
        # Will fail on sourceId validation since no dashboard exists
        assert response.status_code == 400
