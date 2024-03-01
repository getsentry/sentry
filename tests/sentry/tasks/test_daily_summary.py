import copy
from datetime import UTC, datetime, timedelta
from typing import cast
from unittest import mock

import responses
from django.conf import settings

from sentry.constants import DataCategory
from sentry.issues.grouptype import PerformanceNPlusOneGroupType
from sentry.models.activity import Activity
from sentry.models.group import GroupStatus
from sentry.notifications.notifications.daily_summary import DailySummaryNotification
from sentry.services.hybrid_cloud.user_option import user_option_service
from sentry.tasks.summaries.daily_summary import (
    build_summary_data,
    build_top_projects_map,
    deliver_summary,
    schedule_organizations,
)
from sentry.tasks.summaries.utils import ONE_DAY, DailySummaryProjectContext
from sentry.testutils.cases import (
    OutcomesSnubaTest,
    PerformanceIssueTestCase,
    SlackActivityNotificationTest,
    SnubaTestCase,
)
from sentry.testutils.factories import DEFAULT_EVENT_DATA
from sentry.testutils.helpers.datetime import before_now, freeze_time, iso_format
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.slack import get_blocks_and_fallback_text
from sentry.testutils.silo import region_silo_test
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus
from sentry.types.integrations import ExternalProviders
from sentry.utils.dates import to_timestamp
from sentry.utils.outcomes import Outcome


