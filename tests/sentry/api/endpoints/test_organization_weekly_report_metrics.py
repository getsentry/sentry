from datetime import datetime, timezone

from sentry.tasks.summaries.weekly_report_cache import cache_project_metrics
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import freeze_time

SATURDAY = datetime(2025, 1, 4, 12, 0, tzinfo=timezone.utc)
SATURDAY_TS = datetime(2025, 1, 4, tzinfo=timezone.utc).timestamp()
PREV_SATURDAY_TS = SATURDAY_TS - (86400 * 7)


class OrganizationWeeklyReportMetricsEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-weekly-report-metrics"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.current_ts = SATURDAY_TS
        self.previous_ts = PREV_SATURDAY_TS

    def test_feature_flag_off(self) -> None:
        response = self.get_response(self.organization.slug)
        assert response.status_code == 404

    @freeze_time(SATURDAY)
    def test_empty_cache(self) -> None:
        with self.feature("organizations:weekly-report-metrics-api"):
            response = self.get_success_response(self.organization.slug)
        assert response.data["dataAvailable"] is False
        assert response.data["projects"] == []

    @freeze_time(SATURDAY)
    def test_current_week_only(self) -> None:
        cache_project_metrics(
            self.organization.id,
            self.current_ts,
            {self.project.id: {"e": 500, "t": 3000}},
        )

        with self.feature("organizations:weekly-report-metrics-api"):
            response = self.get_success_response(self.organization.slug)

        assert response.data["dataAvailable"] is True
        assert len(response.data["projects"]) == 1

        project_data = response.data["projects"][0]
        assert project_data["id"] == str(self.project.id)
        assert project_data["slug"] == self.project.slug
        assert project_data["currentWeek"] == {
            "totalErrors": 500,
            "totalTransactions": 3000,
        }
        assert project_data["previousWeek"] is None
        assert project_data["change"] is None

    @freeze_time(SATURDAY)
    def test_both_weeks_with_percentage_change(self) -> None:
        cache_project_metrics(
            self.organization.id,
            self.current_ts,
            {self.project.id: {"e": 100, "t": 200}},
        )
        cache_project_metrics(
            self.organization.id,
            self.previous_ts,
            {self.project.id: {"e": 80, "t": 250}},
        )

        with self.feature("organizations:weekly-report-metrics-api"):
            response = self.get_success_response(self.organization.slug)

        project_data = response.data["projects"][0]
        assert project_data["currentWeek"] == {"totalErrors": 100, "totalTransactions": 200}
        assert project_data["previousWeek"] == {"totalErrors": 80, "totalTransactions": 250}
        assert project_data["change"] == {
            "totalErrors": 25.0,
            "totalTransactions": -20.0,
        }

    @freeze_time(SATURDAY)
    def test_pct_change_previous_zero(self) -> None:
        cache_project_metrics(
            self.organization.id,
            self.current_ts,
            {self.project.id: {"e": 100, "t": 0}},
        )
        cache_project_metrics(
            self.organization.id,
            self.previous_ts,
            {self.project.id: {"e": 0, "t": 0}},
        )

        with self.feature("organizations:weekly-report-metrics-api"):
            response = self.get_success_response(self.organization.slug)

        change = response.data["projects"][0]["change"]
        assert change["totalErrors"] is None
        assert change["totalTransactions"] == 0.0

    @freeze_time(SATURDAY)
    def test_multiple_projects(self) -> None:
        p2 = self.create_project(organization=self.organization, teams=[self.team])

        cache_project_metrics(
            self.organization.id,
            self.current_ts,
            {
                self.project.id: {"e": 100, "t": 200},
                p2.id: {"e": 300, "t": 400},
            },
        )

        with self.feature("organizations:weekly-report-metrics-api"):
            response = self.get_success_response(self.organization.slug)

        assert response.data["dataAvailable"] is True
        assert len(response.data["projects"]) == 2
        slugs = {p["slug"] for p in response.data["projects"]}
        assert self.project.slug in slugs
        assert p2.slug in slugs

    @freeze_time(datetime(2025, 1, 7, 15, 0, tzinfo=timezone.utc))
    def test_non_saturday_request_finds_cached_saturday_data(self) -> None:
        """Endpoint looks up the most recent Saturday, not today."""
        cache_project_metrics(
            self.organization.id,
            self.current_ts,
            {self.project.id: {"e": 42, "t": 100}},
        )

        with self.feature("organizations:weekly-report-metrics-api"):
            response = self.get_success_response(self.organization.slug)

        assert response.data["dataAvailable"] is True
        assert response.data["projects"][0]["currentWeek"] == {
            "totalErrors": 42,
            "totalTransactions": 100,
        }

    @freeze_time(SATURDAY)
    def test_only_returns_accessible_projects(self) -> None:
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)

        cache_project_metrics(
            other_org.id,
            self.current_ts,
            {other_project.id: {"e": 999, "t": 999}},
        )

        with self.feature("organizations:weekly-report-metrics-api"):
            response = self.get_success_response(self.organization.slug)

        assert response.data["projects"] == []
