import copy
from datetime import datetime, timedelta, timezone
from unittest import mock

from sentry.constants import DataCategory
from sentry.issues.grouptype import PerformanceNPlusOneGroupType
from sentry.models.activity import Activity
from sentry.models.group import GroupStatus
from sentry.services.hybrid_cloud.user_option import user_option_service
from sentry.tasks.summaries.daily_summary import prepare_summary_data, schedule_organizations
from sentry.tasks.summaries.utils import ONE_DAY
from sentry.testutils.cases import OutcomesSnubaTest, PerformanceIssueTestCase, SnubaTestCase
from sentry.testutils.factories import DEFAULT_EVENT_DATA
from sentry.testutils.helpers.datetime import before_now, freeze_time, iso_format
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import region_silo_test
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus
from sentry.utils.dates import to_timestamp
from sentry.utils.outcomes import Outcome


@region_silo_test
class DailySummaryTest(OutcomesSnubaTest, SnubaTestCase, PerformanceIssueTestCase):
    def store_event_and_outcomes(
        self, project_id, timestamp, fingerprint, category, num_times, release=None, resolve=True
    ):
        if category == DataCategory.ERROR:
            data = {
                "event_id": "a" * 32,
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
            num_times=num_times,
        )
        group = event.group
        if resolve:
            group.status = GroupStatus.RESOLVED
            group.substatus = None
            group.resolved_at = timestamp + timedelta(minutes=1)
            group.save()
        return group

    @freeze_time(before_now(days=2).replace(hour=12, minute=0, second=0, microsecond=0))
    def setUp(self):
        super().setUp()
        self.now = datetime.now().replace(tzinfo=timezone.utc)
        self.two_hours_ago = self.now - timedelta(hours=2)
        self.two_days_ago = self.now - timedelta(days=2)
        self.three_days_ago = self.now - timedelta(days=3)
        self.project.first_event = self.three_days_ago
        self.project.save()
        self.project2 = self.create_project(
            name="foo", organization=self.organization, teams=[self.team]
        )
        self.project2.first_event = self.three_days_ago
        user = self.create_user()
        user_option_service.set_option(user_id=user.id, key="timezone", value="America/Los_Angeles")
        self.create_member(teams=[self.team], user=user, organization=self.organization)
        self.release = self.create_release(project=self.project, date_added=self.now)

    @with_feature("organizations:daily-summary")
    @freeze_time(before_now(days=2).replace(hour=12, minute=0, second=0, microsecond=0))
    @mock.patch("sentry.tasks.summaries.daily_summary.prepare_summary_data")
    def test_schedule_organizations(self, mock_prepare_summary_data):
        user2 = self.create_user()
        self.create_member(teams=[self.team], user=user2, organization=self.organization)
        self.store_event_and_outcomes(
            self.project.id,
            self.three_days_ago,
            fingerprint="group-1",
            category=DataCategory.ERROR,
            num_times=2,
        )
        self.store_event_and_outcomes(
            self.project.id,
            self.now,
            fingerprint="group-2",
            category=DataCategory.ERROR,
            num_times=2,
        )

        with self.tasks():
            schedule_organizations(timestamp=to_timestamp(self.now))

        assert mock_prepare_summary_data.call_count == 2
        for call_args in mock_prepare_summary_data.call_args_list:
            assert call_args.args == (to_timestamp(self.now), ONE_DAY, self.organization.id)

    @freeze_time(before_now(days=2).replace(hour=12, minute=0, second=0, microsecond=0))
    def test_prepare_summary_data(self):
        group1 = self.store_event_and_outcomes(
            self.project.id,
            self.three_days_ago,
            fingerprint="group-1",
            category=DataCategory.ERROR,
            num_times=2,
        )
        self.store_event_and_outcomes(
            self.project.id,
            self.two_days_ago,
            fingerprint="group-1",
            category=DataCategory.ERROR,
            num_times=4,
        )
        self.store_event_and_outcomes(
            self.project.id,
            self.two_hours_ago,
            fingerprint="group-1",
            category=DataCategory.ERROR,
            num_times=2,
        )
        # create an issue first seen in the release
        group2 = self.store_event_and_outcomes(
            self.project.id,
            self.now,
            fingerprint="group-2",
            category=DataCategory.ERROR,
            num_times=2,
            release=self.release.version,
        )
        # reopen the issue and set it to regressed
        data = {
            "event_id": "a" * 32,
            "timestamp": iso_format(self.now),
            "stacktrace": copy.deepcopy(DEFAULT_EVENT_DATA["stacktrace"]),
            "fingerprint": ["group-2"],
            "release": self.release.version,
        }
        event = self.store_event(
            data=data,
            project_id=self.project.id,
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
        group = event.group
        group.status = GroupStatus.UNRESOLVED
        group.substatus = GroupSubStatus.REGRESSED
        group.save()
        Activity.objects.create_group_activity(
            group,
            ActivityType.SET_REGRESSION,
            data={
                "event_id": event.event_id,
                "version": self.release.version,
            },
        )
        # create and issue and set it to escalating
        data = {
            "event_id": "a" * 32,
            "timestamp": iso_format(self.now),
            "stacktrace": copy.deepcopy(DEFAULT_EVENT_DATA["stacktrace"]),
            "fingerprint": ["group-3"],
            "release": self.release.version,
        }
        event = self.store_event(
            data=data,
            project_id=self.project.id,
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
            num_times=10,
        )
        group3 = event.group
        group3.status = GroupStatus.UNRESOLVED
        group3.substatus = GroupSubStatus.ESCALATING
        group3.save()
        Activity.objects.create_group_activity(
            group3,
            ActivityType.SET_ESCALATING,
            data={
                "event_id": event.event_id,
                "version": self.release.version,
            },
        )

        # store an event in another project to be sure they're in separate buckets
        group4 = self.store_event_and_outcomes(
            self.project2.id,
            self.two_hours_ago,
            fingerprint="group-4",
            category=DataCategory.ERROR,
            num_times=2,
        )
        perf_event = self.create_performance_issue(
            fingerprint=f"{PerformanceNPlusOneGroupType.type_id}-group4"
        )
        perf_event2 = self.create_performance_issue(
            fingerprint=f"{PerformanceNPlusOneGroupType.type_id}-group5"
        )

        summary = prepare_summary_data(to_timestamp(self.now), ONE_DAY, self.organization.id)
        project_id = self.project.id

        assert summary.projects_context_map[project_id].total_today == 15
        assert summary.projects_context_map[project_id].comparison_period_avg == 1
        assert summary.projects_context_map[project_id].key_errors == [
            (group1, None, 1),
            (group3, None, 1),
            (group2, None, 1),
        ]
        assert summary.projects_context_map[project_id].key_performance_issues == [
            (perf_event2.group, None, 1),
            (perf_event.group, None, 1),
        ]
        assert summary.projects_context_map[project_id].escalated_today == [group3]
        assert summary.projects_context_map[project_id].regressed_today == [group2]
        assert summary.projects_context_map[project_id].new_in_release[self.release.id] == [
            group2,
            group3,
        ]

        project_id2 = self.project2.id
        assert summary.projects_context_map[project_id2].total_today == 2
        assert summary.projects_context_map[project_id2].comparison_period_avg == 0
        assert summary.projects_context_map[project_id2].key_errors == [(group4, None, 1)]
        assert summary.projects_context_map[project_id2].key_performance_issues == []
        assert summary.projects_context_map[project_id2].escalated_today == []
        assert summary.projects_context_map[project_id2].regressed_today == []
        assert summary.projects_context_map[project_id2].new_in_release == {}