@region_silo_test
@freeze_time(before_now(days=2).replace(hour=0, minute=5, second=0, microsecond=0))
class DailySummaryTest(
    OutcomesSnubaTest, SnubaTestCase, PerformanceIssueTestCase, SlackActivityNotificationTest
):
    def store_event_and_outcomes(
        self, project_id, timestamp, fingerprint, category, release=None, resolve=True
    ):
        if category == DataCategory.ERROR:
            data = {
                "timestamp": iso_format(timestamp),
                "stacktrace": copy.deepcopy(DEFAULT_EVENT_DATA["stacktrace"]),
                "fingerprint": [fingerprint],
            }
            if release:
                data["release"] = release

            event = self.store_event(
                data=data,
                project_id=project_id,
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
        user_option_service.set_option(
            user_id=self.user.id, key="timezone", value="America/Los_Angeles"
        )
        self.release = self.create_release(project=self.project, date_added=self.now)

    def populate_event_data(self):
        for _ in range(6):
            self.group1 = self.store_event_and_outcomes(
                self.project.id,
                self.three_days_ago,
                fingerprint="group-1",
                category=DataCategory.ERROR,
            )
        for _ in range(4):
            self.store_event_and_outcomes(
                self.project.id,
                self.two_days_ago,
                fingerprint="group-1",
                category=DataCategory.ERROR,
            )
        for _ in range(3):
            self.store_event_and_outcomes(
                self.project.id,
                self.now,
                fingerprint="group-1",
                category=DataCategory.ERROR,
            )

        # create an issue first seen in the release and set it to regressed
        for _ in range(2):
            self.group2 = self.store_event_and_outcomes(
                self.project.id,
                self.now,
                fingerprint="group-2",
                category=DataCategory.ERROR,
                release=self.release.version,
                resolve=False,
            )
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
        # create and issue and set it to escalating
        for _ in range(10):
            self.group3 = self.store_event_and_outcomes(
                self.project.id,
                self.now,
                fingerprint="group-3",
                category=DataCategory.ERROR,
                release=self.release.version,
                resolve=False,
            )
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
            )

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
            schedule_organizations(timestamp=to_timestamp(self.now))

        # user2's local timezone is UTC and therefore it isn't sent now
        assert mock_prepare_summary_data.delay.call_count == 1
        for call_args in mock_prepare_summary_data.delay.call_args_list:
            assert call_args.args == (
                to_timestamp(self.now),
                ONE_DAY,
                self.organization.id,
                [self.user.id],
            )

    def test_build_summary_data(self):
        self.populate_event_data()
        summary = build_summary_data(
            timestamp=to_timestamp(self.now),
            duration=ONE_DAY,
            organization=self.organization,
            daily=True,
        )
        project_id = self.project.id
        project_context_map = cast(
            DailySummaryProjectContext, summary.projects_context_map[project_id]
        )
        assert project_context_map.total_today == 15  # total outcomes from today
        assert project_context_map.comparison_period_avg == 1
        assert len(project_context_map.key_errors) == 3
        assert (self.group1, None, 3) in project_context_map.key_errors
        assert (self.group2, None, 2) in project_context_map.key_errors
        assert (self.group3, None, 10) in project_context_map.key_errors
        assert len(project_context_map.key_performance_issues) == 2
        assert (self.perf_event.group, None, 1) in project_context_map.key_performance_issues
        assert (self.perf_event2.group, None, 1) in project_context_map.key_performance_issues
        assert project_context_map.escalated_today == [self.group3]
        assert project_context_map.regressed_today == [self.group2]
        assert self.group2 in project_context_map.new_in_release[self.release.id]
        assert self.group3 in project_context_map.new_in_release[self.release.id]

        project_id2 = self.project2.id
        project_context_map2 = cast(
            DailySummaryProjectContext, summary.projects_context_map[project_id2]
        )
        assert project_context_map2.total_today == 2
        assert project_context_map2.comparison_period_avg == 0
        assert project_context_map2.key_errors == [(self.group4, None, 2)]
        assert project_context_map2.key_performance_issues == []
        assert project_context_map2.escalated_today == []
        assert project_context_map2.regressed_today == []
        assert project_context_map2.new_in_release == {}

    @mock.patch("sentry.notifications.notifications.base.BaseNotification.send")
    def test_deliver_summary(self, mock_send):
        self.populate_event_data()
        summary = build_summary_data(
            timestamp=to_timestamp(self.now),
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
            timestamp=to_timestamp(self.now),
            duration=ONE_DAY,
            organization=self.organization,
            daily=True,
        )
        top_projects_context_map = build_top_projects_map(context, self.user.id)
        assert list(top_projects_context_map.keys()) == [self.project.id, project3.id]

    @responses.activate
    @with_feature("organizations:slack-block-kit")
    def test_slack_notification_contents(self):
        self.populate_event_data()
        ctx = build_summary_data(
            timestamp=to_timestamp(self.now),
            duration=ONE_DAY,
            organization=self.organization,
            daily=True,
        )
        top_projects_context_map = build_top_projects_map(ctx, self.user.id)
        with self.tasks():
            DailySummaryNotification(
                organization=ctx.organization,
                recipient=self.user,
                provider=ExternalProviders.SLACK,
                project_context=top_projects_context_map,
            ).send()
        blocks, fallback_text = get_blocks_and_fallback_text()
        link_text = "http://testserver/organizations/baz/issues/{}/?referrer=slack"
        assert fallback_text == "Daily Summary for Your Projects (internal only!!!)"
        assert f":bell: *{fallback_text}*" in blocks[0]["text"]["text"]
        assert (
            "Your comprehensive overview for today - key issues, performance insights, and more."
            in blocks[0]["text"]["text"]
        )
        assert f"*{self.project.slug}*" in blocks[2]["text"]["text"]
        # check the new in release section
        assert ":rocket:" in blocks[3]["text"]["text"]
        assert self.release.version in blocks[3]["text"]["text"]
        assert link_text.format(self.group2.id) in blocks[3]["text"]["text"]
        assert link_text.format(self.group3.id) in blocks[3]["text"]["text"]
        # check the today's event count section
        assert "*Today’s Event Count*" in blocks[4]["text"]["text"]
        assert "higher than last 14d avg" in blocks[4]["text"]["text"]
        # check error issues
        assert "*Today's Top 3 Error Issues" in blocks[5]["text"]["text"]
        assert link_text.format(self.group1.id) in blocks[5]["text"]["text"]
        assert link_text.format(self.group2.id) in blocks[5]["text"]["text"]
        assert link_text.format(self.group2.id) in blocks[5]["text"]["text"]
        # check escalated or regressed issues
        assert "*Issues that escalated or regressed today*" in blocks[6]["text"]["text"]
        assert link_text.format(self.group2.id) in blocks[6]["text"]["text"]
        assert link_text.format(self.group3.id) in blocks[6]["text"]["text"]
        # check performance issues
        assert "*Today's Top 3 Performance Issues*" in blocks[8]["text"]["text"]
        assert link_text.format(self.perf_event.group.id) in blocks[8]["text"]["text"]
        assert link_text.format(self.perf_event2.group.id) in blocks[8]["text"]["text"]
        # repeat above for second project
        assert self.project2.slug in blocks[9]["text"]["text"]
        assert "*Today's Top 3 Error Issues" in blocks[10]["text"]["text"]
        assert link_text.format(self.group4.id) in blocks[10]["text"]["text"]
        # check footer
        assert "Getting this at a funky time?" in blocks[12]["elements"][0]["text"]
