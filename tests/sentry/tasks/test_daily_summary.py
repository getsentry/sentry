import copy
from datetime import timedelta

from django.utils import timezone as django_timezone

from sentry.constants import DataCategory
from sentry.models.group import GroupStatus
from sentry.services.hybrid_cloud.user_option import user_option_service
from sentry.tasks.daily_summary import prepare_summary_data
from sentry.tasks.weekly_reports import ONE_DAY, OrganizationReportContext
from sentry.testutils.cases import OutcomesSnubaTest, SnubaTestCase
from sentry.testutils.factories import DEFAULT_EVENT_DATA
from sentry.testutils.helpers.datetime import iso_format
from sentry.testutils.silo import region_silo_test
from sentry.utils.dates import to_timestamp
from sentry.utils.outcomes import Outcome


@region_silo_test
class DailySummaryTest(OutcomesSnubaTest, SnubaTestCase):
    def store_event_and_outcomes(self, project_id, timestamp, fingerprint, category, num_times):
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": iso_format(timestamp),
                "stacktrace": copy.deepcopy(DEFAULT_EVENT_DATA["stacktrace"]),
                "fingerprint": [fingerprint],
            },
            project_id=project_id,
        )
        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "project_id": self.project.id,
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

    def test_prepare_summary_data(self):
        now = django_timezone.now()

        two_hours_ago = now - timedelta(hours=2)
        three_hours_ago = now - timedelta(hours=3)
        self.project.first_event = three_hours_ago

        project2 = self.create_project(
            name="foo", organization=self.organization, teams=[self.team]
        )
        project2.first_event = three_hours_ago
        user = self.create_user()
        user_option_service.set_option(user_id=user.id, key="timezone", value="America/Los_Angeles")
        self.create_member(teams=[self.team], user=user, organization=self.organization)

        self.store_event_and_outcomes(
            self.project,
            two_hours_ago,
            fingerprint="group-1",
            category=DataCategory.ERROR,
            num_times=2,
        )
        self.store_event_and_outcomes(
            self.project,
            two_hours_ago,
            fingerprint="group-1",
            category=DataCategory.ERROR,
            num_times=2,
        )
        self.store_event_and_outcomes(
            self.project,
            three_hours_ago,
            fingerprint="group-2",
            category=DataCategory.TRANSACTION,
            num_times=10,
        )
        self.store_event_and_outcomes(
            project2, two_hours_ago, fingerprint="group-3", category=DataCategory.ERROR, num_times=2
        )
        self.store_event_and_outcomes(
            project2,
            three_hours_ago,
            fingerprint="group-4",
            category=DataCategory.TRANSACTION,
            num_times=10,
        )

        timestamp = to_timestamp(now)
        # start = to_datetime(timestamp - ONE_DAY)
        # end = to_datetime(timestamp)

        ctx = OrganizationReportContext(timestamp, ONE_DAY * 7, self.organization)
        summary = prepare_summary_data(timestamp, ONE_DAY, self.organization.id)
        # key_errors = project_key_errors(start, end, self.project, "reports.key_errors")
        # key_errors2 = project_key_errors(start, end, project2, "reports.key_errors")

        # event_counts = project_event_counts_for_organization(start, end, self.organization.id, "weekly_reports.outcomes")

        assert ctx
        assert summary
