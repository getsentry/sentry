import copy
from datetime import datetime, timedelta, timezone

from sentry.constants import DataCategory
from sentry.models.activity import Activity
from sentry.models.group import GroupStatus
from sentry.services.hybrid_cloud.user_option import user_option_service
from sentry.tasks.summaries.daily_summary import prepare_summary_data
from sentry.tasks.summaries.weekly_reports import ONE_DAY, OrganizationReportContext
from sentry.testutils.cases import OutcomesSnubaTest, SnubaTestCase
from sentry.testutils.factories import DEFAULT_EVENT_DATA
from sentry.testutils.helpers.datetime import before_now, freeze_time, iso_format
from sentry.testutils.silo import region_silo_test
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus
from sentry.utils.dates import to_timestamp
from sentry.utils.outcomes import Outcome


@region_silo_test
class DailySummaryTest(OutcomesSnubaTest, SnubaTestCase):
    def store_event_and_outcomes(
        self, project_id, timestamp, fingerprint, category, num_times, release=None
    ):
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

        group.status = GroupStatus.RESOLVED
        group.substatus = None
        group.resolved_at = timestamp + timedelta(minutes=1)
        group.save()
        return group

    @freeze_time(before_now(days=2).replace(hour=12, minute=0, second=0, microsecond=0))
    def test_prepare_summary_data(self):
        now = datetime.now().replace(tzinfo=timezone.utc)
        two_hours_ago = now - timedelta(hours=2)
        two_days_ago = now - timedelta(days=2)
        three_days_ago = now - timedelta(days=3)
        self.project.first_event = three_days_ago
        self.project.save()
        project2 = self.create_project(
            name="foo", organization=self.organization, teams=[self.team]
        )
        project2.first_event = three_days_ago
        user = self.create_user()
        user_option_service.set_option(user_id=user.id, key="timezone", value="America/Los_Angeles")
        self.create_member(teams=[self.team], user=user, organization=self.organization)
        release = self.create_release(project=self.project, date_added=now)

        group1 = self.store_event_and_outcomes(
            self.project.id,
            two_hours_ago,
            fingerprint="group-1",
            category=DataCategory.ERROR,
            num_times=2,
        )
        self.store_event_and_outcomes(
            self.project.id,
            three_days_ago,
            fingerprint="group-1",
            category=DataCategory.ERROR,
            num_times=2,
        )
        # create an issue first seen in the release
        group5 = self.store_event_and_outcomes(
            self.project.id,
            now,
            fingerprint="group-5",
            category=DataCategory.ERROR,
            num_times=2,
            release=release.version,
        )
        # reopen the issue and set it to regressed
        data = {
            "event_id": "a" * 32,
            "timestamp": iso_format(now),
            "stacktrace": copy.deepcopy(DEFAULT_EVENT_DATA["stacktrace"]),
            "fingerprint": ["group-5"],
        }
        if release:
            data["release"] = release.version
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
                "timestamp": now,
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
                "version": release.version,
            },
        )

        self.store_event_and_outcomes(
            self.project.id,
            two_days_ago,
            fingerprint="group-1",
            category=DataCategory.ERROR,
            num_times=4,
        )
        group2 = self.store_event_and_outcomes(
            self.project.id,
            three_days_ago,
            fingerprint="group-2",
            category=DataCategory.TRANSACTION,
            num_times=10,
        )
        self.store_event_and_outcomes(
            project2.id,
            two_hours_ago,
            fingerprint="group-3",
            category=DataCategory.ERROR,
            num_times=2,
        )
        self.store_event_and_outcomes(
            project2.id,
            three_days_ago,
            fingerprint="group-4",
            category=DataCategory.TRANSACTION,
            num_times=10,
        )

        timestamp = to_timestamp(now)
        ctx = OrganizationReportContext(timestamp, ONE_DAY * 14, self.organization, daily=True)
        summary = prepare_summary_data(ctx)
        project_id = self.project.id

        assert summary.projects[project_id].total_today == 5
        assert summary.projects[project_id].fourteen_day_avg == 1
        assert summary.projects[project_id].key_errors == [
            (group1, None, 3),
            (group5, None, 2),
            (group2, None, 1),
        ]
        # TODO: test performance issues later
        assert summary.projects[project_id].key_performance_issues == []
        assert summary.projects[project_id].escalated_today == []
        assert summary.projects[project_id].regressed_today == [group5]
        assert summary.projects[project_id].new_in_release[release.id] == [group5]
