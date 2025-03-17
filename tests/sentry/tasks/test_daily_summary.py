from datetime import UTC, datetime, timedelta
from typing import cast
from unittest import mock
from urllib.parse import urlencode

import orjson
import pytest
import responses
from django.conf import settings

from sentry.constants import DataCategory
from sentry.integrations.types import ExternalProviders
from sentry.issues.grouptype import PerformanceNPlusOneGroupType
from sentry.models.activity import Activity
from sentry.models.group import GroupStatus
from sentry.notifications.notifications.daily_summary import DailySummaryNotification
from sentry.tasks.summaries.daily_summary import (
    build_summary_data,
    build_top_projects_map,
    deliver_summary,
    prepare_summary_data,
    schedule_organizations,
)
from sentry.tasks.summaries.utils import ONE_DAY, DailySummaryProjectContext
from sentry.testutils.cases import (
    OutcomesSnubaTest,
    PerformanceIssueTestCase,
    SlackActivityNotificationTest,
    SnubaTestCase,
)
from sentry.testutils.factories import EventType
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.helpers.features import with_feature
from sentry.types.activity import ActivityType
from sentry.types.actor import Actor
from sentry.types.group import GroupSubStatus
from sentry.users.services.user_option import user_option_service
from sentry.utils.outcomes import Outcome


