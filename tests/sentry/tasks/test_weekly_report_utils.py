from datetime import timedelta
from unittest import mock
from uuid import uuid4

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
    OrganizationReportContext,
    organization_top_spans,
    organization_top_spans_timeseries,
    user_project_ownership,
)
from sentry.testutils.cases import BaseSpansTestCase, TestCase
from sentry.testutils.helpers import with_feature
from sentry.utils.dates import floor_to_utc_day


class OrganizationTopSpansTest(BaseSpansTestCase, TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.now = timezone.now()
        self.timestamp = floor_to_utc_day(self.now).timestamp()

    def _store_segments(
        self,
        project: Project,
        transaction: str,
        count: int,
        duration: int = 100,
    ) -> None:
        for _ in range(count):
            self.store_segment(
                project_id=project.id,
                trace_id=uuid4().hex,
                transaction_id=uuid4().hex,
                span_id=uuid4().hex[:16],
                organization_id=project.organization.id,
                timestamp=self.now - timedelta(days=1),
                duration=duration,
                transaction=transaction,
                name=transaction,
            )

    def test_populates_top_spans_and_counts(self) -> None:
        self.project.update(flags=F("flags").bitor(Project.flags.has_transactions))
        self._store_segments(self.project, "/api/users", count=3, duration=200)
        self._store_segments(self.project, "/api/orders", count=2, duration=100)

        ctx = OrganizationReportContext(self.timestamp, ONE_DAY * 7, self.organization)
        organization_top_spans(ctx, referrer=Referrer.REPORTS_TOP_SPANS.value)

        assert len(ctx.top_spans) == 2
        assert ctx.top_spans[0]["name"] == "/api/users"
        assert ctx.top_spans[0]["p95"] == 200
        assert ctx.top_spans[0]["sum"] == 600
        assert ctx.top_spans[1]["name"] == "/api/orders"
        assert ctx.top_spans[1]["p95"] == 100
        assert ctx.top_spans[1]["sum"] == 200

        assert ctx.top_spans_projects["/api/users"] == self.project.id
        assert ctx.top_spans_projects["/api/orders"] == self.project.id

        assert ctx.spans_count_by_project[self.project.id] == 5

    def test_skips_without_transaction_projects(self) -> None:
        ctx = OrganizationReportContext(self.timestamp, ONE_DAY * 7, self.organization)
        organization_top_spans(ctx, referrer=Referrer.REPORTS_TOP_SPANS.value)

        assert ctx.top_spans == []
        assert ctx.spans_count_by_project == {}

    def test_limits_to_top_5_spans(self) -> None:
        self.project.update(flags=F("flags").bitor(Project.flags.has_transactions))
        for i in range(8):
            self._store_segments(
                self.project,
                f"/api/endpoint-{i}",
                count=1,
                duration=1000 - (i * 100),
            )

        ctx = OrganizationReportContext(self.timestamp, ONE_DAY * 7, self.organization)
        organization_top_spans(ctx, referrer=Referrer.REPORTS_TOP_SPANS.value)

        assert len(ctx.top_spans) == 5

    def test_per_project_counts(self) -> None:
        project_a = self.create_project(organization=self.organization, teams=[self.team])
        project_b = self.create_project(organization=self.organization, teams=[self.team])
        project_a.update(flags=F("flags").bitor(Project.flags.has_transactions))
        project_b.update(flags=F("flags").bitor(Project.flags.has_transactions))

        self._store_segments(project_a, "/api/users", count=3)
        self._store_segments(project_b, "/api/orders", count=5)

        ctx = OrganizationReportContext(self.timestamp, ONE_DAY * 7, self.organization)
        organization_top_spans(ctx, referrer=Referrer.REPORTS_TOP_SPANS.value)

        assert ctx.spans_count_by_project[project_a.id] == 3
        assert ctx.spans_count_by_project[project_b.id] == 5

    def test_timeseries_populates_context(self) -> None:
        self.project.update(flags=F("flags").bitor(Project.flags.has_transactions))
        self._store_segments(self.project, "/api/users", count=3, duration=200)

        ctx = OrganizationReportContext(self.timestamp, ONE_DAY * 7, self.organization)
        organization_top_spans(ctx, referrer=Referrer.REPORTS_TOP_SPANS.value)
        organization_top_spans_timeseries(ctx, referrer=Referrer.REPORTS_TOP_SPANS.value)

        assert "/api/users" in ctx.top_spans_timeseries
        assert len(ctx.top_spans_timeseries["/api/users"]) == 28

    def test_timeseries_skips_without_top_spans(self) -> None:
        self.project.update(flags=F("flags").bitor(Project.flags.has_transactions))
        ctx = OrganizationReportContext(self.timestamp, ONE_DAY * 7, self.organization)
        organization_top_spans_timeseries(ctx, referrer=Referrer.REPORTS_TOP_SPANS.value)

        assert ctx.top_spans_timeseries == {}

    @with_feature("organizations:weekly-report-spans-chart")
    def test_enhanced_privacy_skips_top_spans(self) -> None:
        self.organization.update(flags=F("flags").bitor(Organization.flags.enhanced_privacy))
        self.organization.refresh_from_db()
        self.project.update(flags=F("flags").bitor(Project.flags.has_transactions))

        self._store_segments(self.project, "/api/users", count=2)

        factory = OrganizationReportContextFactory(
            timestamp=self.timestamp,
            duration=ONE_DAY * 7,
            organization=self.organization,
        )
        ctx = factory.create_context()

        assert ctx.top_spans == []

    def test_feature_flag_gates_query(self) -> None:
        self.project.update(flags=F("flags").bitor(Project.flags.has_transactions))
        self._store_segments(self.project, "/api/users", count=2)

        factory = OrganizationReportContextFactory(
            timestamp=self.timestamp,
            duration=ONE_DAY * 7,
            organization=self.organization,
        )
        ctx = factory.create_context()

        assert ctx.top_spans == []

    def test_user_project_ownership_scopes_counts(self) -> None:
        project_a = self.create_project(organization=self.organization, teams=[self.team])
        team_b = self.create_team(organization=self.organization)
        project_b = self.create_project(organization=self.organization, teams=[team_b])
        project_a.update(flags=F("flags").bitor(Project.flags.has_transactions))
        project_b.update(flags=F("flags").bitor(Project.flags.has_transactions))

        user_a = self.create_user()
        self.create_member(teams=[self.team], user=user_a, organization=self.organization)

        user_b = self.create_user()
        self.create_member(teams=[team_b], user=user_b, organization=self.organization)

        self._store_segments(project_a, "/api/users", count=4)
        self._store_segments(project_b, "/api/orders", count=6)

        ctx = OrganizationReportContext(self.timestamp, ONE_DAY * 7, self.organization)
        user_project_ownership(ctx)
        organization_top_spans(ctx, referrer=Referrer.REPORTS_TOP_SPANS.value)

        user_a_total = sum(
            count
            for pid, count in ctx.spans_count_by_project.items()
            if pid in ctx.project_ownership[user_a.id]
        )
        user_b_total = sum(
            count
            for pid, count in ctx.spans_count_by_project.items()
            if pid in ctx.project_ownership[user_b.id]
        )

        assert user_a_total == 4
        assert user_b_total == 6

    @with_feature("organizations:weekly-report-spans-chart")
    def test_factory_exception_resets_spans_count(self) -> None:
        self.project.update(flags=F("flags").bitor(Project.flags.has_transactions))
        factory = OrganizationReportContextFactory(
            timestamp=self.timestamp,
            duration=ONE_DAY * 7,
            organization=self.organization,
        )

        with mock.patch(
            "sentry.tasks.summaries.utils.organization_top_spans",
            side_effect=Exception("query failed"),
        ):
            ctx = factory.create_context()

        assert ctx.top_spans == []
        assert ctx.top_spans_projects == {}
        assert ctx.spans_count_by_project == {}
