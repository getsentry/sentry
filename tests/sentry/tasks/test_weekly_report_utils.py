from datetime import datetime, timedelta
from unittest import mock
from uuid import uuid4

from django.db.models import F
from django.utils import timezone

from sentry.constants import DataCategory
from sentry.issues.grouptype import GroupCategory, PerformanceNPlusOneGroupType
from sentry.models.group import Group, GroupStatus
from sentry.models.grouplink import GroupLink
from sentry.models.groupresolution import GroupResolution
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.pullrequest import (
    PullRequest,
    PullRequestAttribution,
    PullRequestAttributionSignalType,
    PullRequestAttributionSource,
)
from sentry.models.release import Release
from sentry.models.repository import Repository
from sentry.snuba.referrer import Referrer
from sentry.tasks.summaries.organization_report_context_factory import (
    OrganizationReportContextFactory,
)
from sentry.tasks.summaries.utils import (
    ONE_DAY,
    OrganizationReportContext,
    _project_key_performance_issues_eap,
    _project_key_performance_issues_snuba,
    fetch_past_resolved_issue_links,
    org_key_error_issues,
    organization_project_issue_summaries,
    organization_top_spans,
    organization_top_spans_timeseries,
    project_past_resolved_issues,
    user_project_ownership,
)
from sentry.testutils.cases import (
    BaseSpansTestCase,
    OccurrenceTestCase,
    OutcomesSnubaTest,
    PerformanceIssueTestCase,
    SnubaTestCase,
    TestCase,
)
from sentry.testutils.factories import EventType
from sentry.testutils.helpers import with_feature
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.types.group import GroupSubStatus
from sentry.utils.dates import floor_to_utc_day
from sentry.utils.outcomes import Outcome


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


