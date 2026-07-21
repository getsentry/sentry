from unittest import mock

from django.db.models import F
from django.utils import timezone

from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.snuba.referrer import Referrer
from sentry.tasks.summaries.organization_report_context_factory import (
    OrganizationReportContextFactory,
)
from sentry.tasks.summaries.utils import (
    ONE_DAY,
    SIX_HOURS,
    OrganizationReportContext,
    organization_top_spans,
    organization_top_spans_timeseries,
    user_project_ownership,
)
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers import with_feature
from sentry.utils.dates import floor_to_utc_day


class OrganizationTopSpansTest(TestCase, SnubaTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.now = timezone.now()
        self.timestamp = floor_to_utc_day(self.now).timestamp()

    def test_populates_context(self) -> None:
        self.project.update(flags=F("flags").bitor(Project.flags.has_transactions))

        ctx = OrganizationReportContext(self.timestamp, ONE_DAY * 7, self.organization)

        mock_data = {
            "data": [
                {
                    "span.name": "/api/users",
                    "project.id": self.project.id,
                    "p95(span.duration)": 120.5,
                    "sum(span.duration)": 50000.0,
                },
                {
                    "span.name": "/api/orders",
                    "project.id": self.project.id,
                    "p95(span.duration)": 95.3,
                    "sum(span.duration)": 30000.0,
                },
            ]
        }

        with mock.patch(
            "sentry.tasks.summaries.utils.Spans.run_table_query",
            return_value=mock_data,
        ):
            organization_top_spans(ctx, referrer=Referrer.REPORTS_TOP_SPANS.value)

        assert len(ctx.top_spans) == 2
        assert ctx.top_spans[0]["name"] == "/api/users"
        assert ctx.top_spans[0]["p95"] == 120.5
        assert ctx.top_spans[0]["sum"] == 50000.0
        assert ctx.top_spans[1]["name"] == "/api/orders"

        assert ctx.top_spans_projects["/api/users"] == self.project.id
        assert ctx.top_spans_projects["/api/orders"] == self.project.id

    def test_skips_without_transactions(self) -> None:
        ctx = OrganizationReportContext(self.timestamp, ONE_DAY * 7, self.organization)

        with mock.patch("sentry.tasks.summaries.utils.Spans.run_table_query") as mock_query:
            organization_top_spans(ctx, referrer=Referrer.REPORTS_TOP_SPANS.value)
            mock_query.assert_not_called()

        assert len(ctx.top_spans) == 0

    def test_timeseries_populates_context(self) -> None:
        from sentry.utils.snuba import SnubaTSResult

        self.project.update(flags=F("flags").bitor(Project.flags.has_transactions))

        ctx = OrganizationReportContext(self.timestamp, ONE_DAY * 7, self.organization)
        ctx.top_spans = [{"name": "/api/users", "p95": 120.5, "sum": 50000.0}]

        ts1 = int(ctx.start.timestamp())
        ts2 = ts1 + SIX_HOURS

        mock_ts_result = {
            "/api/users": SnubaTSResult(
                data={
                    "data": [
                        {"time": ts1, "p95(span.duration)": 100.0},
                        {"time": ts2, "p95(span.duration)": 150.0},
                    ]
                },
                start=ctx.start,
                end=ctx.end,
                rollup=SIX_HOURS,
            )
        }

        with mock.patch(
            "sentry.tasks.summaries.utils.Spans.run_top_events_timeseries_query",
            return_value=mock_ts_result,
        ):
            organization_top_spans_timeseries(ctx, referrer=Referrer.REPORTS_TOP_SPANS.value)

        assert "/api/users" in ctx.top_spans_timeseries
        assert ctx.top_spans_timeseries["/api/users"][ts1] == 100.0
        assert ctx.top_spans_timeseries["/api/users"][ts2] == 150.0

    def test_timeseries_skips_without_top_spans(self) -> None:
        self.project.update(flags=F("flags").bitor(Project.flags.has_transactions))

        ctx = OrganizationReportContext(self.timestamp, ONE_DAY * 7, self.organization)

        with mock.patch(
            "sentry.tasks.summaries.utils.Spans.run_top_events_timeseries_query"
        ) as mock_query:
            organization_top_spans_timeseries(ctx, referrer=Referrer.REPORTS_TOP_SPANS.value)
            mock_query.assert_not_called()

        assert len(ctx.top_spans_timeseries) == 0

    @with_feature("organizations:weekly-report-spans-chart")
    def test_enhanced_privacy_skips_top_spans(self) -> None:
        self.organization.update(flags=F("flags").bitor(Organization.flags.enhanced_privacy))
        self.organization.refresh_from_db()
        self.project.update(flags=F("flags").bitor(Project.flags.has_transactions))

        factory = OrganizationReportContextFactory(
            timestamp=self.timestamp,
            duration=ONE_DAY * 7,
            organization=self.organization,
        )

        with mock.patch("sentry.tasks.summaries.utils.Spans.run_table_query") as mock_query:
            ctx = factory.create_context()
            mock_query.assert_not_called()

        assert len(ctx.top_spans) == 0

    def test_feature_flag_gates_query(self) -> None:
        self.project.update(flags=F("flags").bitor(Project.flags.has_transactions))

        factory = OrganizationReportContextFactory(
            timestamp=self.timestamp,
            duration=ONE_DAY * 7,
            organization=self.organization,
        )

        with mock.patch("sentry.tasks.summaries.utils.Spans.run_table_query") as mock_query:
            ctx = factory.create_context()
            mock_query.assert_not_called()

        assert len(ctx.top_spans) == 0

    def test_projects_filters_by_user_access(self) -> None:
        project_a = self.create_project(
            organization=self.organization,
            teams=[self.team],
        )
        team_b = self.create_team(organization=self.organization)
        project_b = self.create_project(
            organization=self.organization,
            teams=[team_b],
        )
        project_a.update(flags=F("flags").bitor(Project.flags.has_transactions))
        project_b.update(flags=F("flags").bitor(Project.flags.has_transactions))

        user_a = self.create_user()
        self.create_member(teams=[self.team], user=user_a, organization=self.organization)

        user_b = self.create_user()
        self.create_member(teams=[team_b], user=user_b, organization=self.organization)

        ctx = OrganizationReportContext(self.timestamp, ONE_DAY * 7, self.organization)
        user_project_ownership(ctx)

        mock_data = {
            "data": [
                {
                    "span.name": "/api/shared",
                    "project.id": project_a.id,
                    "p95(span.duration)": 100.0,
                    "sum(span.duration)": 40000.0,
                },
                {
                    "span.name": "/api/shared",
                    "project.id": project_b.id,
                    "p95(span.duration)": 95.0,
                    "sum(span.duration)": 30000.0,
                },
                {
                    "span.name": "/api/only-b",
                    "project.id": project_b.id,
                    "p95(span.duration)": 80.0,
                    "sum(span.duration)": 20000.0,
                },
            ]
        }

        with mock.patch(
            "sentry.tasks.summaries.utils.Spans.run_table_query",
            return_value=mock_data,
        ):
            organization_top_spans(ctx, referrer=Referrer.REPORTS_TOP_SPANS.value)

        assert ctx.top_spans_projects["/api/shared"] == project_a.id
        assert ctx.top_spans_projects["/api/only-b"] == project_b.id

        user_a_projects = ctx.project_ownership[user_a.id]
        user_b_projects = ctx.project_ownership[user_b.id]

        user_a_visible = [
            s for s in ctx.top_spans if ctx.top_spans_projects.get(s["name"]) in user_a_projects
        ]
        user_b_visible = [
            s for s in ctx.top_spans if ctx.top_spans_projects.get(s["name"]) in user_b_projects
        ]

        assert len(user_a_visible) == 1
        assert user_a_visible[0]["name"] == "/api/shared"

        assert len(user_b_visible) == 1
        assert user_b_visible[0]["name"] == "/api/only-b"

    def test_assigns_span_to_highest_sum_project(self) -> None:
        project_a = self.create_project(
            organization=self.organization,
            teams=[self.team],
        )
        project_b = self.create_project(
            organization=self.organization,
            teams=[self.team],
        )
        project_a.update(flags=F("flags").bitor(Project.flags.has_transactions))
        project_b.update(flags=F("flags").bitor(Project.flags.has_transactions))

        ctx = OrganizationReportContext(self.timestamp, ONE_DAY * 7, self.organization)

        mock_data = {
            "data": [
                {
                    "span.name": "/api/checkout",
                    "project.id": project_b.id,
                    "p95(span.duration)": 200.0,
                    "sum(span.duration)": 80000.0,
                },
                {
                    "span.name": "/api/checkout",
                    "project.id": project_a.id,
                    "p95(span.duration)": 180.0,
                    "sum(span.duration)": 20000.0,
                },
            ]
        }

        with mock.patch(
            "sentry.tasks.summaries.utils.Spans.run_table_query",
            return_value=mock_data,
        ):
            organization_top_spans(ctx, referrer=Referrer.REPORTS_TOP_SPANS.value)

        assert len(ctx.top_spans) == 1
        assert ctx.top_spans[0]["name"] == "/api/checkout"
        assert ctx.top_spans_projects["/api/checkout"] == project_b.id