@freeze_time(before_now(days=2).replace(hour=0, minute=5, second=0, microsecond=0))
class DailySummaryTest(
    OutcomesSnubaTest, SnubaTestCase, PerformanceIssueTestCase, SlackActivityNotificationTest
):
    def store_event_and_outcomes(
        self,
        project_id,
        timestamp,
        fingerprint,
        category,
        release=None,
        resolve=True,
        level="error",
    ):
        if category == DataCategory.ERROR:
            data = {
                "timestamp": timestamp.isoformat(),
                "fingerprint": [fingerprint],
                "level": level,
                "exception": {
                    "values": [
                        {
                            "type": "IntegrationError",
                            "value": "Identity not found.",
                        }
                    ]
                },
            }
            if release:
                data["release"] = release

            event = self.store_event(
                data=data,
                project_id=project_id,
                assert_no_errors=False,
                default_event_type=EventType.DEFAULT,
            )
        elif category == DataCategory.TRANSACTION:
            event = self.create_performance_issue()

        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "project_id": project_id,
                "outcome": Outcome.ACCEPTED,
                "category": category,
                "timestamp": timestamp,
                "key_id": 1,
            },
            num_times=1,
        )

        group = event.group
        if resolve:
            group.status = GroupStatus.RESOLVED
            group.substatus = None
            group.resolved_at = timestamp + timedelta(minutes=1)
            group.save()
        return group

    def setUp(self):
        responses.add_passthru(settings.SENTRY_SNUBA)
        super().setUp()
        self.now = datetime.now(UTC)
        self.two_hours_ago = self.now - timedelta(hours=2)
        self.two_days_ago = self.now - timedelta(days=2)
        self.three_days_ago = self.now - timedelta(days=3)
        self.project.first_event = self.three_days_ago
        self.project.save()
        self.project2 = self.create_project(
            name="foo", organization=self.organization, teams=[self.team]
        )
        self.project2.first_event = self.three_days_ago
        user_option_service.set_option(user_id=self.user.id, key="timezone", value="Etc/GMT+8")
        self.release = self.create_release(project=self.project, date_added=self.now)

    def populate_event_data(
        self, use_release=True, performance_issues=True, regressed_issue=True, escalated_issue=True
    ):
        for _ in range(6):
            self.group1 = self.store_event_and_outcomes(
                self.project.id,
                self.three_days_ago,
                fingerprint="group-1",
                category=DataCategory.ERROR,
                resolve=False,
            )
        for _ in range(4):
            self.store_event_and_outcomes(
                self.project.id,
                self.two_days_ago,
                fingerprint="group-1",
                category=DataCategory.ERROR,
                resolve=False,
            )
        for _ in range(3):
            self.store_event_and_outcomes(
                self.project.id,
                self.now,
                fingerprint="group-1",
                category=DataCategory.ERROR,
                resolve=False,
            )

        # create an issue first seen in the release and set it to regressed
        for _ in range(2):
            self.group2 = self.store_event_and_outcomes(
                self.project.id,
                self.now,
                fingerprint="group-2",
                category=DataCategory.ERROR,
                release=self.release.version if use_release else None,
                resolve=False,
            )
        if regressed_issue:
            self.group2.substatus = GroupSubStatus.REGRESSED
            self.group2.save()
            Activity.objects.create_group_activity(
                self.group2,
                ActivityType.SET_REGRESSION,
                data={
                    "event_id": self.group2.get_latest_event().event_id,
                    "version": self.release.version,
                },
            )
        # create an issue and set it to escalating
        for _ in range(10):
            self.group3 = self.store_event_and_outcomes(
                self.project.id,
                self.now,
                fingerprint="group-3",
                category=DataCategory.ERROR,
                release=self.release.version if use_release else None,
                resolve=False,
            )
        if escalated_issue:
            self.group3.substatus = GroupSubStatus.ESCALATING
            self.group3.save()
            Activity.objects.create_group_activity(
                self.group3,
                ActivityType.SET_ESCALATING,
                data={
                    "event_id": self.group3.get_latest_event().event_id,
                    "version": self.release.version,
                },
            )

        # store an event in another project to be sure they're in separate buckets
        for _ in range(2):
            self.group4 = self.store_event_and_outcomes(
                self.project2.id,
                self.now,
                fingerprint="group-4",
                category=DataCategory.ERROR,
                resolve=False,
            )
        if performance_issues:
            # store some performance issues
            self.perf_event = self.create_performance_issue(
                fingerprint=f"{PerformanceNPlusOneGroupType.type_id}-group5"
            )
            self.perf_event2 = self.create_performance_issue(
                fingerprint=f"{PerformanceNPlusOneGroupType.type_id}-group6"
            )

    @with_feature("organizations:daily-summary")
    @mock.patch("sentry.tasks.summaries.daily_summary.prepare_summary_data")
    def test_schedule_organizations(self, mock_prepare_summary_data):
        user2 = self.create_user()
        self.create_member(teams=[self.team], user=user2, organization=self.organization)

        with self.tasks():
            schedule_organizations(timestamp=self.now.timestamp())

        # user2's local timezone is UTC and therefore it isn't sent now
        assert mock_prepare_summary_data.delay.call_count == 1
        for call_args in mock_prepare_summary_data.delay.call_args_list:
            assert call_args.args == (
                self.now.timestamp(),
                ONE_DAY,
                self.organization.id,
                [self.user.id],
            )

    @with_feature("organizations:daily-summary")
    @mock.patch("sentry.tasks.summaries.daily_summary.prepare_summary_data")
    def test_schedule_organizations_timing(self, mock_prepare_summary_data):
        with self.tasks(), freeze_time("2024-03-06 23:15:00"):  # 3:15PM PST
            schedule_organizations()
        assert mock_prepare_summary_data.delay.call_count == 0

        with self.tasks(), freeze_time("2024-03-07 00:00:00"):  # 4PM PST
            schedule_organizations()
        assert mock_prepare_summary_data.delay.call_count == 1

        with self.tasks(), freeze_time("2024-03-07 01:00:00"):  # 5PM PST
            schedule_organizations()
        assert (
            mock_prepare_summary_data.delay.call_count == 1
        )  # note this didn't fire again, it just didn't increase from before

    @pytest.mark.skip(reason="test is failing, but relevant feature is disabled")
    def test_build_summary_data(self):
        self.populate_event_data()

        # add another release to make sure new issues in multiple releases show up
        release2 = self.create_release(project=self.project, date_added=self.now)
        for _ in range(2):
            release2_group = self.store_event_and_outcomes(
                self.project.id,
                self.now,
                fingerprint="group-12",
                category=DataCategory.ERROR,
                release=release2.version,
                resolve=False,
            )
        summary = build_summary_data(
            timestamp=self.now.timestamp(),
            duration=ONE_DAY,
            organization=self.organization,
            daily=True,
        )
        project_id = self.project.id
        project_context_map = cast(
            DailySummaryProjectContext, summary.projects_context_map[project_id]
        )
        assert project_context_map.total_today == 17  # total outcomes from today
        assert project_context_map.comparison_period_avg == 1
        assert len(project_context_map.key_errors_by_group) == 3
        assert (self.group1, 3) in project_context_map.key_errors_by_group
        assert (self.group2, 2) in project_context_map.key_errors_by_group
        assert (self.group3, 10) in project_context_map.key_errors_by_group
        assert len(project_context_map.key_performance_issues) == 2
        assert (self.perf_event.group, 1) in project_context_map.key_performance_issues
        assert (self.perf_event2.group, 1) in project_context_map.key_performance_issues
        assert project_context_map.escalated_today == [self.group3]
        assert project_context_map.regressed_today == [self.group2]
        assert len(project_context_map.new_in_release) == 2
        assert self.group2 in project_context_map.new_in_release[self.release.id]
        assert self.group3 in project_context_map.new_in_release[self.release.id]
        assert release2_group in project_context_map.new_in_release[release2.id]

        project_id2 = self.project2.id
        project_context_map2 = cast(
            DailySummaryProjectContext, summary.projects_context_map[project_id2]
        )
        assert project_context_map2.total_today == 2
        assert project_context_map2.comparison_period_avg == 0
        assert project_context_map2.key_errors_by_group == [(self.group4, 2)]
        assert project_context_map2.key_performance_issues == []
        assert project_context_map2.escalated_today == []
        assert project_context_map2.regressed_today == []
        assert project_context_map2.new_in_release == {}

    @pytest.mark.skip(reason="flaky and part of a dead project")
    def test_build_summary_data_filter_to_unresolved(self):
        for _ in range(3):
            group1 = self.store_event_and_outcomes(
                self.project.id,
                self.now,
                fingerprint="group-1",
                category=DataCategory.ERROR,
                resolve=False,
            )

        for _ in range(3):
            group2 = self.store_event_and_outcomes(
                self.project.id,
                self.now,
                fingerprint="group-2",
                category=DataCategory.ERROR,
                resolve=False,
            )

        for _ in range(3):
            self.store_event_and_outcomes(
                self.project.id,
                self.now,
                fingerprint="group-3",
                category=DataCategory.ERROR,
                resolve=True,
            )

        summary = build_summary_data(
            timestamp=self.now.timestamp(),
            duration=ONE_DAY,
            organization=self.organization,
            daily=True,
        )
        project_id = self.project.id
        project_context_map = cast(
            DailySummaryProjectContext, summary.projects_context_map[project_id]
        )
        assert project_context_map.total_today == 9  # total outcomes from today
        assert project_context_map.comparison_period_avg == 0
        assert len(project_context_map.key_errors_by_group) == 2
        assert (group1, 3) in project_context_map.key_errors_by_group
        assert (group2, 3) in project_context_map.key_errors_by_group

    @pytest.mark.skip(reason="flaky and part of a dead project")
    def test_build_summary_data_filter_to_error_level(self):
        """Test that non-error level issues are filtered out of the results"""
        for _ in range(3):
            group1 = self.store_event_and_outcomes(
                self.project.id,
                self.now,
                fingerprint="group-1",
                category=DataCategory.ERROR,
                resolve=False,
                level="info",
            )
            group2 = self.store_event_and_outcomes(
                self.project.id,
                self.now,
                fingerprint="group-2",
                category=DataCategory.ERROR,
                resolve=False,
            )
            group3 = self.store_event_and_outcomes(
                self.project.id,
                self.now,
                fingerprint="group-3",
                category=DataCategory.ERROR,
                resolve=False,
            )

        summary = build_summary_data(
            timestamp=self.now.timestamp(),
            duration=ONE_DAY,
            organization=self.organization,
            daily=True,
        )
        project_id = self.project.id
        project_context_map = cast(
            DailySummaryProjectContext, summary.projects_context_map[project_id]
        )
        assert project_context_map.total_today == 9  # total outcomes from today
        assert project_context_map.comparison_period_avg == 0
        assert len(project_context_map.key_errors_by_group) == 2
        assert (group1, 3) not in project_context_map.key_errors_by_group
        assert (group2, 3) in project_context_map.key_errors_by_group
        assert (group3, 3) in project_context_map.key_errors_by_group

    def test_build_summary_data_dedupes_groups(self):
        """
        Test that if a group has multiple escalated and/or regressed activity rows, we only use the group once
        """
        self.populate_event_data()
        self.group2.status = GroupStatus.UNRESOLVED
        self.group2.substatus = GroupSubStatus.REGRESSED
        self.group2.save()
        Activity.objects.create_group_activity(
            self.group2,
            ActivityType.SET_REGRESSION,
            data={
                "event_id": self.group2.get_latest_event().event_id,
                "version": self.release.version,
            },
        )
        Activity.objects.create_group_activity(
            self.group3,
            ActivityType.SET_ESCALATING,
            data={
                "event_id": self.group3.get_latest_event().event_id,
                "version": self.release.version,
            },
        )
        summary = build_summary_data(
            timestamp=self.now.timestamp(),
            duration=ONE_DAY,
            organization=self.organization,
            daily=True,
        )
        project_id = self.project.id
        project_context_map = cast(
            DailySummaryProjectContext, summary.projects_context_map[project_id]
        )
        assert project_context_map.escalated_today == [self.group3]
        assert project_context_map.regressed_today == [self.group2]

    def test_build_summary_data_group_regressed_and_escalated(self):
        """
        Test that if a group has regressed and then escalated in the same day, we only list it once as escalating
        """
        self.populate_event_data()
        Activity.objects.create_group_activity(
            self.group2,
            ActivityType.SET_ESCALATING,
            data={
                "event_id": self.group2.get_latest_event().event_id,
                "version": self.release.version,
            },
        )
        self.group2.substatus = GroupSubStatus.ESCALATING
        self.group2.save()
        summary = build_summary_data(
            timestamp=self.now.timestamp(),
            duration=ONE_DAY,
            organization=self.organization,
            daily=True,
        )
        project_id = self.project.id
        project_context_map = cast(
            DailySummaryProjectContext, summary.projects_context_map[project_id]
        )
        assert project_context_map.escalated_today == [self.group3, self.group2]
        assert project_context_map.regressed_today == []

    def test_build_summary_data_group_regressed_twice_and_escalated(self):
        """
        Test that if a group has regressed, been resolved, regresssed again and then escalated in the same day, we only list it once as escalating
        """
        self.populate_event_data()
        self.group2.status = GroupStatus.RESOLVED
        self.group2.substatus = None
        self.group2.resolved_at = self.now + timedelta(minutes=1)
        self.group2.save()
        Activity.objects.create_group_activity(
            self.group2,
            ActivityType.SET_REGRESSION,
            data={
                "event_id": self.group2.get_latest_event().event_id,
                "version": self.release.version,
            },
        )
        self.group2.status = GroupStatus.UNRESOLVED
        self.group2.substatus = GroupSubStatus.REGRESSED
        self.group2.save()
        Activity.objects.create_group_activity(
            self.group2,
            ActivityType.SET_ESCALATING,
            data={
                "event_id": self.group2.get_latest_event().event_id,
                "version": self.release.version,
            },
        )
        self.group2.substatus = GroupSubStatus.ESCALATING
        self.group2.save()
        summary = build_summary_data(
            timestamp=self.now.timestamp(),
            duration=ONE_DAY,
            organization=self.organization,
            daily=True,
        )
        project_id = self.project.id
        project_context_map = cast(
            DailySummaryProjectContext, summary.projects_context_map[project_id]
        )
        assert project_context_map.escalated_today == [self.group3, self.group2]
        assert project_context_map.regressed_today == []

    def test_build_summary_data_group_regressed_escalated_in_the_past(self):
        """
        Test that if a group has regressed or escalated some time in the past over 24 hours ago, it does not show up.
        """
        for _ in range(2):
            regressed_past_group = self.store_event_and_outcomes(
                self.project.id,
                self.three_days_ago,
                fingerprint="group-12",
                category=DataCategory.ERROR,
                resolve=False,
            )
        for _ in range(2):
            escalated_past_group = self.store_event_and_outcomes(
                self.project.id,
                self.three_days_ago,
                fingerprint="group-13",
                category=DataCategory.ERROR,
                resolve=False,
            )
        with freeze_time(self.two_days_ago):
            Activity.objects.create_group_activity(
                regressed_past_group,
                ActivityType.SET_REGRESSION,
                data={
                    "event_id": regressed_past_group.get_latest_event().event_id,
                },
            )
            Activity.objects.create_group_activity(
                escalated_past_group,
                ActivityType.SET_ESCALATING,
                data={
                    "event_id": escalated_past_group.get_latest_event().event_id,
                },
            )
        summary = build_summary_data(
            timestamp=self.now.timestamp(),
            duration=ONE_DAY,
            organization=self.organization,
            daily=True,
        )
        project_id = self.project.id
        project_context_map = cast(
            DailySummaryProjectContext, summary.projects_context_map[project_id]
        )
        assert regressed_past_group not in project_context_map.regressed_today
        assert escalated_past_group not in project_context_map.escalated_today

    @mock.patch("sentry.tasks.summaries.daily_summary.deliver_summary")
    def test_prepare_summary_data(self, mock_deliver_summary):
        """Test that if the summary has data in it, we pass it along to be sent"""
        self.populate_event_data()
        with self.tasks():
            prepare_summary_data(
                self.now.timestamp(), ONE_DAY, self.organization.id, [self.user.id]
            )

        assert mock_deliver_summary.call_count == 1

    @mock.patch("sentry.tasks.summaries.daily_summary.deliver_summary")
    def test_no_data_summary_doesnt_send(self, mock_deliver_summary):
        """Test that if the summary has no data in it, we don't even try to send it"""
        with self.tasks():
            prepare_summary_data(
                self.now.timestamp(), ONE_DAY, self.organization.id, [self.user.id]
            )

        assert mock_deliver_summary.call_count == 0

    @mock.patch("sentry.notifications.notifications.base.BaseNotification.send")
    def test_deliver_summary(self, mock_send):
        self.populate_event_data()
        summary = build_summary_data(
            timestamp=self.now.timestamp(),
            duration=ONE_DAY,
            organization=self.organization,
            daily=True,
        )
        with self.tasks():
            deliver_summary(summary, [self.user.id])

        assert mock_send.call_count == 1

    def test_build_top_projects_map(self):
        self.populate_event_data()
        project3 = self.create_project(
            name="barf", organization=self.organization, teams=[self.team]
        )
        project3.first_event = self.three_days_ago
        for _ in range(15):
            self.store_event_and_outcomes(
                project3.id,
                self.now,
                fingerprint="group-1",
                category=DataCategory.ERROR,
            )
        context = build_summary_data(
            timestamp=self.now.timestamp(),
            duration=ONE_DAY,
            organization=self.organization,
            daily=True,
        )
        top_projects_context_map = build_top_projects_map(context, self.user.id)
        assert list(top_projects_context_map.keys()) == [self.project.id, project3.id]

    def test_user_scoped_projects(self):
        """Test that if an org has several projects but a user is only in project teams for 2, we only show data for those 2"""
        self.populate_event_data()
        team2 = self.create_team(organization=self.organization)
        project3 = self.create_project(name="meow", organization=self.organization, teams=[team2])
        project3.first_event = self.three_days_ago
        # make the event count higher than self.project and self.project2
        for _ in range(15):
            self.store_event_and_outcomes(
                project3.id,
                self.now,
                fingerprint="group-1",
                category=DataCategory.ERROR,
            )
        project4 = self.create_project(name="woof", organization=self.organization, teams=[team2])
        project4.first_event = self.three_days_ago
        for _ in range(15):
            self.store_event_and_outcomes(
                project4.id,
                self.now,
                fingerprint="group-1",
                category=DataCategory.ERROR,
            )

        user2 = self.create_user()
        self.create_member(teams=[self.team], user=user2, organization=self.organization)
        context = build_summary_data(
            timestamp=self.now.timestamp(),
            duration=ONE_DAY,
            organization=self.organization,
            daily=True,
        )
        top_projects_context_map = build_top_projects_map(context, user2.id)
        assert list(top_projects_context_map.keys()) == [self.project.id, self.project2.id]

    def test_slack_notification_contents(self):
        self.populate_event_data()
        ctx = build_summary_data(
            timestamp=self.now.timestamp(),
            duration=ONE_DAY,
            organization=self.organization,
            daily=True,
        )
        top_projects_context_map = build_top_projects_map(ctx, self.user.id)
        with self.tasks():
            DailySummaryNotification(
                organization=ctx.organization,
                recipient=Actor.from_object(self.user),
                provider=ExternalProviders.SLACK,
                project_context=top_projects_context_map,
            ).send()
        blocks = orjson.loads(self.mock_post.call_args.kwargs["blocks"])
        fallback_text = self.mock_post.call_args.kwargs["text"]
        link_text = "http://testserver/organizations/baz/issues/{}/?referrer=daily_summary-slack"
        assert fallback_text == f"Daily Summary for Your {self.organization.slug.title()} Projects"
        assert f":bell: *{fallback_text}*" in blocks[0]["text"]["text"]
        assert (
            "Your comprehensive overview for today - key issues, performance insights, and more."
            in blocks[0]["text"]["text"]
        )
        assert f"*{self.project.slug}*" in blocks[2]["text"]["text"]
        # check the today's event count section
        assert "*Today’s Event Count*" in blocks[3]["fields"][0]["text"]
        assert "higher than last 14d avg" in blocks[3]["fields"][1]["text"]
        # check the new in release section
        assert ":rocket:" in blocks[4]["fields"][0]["text"]
        assert self.release.version in blocks[4]["fields"][0]["text"]
        assert link_text.format(self.group2.id) in blocks[4]["fields"][1]["text"]
        assert link_text.format(self.group3.id) in blocks[4]["fields"][1]["text"]
        # check error issues
        assert "*Today's Top 3 Error Issues" in blocks[5]["fields"][0]["text"]
        assert link_text.format(self.group1.id) in blocks[5]["fields"][0]["text"]
        assert "\n`Identity not found.`" in blocks[5]["fields"][0]["text"]
        assert link_text.format(self.group2.id) in blocks[5]["fields"][0]["text"]
        assert link_text.format(self.group2.id) in blocks[5]["fields"][0]["text"]
        # check performance issues
        assert "*Today's Top 3 Performance Issues*" in blocks[5]["fields"][1]["text"]
        assert link_text.format(self.perf_event.group.id) in blocks[5]["fields"][1]["text"]
        assert "\n`db - SELECT books_author.id, b...`" in blocks[5]["fields"][1]["text"]
        assert link_text.format(self.perf_event2.group.id) in blocks[5]["fields"][1]["text"]
        # check escalated or regressed issues
        assert "*Issues that escalated today*" in blocks[6]["fields"][0]["text"]
        assert link_text.format(self.group3.id) in blocks[6]["fields"][0]["text"]
        assert "*Issues that regressed today*" in blocks[6]["fields"][1]["text"]
        assert link_text.format(self.group2.id) in blocks[6]["fields"][1]["text"]
        # repeat above for second project
        assert self.project2.slug in blocks[8]["text"]["text"]
        assert "*Today’s Event Count*" in blocks[3]["fields"][0]["text"]
        assert "*Today's Top 3 Error Issues" in blocks[10]["fields"][0]["text"]
        assert link_text.format(self.group4.id) in blocks[10]["fields"][0]["text"]
        # check footer
        assert "Getting this at a funky time?" in blocks[12]["elements"][0]["text"]
        assert (
            "<http://testserver/settings/account/|*Account Settings*>"
            in blocks[12]["elements"][0]["text"]
        )

    @with_feature("organizations:discover")
    def test_slack_notification_contents_discover_link(self):
        self.populate_event_data()
        ctx = build_summary_data(
            timestamp=self.now.timestamp(),
            duration=ONE_DAY,
            organization=self.organization,
            daily=True,
        )
        top_projects_context_map = build_top_projects_map(ctx, self.user.id)
        with self.tasks():
            DailySummaryNotification(
                organization=ctx.organization,
                recipient=Actor.from_object(self.user),
                provider=ExternalProviders.SLACK,
                project_context=top_projects_context_map,
            ).send()
        blocks = orjson.loads(self.mock_post.call_args.kwargs["blocks"])
        fallback_text = self.mock_post.call_args.kwargs["text"]
        query_params = {
            "field": ["title", "event.type", "project", "user.display", "timestamp"],
            "name": "All Events",
            "project": self.project.id,
            "query": "event.type:error",
            "sort": "-timestamp",
            "statsPeriod": "24h",
            "yAxis": "count()",
        }
        query_string = urlencode(query_params, doseq=True)
        assert fallback_text == f"Daily Summary for Your {self.organization.slug.title()} Projects"
        assert f":bell: *{fallback_text}*" in blocks[0]["text"]["text"]
        assert (
            "Your comprehensive overview for today - key issues, performance insights, and more."
            in blocks[0]["text"]["text"]
        )
        assert f"*{self.project.slug}*" in blocks[2]["text"]["text"]
        # check the today's event count section
        assert "*Today’s Event Count*" in blocks[3]["fields"][0]["text"]
        assert (
            f"/organizations/{self.organization.slug}/discover/homepage/?{query_string}"
            in blocks[3]["fields"][0]["text"]
        )
        assert "higher than last 14d avg" in blocks[3]["fields"][1]["text"]

    def test_slack_notification_contents_newline(self):
        type_string = '"""\nTraceback (most recent call last):\nFile /\'/usr/hb/meow/\''
        data = {
            "timestamp": self.now.isoformat(),
            "fingerprint": ["group-5"],
            "exception": {
                "values": [
                    {
                        "type": "WorkerLostError",
                        "value": type_string,
                    }
                ]
            },
        }
        self.store_event(
            data=data,
            project_id=self.project.id,
            assert_no_errors=False,
            default_event_type=EventType.DEFAULT,
        )
        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "project_id": self.project.id,
                "outcome": Outcome.ACCEPTED,
                "category": DataCategory.ERROR,
                "timestamp": self.now,
                "key_id": 1,
            },
            num_times=1,
        )

        ctx = build_summary_data(
            timestamp=self.now.timestamp(),
            duration=ONE_DAY,
            organization=self.organization,
            daily=True,
        )
        top_projects_context_map = build_top_projects_map(ctx, self.user.id)
        with self.tasks():
            DailySummaryNotification(
                organization=ctx.organization,
                recipient=Actor.from_object(self.user),
                provider=ExternalProviders.SLACK,
                project_context=top_projects_context_map,
            ).send()
        blocks = orjson.loads(self.mock_post.call_args.kwargs["blocks"])
        assert '""" Traceback (most recent call las...' in blocks[4]["fields"][0]["text"]

    def test_slack_notification_contents_newline_no_attachment_text(self):
        data = {
            "timestamp": self.now.isoformat(),
            "fingerprint": ["group-5"],
            "exception": {
                "values": [
                    {
                        "type": "WorkerLostError",
                        "value": None,
                    }
                ]
            },
        }
        self.store_event(
            data=data,
            project_id=self.project.id,
            assert_no_errors=False,
            default_event_type=EventType.DEFAULT,
        )
        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "project_id": self.project.id,
                "outcome": Outcome.ACCEPTED,
                "category": DataCategory.ERROR,
                "timestamp": self.now,
                "key_id": 1,
            },
            num_times=1,
        )

        ctx = build_summary_data(
            timestamp=self.now.timestamp(),
            duration=ONE_DAY,
            organization=self.organization,
            daily=True,
        )
        top_projects_context_map = build_top_projects_map(ctx, self.user.id)
        with self.tasks():
            DailySummaryNotification(
                organization=ctx.organization,
                recipient=Actor.from_object(self.user),
                provider=ExternalProviders.SLACK,
                project_context=top_projects_context_map,
            ).send()
        blocks = orjson.loads(self.mock_post.call_args.kwargs["blocks"])
        assert "" in blocks[4]["fields"][0]["text"]

    def test_slack_notification_contents_truncate_text(self):
        data = {
            "timestamp": self.now.isoformat(),
            "fingerprint": ["group-5"],
            "exception": {
                "values": [
                    {
                        "type": "OperationalErrorThatIsVeryLongForSomeReasonOhMy",
                        "value": "QueryCanceled('canceling statement due to user request\n')",
                    }
                ]
            },
        }
        self.store_event(
            data=data,
            project_id=self.project.id,
            assert_no_errors=False,
            default_event_type=EventType.DEFAULT,
        )
        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "project_id": self.project.id,
                "outcome": Outcome.ACCEPTED,
                "category": DataCategory.ERROR,
                "timestamp": self.now,
                "key_id": 1,
            },
            num_times=1,
        )

        ctx = build_summary_data(
            timestamp=self.now.timestamp(),
            duration=ONE_DAY,
            organization=self.organization,
            daily=True,
        )
        top_projects_context_map = build_top_projects_map(ctx, self.user.id)
        with self.tasks():
            DailySummaryNotification(
                organization=ctx.organization,
                recipient=Actor.from_object(self.user),
                provider=ExternalProviders.SLACK,
                project_context=top_projects_context_map,
            ).send()
        blocks = orjson.loads(self.mock_post.call_args.kwargs["blocks"])
        assert "OperationalErrorThatIsVeryLongForSo..." in blocks[4]["fields"][0]["text"]
        assert "QueryCanceled('canceling statement ..." in blocks[4]["fields"][0]["text"]

    def test_limit_to_two_projects(self):
        """Test that if we have data for more than 2 projects that we only show data for the top 2"""
        self.populate_event_data()
        project3 = self.create_project(
            name="barf", organization=self.organization, teams=[self.team]
        )
        project3.first_event = self.three_days_ago
        project3.save()
        for _ in range(15):
            self.store_event_and_outcomes(
                project3.id,
                self.now,
                fingerprint="group-1",
                category=DataCategory.ERROR,
                resolve=False,
            )
        context = build_summary_data(
            timestamp=self.now.timestamp(),
            duration=ONE_DAY,
            organization=self.organization,
            daily=True,
        )
        top_projects_context_map = build_top_projects_map(context, self.user.id)
        with self.tasks():
            DailySummaryNotification(
                organization=context.organization,
                recipient=Actor.from_object(self.user),
                provider=ExternalProviders.SLACK,
                project_context=top_projects_context_map,
            ).send()
        blocks = orjson.loads(self.mock_post.call_args.kwargs["blocks"])
        assert len(blocks) == 13

    def test_no_release_data(self):
        """
        Test that the notification formats as expected when we don't have release data
        """
        self.populate_event_data(use_release=False)
        ctx = build_summary_data(
            timestamp=self.now.timestamp(),
            duration=ONE_DAY,
            organization=self.organization,
            daily=True,
        )
        top_projects_context_map = build_top_projects_map(ctx, self.user.id)
        with self.tasks():
            DailySummaryNotification(
                organization=ctx.organization,
                recipient=Actor.from_object(self.user),
                provider=ExternalProviders.SLACK,
                project_context=top_projects_context_map,
            ).send()
        blocks = orjson.loads(self.mock_post.call_args.kwargs["blocks"])
        assert f"*{self.project.slug}*" in blocks[2]["text"]["text"]
        # check that we skip ahead to the today's event count section
        # if we had release data, it would be here instead
        assert "*Today’s Event Count*" in blocks[3]["fields"][0]["text"]
        assert "higher than last 14d avg" in blocks[3]["fields"][1]["text"]

    def test_no_performance_issues(self):
        """
        Test that the notification formats as expected when we don't have performance issues
        """
        self.populate_event_data(performance_issues=False)
        ctx = build_summary_data(
            timestamp=self.now.timestamp(),
            duration=ONE_DAY,
            organization=self.organization,
            daily=True,
        )
        top_projects_context_map = build_top_projects_map(ctx, self.user.id)
        with self.tasks():
            DailySummaryNotification(
                organization=ctx.organization,
                recipient=Actor.from_object(self.user),
                provider=ExternalProviders.SLACK,
                project_context=top_projects_context_map,
            ).send()
        blocks = orjson.loads(self.mock_post.call_args.kwargs["blocks"])
        link_text = "http://testserver/organizations/baz/issues/{}/?referrer=daily_summary-slack"
        # check the today's event count section
        assert "*Today’s Event Count*" in blocks[3]["fields"][0]["text"]
        assert "higher than last 14d avg" in blocks[3]["fields"][1]["text"]
        # check the new in release section
        assert ":rocket:" in blocks[4]["fields"][0]["text"]
        assert self.release.version in blocks[4]["fields"][0]["text"]
        assert link_text.format(self.group2.id) in blocks[4]["fields"][0]["text"]
        assert link_text.format(self.group3.id) in blocks[4]["fields"][1]["text"]
        # check error issues
        assert "*Today's Top 3 Error Issues" in blocks[5]["fields"][0]["text"]
        assert link_text.format(self.group1.id) in blocks[5]["fields"][0]["text"]
        assert link_text.format(self.group2.id) in blocks[5]["fields"][0]["text"]
        assert link_text.format(self.group2.id) in blocks[5]["fields"][0]["text"]
        # check escalated or regressed issues
        assert "*Issues that escalated today*" in blocks[6]["fields"][0]["text"]
        assert link_text.format(self.group3.id) in blocks[6]["fields"][0]["text"]
        assert "*Issues that regressed today*" in blocks[6]["fields"][1]["text"]
        assert link_text.format(self.group2.id) in blocks[6]["fields"][1]["text"]
        # repeat above for second project, skipping where performance issue info would be
        assert self.project2.slug in blocks[8]["text"]["text"]
        assert "*Today’s Event Count*" in blocks[9]["fields"][0]["text"]
        assert "*Today's Top 3 Error Issues" in blocks[10]["fields"][0]["text"]
        assert link_text.format(self.group4.id) in blocks[10]["fields"][0]["text"]
        # check footer
        assert "Getting this at a funky time?" in blocks[12]["elements"][0]["text"]

    def test_no_escalated_regressed_issues(self):
        """
        Test that the notification formats as expected when we don't have escalated and/or regressed issues
        """
        self.populate_event_data(regressed_issue=False, escalated_issue=False)
        ctx = build_summary_data(
            timestamp=self.now.timestamp(),
            duration=ONE_DAY,
            organization=self.organization,
            daily=True,
        )
        top_projects_context_map = build_top_projects_map(ctx, self.user.id)
        with self.tasks():
            DailySummaryNotification(
                organization=ctx.organization,
                recipient=Actor.from_object(self.user),
                provider=ExternalProviders.SLACK,
                project_context=top_projects_context_map,
            ).send()
        blocks = orjson.loads(self.mock_post.call_args.kwargs["blocks"])
        link_text = "http://testserver/organizations/baz/issues/{}/?referrer=daily_summary-slack"
        assert f"*{self.project.slug}*" in blocks[2]["text"]["text"]
        # check the today's event count section
        assert "*Today’s Event Count*" in blocks[3]["fields"][0]["text"]
        assert "higher than last 14d avg" in blocks[3]["fields"][1]["text"]
        # check the new in release section
        assert ":rocket:" in blocks[4]["fields"][0]["text"]
        assert self.release.version in blocks[4]["fields"][0]["text"]
        assert link_text.format(self.group2.id) in blocks[4]["fields"][0]["text"]
        assert link_text.format(self.group3.id) in blocks[4]["fields"][1]["text"]
        # check error issues
        assert "*Today's Top 3 Error Issues" in blocks[5]["fields"][0]["text"]
        assert link_text.format(self.group1.id) in blocks[5]["fields"][0]["text"]
        assert link_text.format(self.group2.id) in blocks[5]["fields"][0]["text"]
        assert link_text.format(self.group2.id) in blocks[5]["fields"][0]["text"]
        # check performance issues - skipped past escalated or regressed issues
        assert "*Today's Top 3 Performance Issues*" in blocks[5]["fields"][1]["text"]
        assert link_text.format(self.perf_event.group.id) in blocks[5]["fields"][1]["text"]
        assert link_text.format(self.perf_event2.group.id) in blocks[5]["fields"][1]["text"]
        # repeat above for second project
        assert self.project2.slug in blocks[7]["text"]["text"]
        assert "*Today’s Event Count*" in blocks[8]["fields"][0]["text"]
        assert "*Today's Top 3 Error Issues" in blocks[9]["fields"][0]["text"]
        assert link_text.format(self.group4.id) in blocks[9]["fields"][0]["text"]
        # check footer
        assert "Getting this at a funky time?" in blocks[11]["elements"][0]["text"]