class WeeklyReportUtilsTest(
    OutcomesSnubaTest, SnubaTestCase, PerformanceIssueTestCase, OccurrenceTestCase
):
    def setUp(self) -> None:
        super().setUp()
        self.now = timezone.now()
        self.timestamp = floor_to_utc_day(self.now).timestamp()
        self.two_days_ago = self.now - timedelta(days=2)
        self.three_days_ago = self.now - timedelta(days=3)

    def store_event_outcomes(
        self,
        organization_id: int,
        project_id: int,
        timestamp: datetime,
        num_times: int,
        outcome: Outcome = Outcome.ACCEPTED,
        category: DataCategory = DataCategory.ERROR,
    ) -> None:
        self.store_outcomes(
            {
                "org_id": organization_id,
                "project_id": project_id,
                "outcome": outcome,
                "category": category,
                "timestamp": timestamp,
                "key_id": 1,
            },
            num_times=num_times,
        )

    @with_feature("organizations:escalating-issues")
    @freeze_time(before_now(days=2).replace(hour=0, minute=0, second=0, microsecond=0))
    def test_organization_project_issue_substatus_summaries(self) -> None:
        self.login_as(user=self.user)
        min_ago = (self.now - timedelta(minutes=1)).isoformat()
        event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "message",
                "timestamp": min_ago,
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
            default_event_type=EventType.DEFAULT,
        )
        event1.group.substatus = GroupSubStatus.ONGOING
        event1.group.save()

        event2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "message",
                "timestamp": min_ago,
                "fingerprint": ["group-2"],
            },
            project_id=self.project.id,
            default_event_type=EventType.DEFAULT,
        )
        event2.group.substatus = GroupSubStatus.NEW
        event2.group.save()
        timestamp = self.now.timestamp()

        self.store_event_outcomes(
            self.organization.id, self.project.id, self.two_days_ago, num_times=2
        )
        ctx = OrganizationReportContext(timestamp, ONE_DAY * 7, self.organization)
        user_project_ownership(ctx)
        results = organization_project_issue_summaries(start=ctx.start, end=ctx.end, ctx=ctx)

        substatus_totals: dict[int | None, int] = {}
        for row in results:
            substatus_totals[row["substatus"]] = (
                substatus_totals.get(row["substatus"], 0) + row["total"]
            )

        assert substatus_totals.get(GroupSubStatus.NEW, 0) == 1
        assert substatus_totals.get(GroupSubStatus.ESCALATING, 0) == 0
        assert substatus_totals.get(GroupSubStatus.ONGOING, 0) == 1
        assert substatus_totals.get(GroupSubStatus.REGRESSED, 0) == 0
        assert sum(substatus_totals.values()) == 2

    def test_org_key_error_issues_batched(self) -> None:
        self.project.first_event = self.now - timedelta(days=3)
        self.project.save()
        min_ago = (self.now - timedelta(minutes=1)).isoformat()
        event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "message",
                "timestamp": min_ago,
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
            default_event_type=EventType.DEFAULT,
        )
        event2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "message",
                "timestamp": min_ago,
                "fingerprint": ["group-2"],
            },
            project_id=self.project.id,
            default_event_type=EventType.DEFAULT,
        )
        group2 = event2.group
        group2.status = GroupStatus.RESOLVED
        group2.substatus = None
        group2.resolved_at = self.now - timedelta(minutes=1)
        group2.save()

        timestamp = self.now.timestamp()
        ctx = OrganizationReportContext(timestamp, ONE_DAY * 7, self.organization)
        user_project_ownership(ctx)
        result = org_key_error_issues(
            ctx, [self.project.id], Referrer.REPORTS_KEY_ERROR_ISSUES.value
        )
        assert result == {self.project.id: [{"events.group_id": event1.group.id, "count()": 1}]}

    def test_project_key_performance_issues_eap_matches_snuba(self) -> None:
        self.project.first_event = self.now - timedelta(days=3)
        self.project.save()

        # Create 3 events for group1 and 1 for group2 in Snuba (via search_issues)
        fingerprint_1 = f"{PerformanceNPlusOneGroupType.type_id}-group1"
        fingerprint_2 = f"{PerformanceNPlusOneGroupType.type_id}-group2"
        perf_event_1a = self.create_performance_issue(fingerprint=fingerprint_1)
        self.create_performance_issue(fingerprint=fingerprint_1)
        self.create_performance_issue(fingerprint=fingerprint_1)
        perf_event_2 = self.create_performance_issue(fingerprint=fingerprint_2)

        assert perf_event_1a.group is not None
        assert perf_event_2.group is not None
        perf_group_1 = perf_event_1a.group
        perf_group_2 = perf_event_2.group
        perf_group_1.update(last_seen=self.now, times_seen=10)
        perf_group_2.update(last_seen=self.now, times_seen=5)

        # Store matching EAP occurrences for the same groups with the same counts
        self.store_eap_items(
            [
                self.create_eap_occurrence(
                    group_id=perf_group_1.id,
                    project=self.project,
                    timestamp=self.now - timedelta(minutes=i + 1),
                    issue_occurrence_id=uuid4().hex,
                )
                for i in range(3)
            ]
            + [
                self.create_eap_occurrence(
                    group_id=perf_group_2.id,
                    project=self.project,
                    timestamp=self.now - timedelta(minutes=1),
                    issue_occurrence_id=uuid4().hex,
                ),
            ]
        )

        ctx = OrganizationReportContext(self.now.timestamp(), ONE_DAY * 7, self.organization)
        group_ids = [perf_group_1.id, perf_group_2.id]
        referrer = Referrer.REPORTS_KEY_PERFORMANCE_ISSUES.value

        snuba_rows = _project_key_performance_issues_snuba(ctx, self.project, referrer, group_ids)
        eap_rows = _project_key_performance_issues_eap(ctx, self.project, referrer, group_ids)

        assert len(snuba_rows) == 2
        assert len(eap_rows) == 2
        for snuba_row, eap_row in zip(snuba_rows, eap_rows):
            assert int(snuba_row["group_id"]) == int(eap_row["group_id"])
            assert int(snuba_row["count()"]) == int(eap_row["count()"])

        assert int(snuba_rows[0]["group_id"]) == perf_group_1.id
        assert int(snuba_rows[0]["count()"]) == 3
        assert int(snuba_rows[1]["group_id"]) == perf_group_2.id
        assert int(snuba_rows[1]["count()"]) == 1

    def test_organization_project_issue_summaries_query(self) -> None:
        """Verify organization_project_issue_summaries returns per-day, per-substatus counts."""
        three_days_ago = self.three_days_ago.isoformat()
        two_days_ago = self.two_days_ago.isoformat()

        event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "issue A",
                "timestamp": three_days_ago,
                "fingerprint": ["group-a"],
            },
            project_id=self.project.id,
            default_event_type=EventType.DEFAULT,
        )
        event1.group.substatus = GroupSubStatus.NEW
        event1.group.save()

        event2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "issue B",
                "timestamp": two_days_ago,
                "fingerprint": ["group-b"],
            },
            project_id=self.project.id,
            default_event_type=EventType.DEFAULT,
        )
        event2.group.substatus = GroupSubStatus.ESCALATING
        event2.group.save()

        event3 = self.store_event(
            data={
                "event_id": "c" * 32,
                "message": "issue C",
                "timestamp": two_days_ago,
                "fingerprint": ["group-c"],
            },
            project_id=self.project.id,
            default_event_type=EventType.DEFAULT,
        )
        event3.group.substatus = GroupSubStatus.REGRESSED
        event3.group.save()

        # Resolved issues should NOT be counted
        event4 = self.store_event(
            data={
                "event_id": "d" * 32,
                "message": "resolved issue",
                "timestamp": two_days_ago,
                "fingerprint": ["group-d"],
            },
            project_id=self.project.id,
            default_event_type=EventType.DEFAULT,
        )
        event4.group.status = GroupStatus.RESOLVED
        event4.group.substatus = None
        event4.group.save()

        ctx = OrganizationReportContext(self.timestamp, ONE_DAY * 7, self.organization)
        results = organization_project_issue_summaries(start=ctx.start, end=ctx.end, ctx=ctx)

        for row in results:
            assert row["project_id"] == self.project.id
            assert "substatus" in row
            assert "day" in row

        total = sum(row["total"] for row in results)
        assert total == 3

    @freeze_time(before_now(days=2).replace(hour=0, minute=0, second=0, microsecond=0))
    def test_past_resolved_issues_basic(self) -> None:
        self.project.first_event = self.now - timedelta(days=3)
        self.project.save()
        min_ago = (self.now - timedelta(minutes=1)).isoformat()

        event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "resolved error",
                "timestamp": min_ago,
                "fingerprint": ["resolved-1"],
            },
            project_id=self.project.id,
            default_event_type=EventType.DEFAULT,
        )
        group1 = event1.group
        group1.status = GroupStatus.RESOLVED
        group1.substatus = None
        group1.resolved_at = self.now - timedelta(minutes=1)
        group1.save()

        timestamp = self.now.timestamp()
        ctx = OrganizationReportContext(timestamp, ONE_DAY * 7, self.organization)

        results = project_past_resolved_issues(
            ctx, self.project, Referrer.REPORTS_PAST_RESOLVED_ISSUES.value
        )
        assert len(results) == 1
        assert results[0][0].id == group1.id
        assert results[0][1] >= 1
        assert results[0][2] == "Resolved"
        assert results[0][3] is None

    @mock.patch("sentry.tasks.summaries.utils._past_resolved_performance_counts")
    @freeze_time(before_now(days=2).replace(hour=0, minute=0, second=0, microsecond=0))
    def test_past_resolved_issues_includes_current_performance_categories(
        self, mock_perf_counts: mock.MagicMock
    ) -> None:
        self.project.first_event = self.now - timedelta(days=3)
        self.project.save()

        perf_event = self.create_performance_issue()
        assert perf_event.group is not None
        group = perf_event.group
        assert group.issue_category != GroupCategory.PERFORMANCE
        group.status = GroupStatus.RESOLVED
        group.substatus = None
        group.resolved_at = self.now - timedelta(minutes=1)
        group.save()
        mock_perf_counts.return_value = {group.id: 1}

        timestamp = self.now.timestamp()
        ctx = OrganizationReportContext(timestamp, ONE_DAY * 7, self.organization)

        results = project_past_resolved_issues(
            ctx, self.project, Referrer.REPORTS_PAST_RESOLVED_ISSUES.value
        )

        assert results == [(group, 1, "Resolved", None)]
        mock_perf_counts.assert_called_once()
        assert mock_perf_counts.call_args.args[2] == [group.id]

    @freeze_time(before_now(days=2).replace(hour=0, minute=0, second=0, microsecond=0))
    def test_past_resolved_issues_excludes_unresolved(self) -> None:
        self.project.first_event = self.now - timedelta(days=3)
        self.project.save()
        min_ago = (self.now - timedelta(minutes=1)).isoformat()

        event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "unresolved error",
                "timestamp": min_ago,
                "fingerprint": ["unresolved-1"],
            },
            project_id=self.project.id,
            default_event_type=EventType.DEFAULT,
        )
        assert event1.group is not None
        assert event1.group.status == GroupStatus.UNRESOLVED

        timestamp = self.now.timestamp()
        ctx = OrganizationReportContext(timestamp, ONE_DAY * 7, self.organization)

        results = project_past_resolved_issues(
            ctx, self.project, Referrer.REPORTS_PAST_RESOLVED_ISSUES.value
        )
        assert len(results) == 0

    @freeze_time(before_now(days=2).replace(hour=0, minute=0, second=0, microsecond=0))
    def test_past_resolved_issues_excludes_outside_window(self) -> None:
        self.project.first_event = self.now - timedelta(days=30)
        self.project.save()
        min_ago = (self.now - timedelta(minutes=1)).isoformat()

        event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "old resolved error",
                "timestamp": min_ago,
                "fingerprint": ["old-resolved-1"],
            },
            project_id=self.project.id,
            default_event_type=EventType.DEFAULT,
        )
        group1 = event1.group
        group1.status = GroupStatus.RESOLVED
        group1.substatus = None
        group1.resolved_at = self.now - timedelta(days=14)
        group1.save()

        timestamp = self.now.timestamp()
        ctx = OrganizationReportContext(timestamp, ONE_DAY * 7, self.organization)

        results = project_past_resolved_issues(
            ctx, self.project, Referrer.REPORTS_PAST_RESOLVED_ISSUES.value
        )
        assert len(results) == 0


class PastResolvedIssuesTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.now = timezone.now()

    def _create_resolved_group(self) -> Group:
        self.group.status = GroupStatus.RESOLVED
        self.group.substatus = None
        self.group.resolved_at = self.now - timedelta(minutes=1)
        return self.group

    def _enrich_resolution(self, group: Group) -> tuple[Group, int, str, str | None]:
        ctx = OrganizationReportContext(self.now.timestamp(), ONE_DAY * 7, self.organization)
        ctx.projects_context_map[self.project.id].past_resolved_issues = [
            (group, 1, "Resolved", None)
        ]

        fetch_past_resolved_issue_links(ctx)

        [resolution] = ctx.projects_context_map[self.project.id].past_resolved_issues
        return resolution

    def _create_release_resolution(
        self,
        group: Group,
        *,
        version: str = "1.2.3",
        type: int | None = GroupResolution.Type.in_release,
        status: int = GroupResolution.Status.resolved,
        current_release_version: str | None = None,
    ) -> Release:
        release = self.create_release(project=self.project, version=version)
        self.create_group_resolution(
            group=group,
            release=release,
            type=type,
            status=status,
            current_release_version=current_release_version,
        )
        return release

    def _create_released_resolving_pr(
        self,
        group: Group,
        release: Release,
        repository: Repository,
        *,
        key: str,
        order: int = 1,
        linked_at: datetime | None = None,
    ) -> PullRequest:
        commit = self.create_commit(repository)
        self.create_release_commit(release, commit, order=order)
        pull_request = self.create_pull_request(
            organization_id=self.organization.id,
            repository_id=repository.id,
            key=key,
        )
        pull_request.merge_commit_sha = commit.key
        pull_request.save(update_fields=["merge_commit_sha"])
        self.create_group_link(
            group=group,
            linked_id=pull_request.id,
            linked_type=GroupLink.LinkedType.pull_request,
            relationship=GroupLink.Relationship.resolves,
            **({"datetime": linked_at} if linked_at is not None else {}),
        )
        return pull_request

    def test_fetch_resolution_ignores_commit_links(self) -> None:
        group = self._create_resolved_group()
        self.create_group_link(
            group=group,
            linked_id=1,
            linked_type=GroupLink.LinkedType.commit,
            relationship=GroupLink.Relationship.resolves,
        )

        assert self._enrich_resolution(group)[2:] == ("Resolved", None)

    def test_fetch_resolution_ignores_unreleased_pr(self) -> None:
        group = self._create_resolved_group()
        repository = self.create_repo(
            self.project,
            provider="integrations:github",
            url="https://github.com/getsentry/sentry",
        )
        pull_request = self.create_pull_request(
            organization_id=self.organization.id,
            repository_id=repository.id,
            key="1",
        )
        self.create_group_link(
            group=group,
            linked_id=pull_request.id,
            linked_type=GroupLink.LinkedType.pull_request,
            relationship=GroupLink.Relationship.resolves,
        )

        assert self._enrich_resolution(group)[2:] == ("Resolved", None)

    def test_fetch_resolution_label_release(self) -> None:
        group = self._create_resolved_group()
        self._create_release_resolution(group)

        assert self._enrich_resolution(group)[2:] == ("Resolved in release", None)

    def test_fetch_resolution_label_next_release(self) -> None:
        group = self._create_resolved_group()
        release = self._create_release_resolution(
            group,
            version="2.0.0",
            type=GroupResolution.Type.in_next_release,
            status=GroupResolution.Status.pending,
        )
        repository = self.create_repo(
            self.project,
            provider="integrations:github",
            url="https://github.com/getsentry/sentry",
        )
        self._create_released_resolving_pr(group, release, repository, key="1")

        assert self._enrich_resolution(group)[2:] == ("Resolved in next release", None)

    def test_fetch_resolution_label_null_type(self) -> None:
        group = self._create_resolved_group()
        self._create_release_resolution(
            group,
            type=None,
            status=GroupResolution.Status.pending,
        )

        assert self._enrich_resolution(group)[2:] == ("Resolved in next release", None)

    def test_fetch_resolution_label_expired_next_release(self) -> None:
        """Keep the next-release label after clear_expired_resolutions rewrites the type."""
        group = self._create_resolved_group()
        self._create_release_resolution(
            group,
            version="2.0.0",
            current_release_version="1.9.0",
        )

        assert self._enrich_resolution(group)[2:] == ("Resolved in next release", None)

    def test_fetch_resolution_links_released_pr(self) -> None:
        group = self._create_resolved_group()
        release = self._create_release_resolution(group)
        repository = self.create_repo(
            self.project,
            provider="integrations:github",
            url="https://github.com/getsentry/sentry",
        )
        self._create_released_resolving_pr(group, release, repository, key="5131")

        assert self._enrich_resolution(group)[2:] == (
            "Resolved in release",
            "https://github.com/getsentry/sentry/pull/5131",
        )

    def test_fetch_resolution_ignores_pr_from_different_release(self) -> None:
        group = self._create_resolved_group()
        self._create_release_resolution(group, version="1.0.0")
        unrelated_release = self.create_release(project=self.project, version="2.0.0")
        repository = self.create_repo(
            self.project,
            provider="integrations:github",
            url="https://github.com/getsentry/sentry",
        )
        self._create_released_resolving_pr(group, unrelated_release, repository, key="5132")

        assert self._enrich_resolution(group)[2:] == ("Resolved in release", None)

    def test_fetch_resolution_uses_most_recent_released_pr(self) -> None:
        group = self._create_resolved_group()
        release = self._create_release_resolution(group)
        repository = self.create_repo(
            self.project,
            provider="integrations:github",
            url="https://github.com/getsentry/sentry",
        )
        self._create_released_resolving_pr(
            group,
            release,
            repository,
            key="1",
            order=1,
            linked_at=self.now - timedelta(hours=2),
        )
        self._create_released_resolving_pr(
            group,
            release,
            repository,
            key="2",
            order=2,
            linked_at=self.now - timedelta(hours=1),
        )

        assert self._enrich_resolution(group)[2:] == (
            "Resolved in release",
            "https://github.com/getsentry/sentry/pull/2",
        )

    def test_fetch_resolution_label_seer_fix_from_run_link(self) -> None:
        group = self._create_resolved_group()
        release = self._create_release_resolution(group)
        repository = self.create_repo(
            self.project,
            provider="integrations:github",
            url="https://github.com/getsentry/sentry",
        )
        pull_request = self._create_released_resolving_pr(group, release, repository, key="9999")
        self.create_seer_run_pull_request(self.create_seer_run(), pull_request)

        assert self._enrich_resolution(group)[2:] == (
            "Resolved by Seer Fix",
            "https://github.com/getsentry/sentry/pull/9999",
        )

    def test_fetch_resolution_label_seer_fix_from_attribution(self) -> None:
        group = self._create_resolved_group()
        release = self._create_release_resolution(group)
        repository = self.create_repo(
            self.project,
            provider="integrations:github",
            url="https://github.com/getsentry/sentry",
        )
        pull_request = self._create_released_resolving_pr(group, release, repository, key="9999")
        PullRequestAttribution.objects.create(
            pull_request=pull_request,
            signal_type=PullRequestAttributionSignalType.SENTRY_APP,
            source=PullRequestAttributionSource.SEER_DATA,
            is_valid=True,
        )

        assert self._enrich_resolution(group)[2:] == (
            "Resolved by Seer Fix",
            "https://github.com/getsentry/sentry/pull/9999",
        )

    def test_fetch_resolution_ignores_invalid_seer_attribution(self) -> None:
        group = self._create_resolved_group()
        release = self._create_release_resolution(group)
        repository = self.create_repo(
            self.project,
            provider="integrations:github",
            url="https://github.com/getsentry/sentry",
        )
        pull_request = self._create_released_resolving_pr(group, release, repository, key="9999")
        PullRequestAttribution.objects.create(
            pull_request=pull_request,
            signal_type=PullRequestAttributionSignalType.SENTRY_APP,
            source=PullRequestAttributionSource.SEER_DATA,
            is_valid=False,
        )

        assert self._enrich_resolution(group)[2:] == (
            "Resolved in release",
            "https://github.com/getsentry/sentry/pull/9999",
        )

    def test_fetch_resolution_gitlab_url(self) -> None:
        group = self._create_resolved_group()
        release = self._create_release_resolution(group)
        repository = self.create_repo(
            self.project,
            provider="integrations:gitlab",
            url="https://gitlab.com/getsentry/sentry",
        )
        self._create_released_resolving_pr(group, release, repository, key="42")

        assert self._enrich_resolution(group)[2:] == (
            "Resolved in release",
            "https://gitlab.com/getsentry/sentry/merge_requests/42",
        )
