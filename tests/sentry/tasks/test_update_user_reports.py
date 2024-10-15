from datetime import datetime, timedelta
from unittest.mock import patch

from django.utils import timezone

from sentry.models.userreport import UserReport
from sentry.tasks.update_user_reports import update_user_reports
from sentry.testutils.cases import TestCase
from sentry.testutils.skips import requires_snuba
from sentry.utils.dates import epoch

pytestmark = [requires_snuba]


class UpdateUserReportTest(TestCase):
    def create_event_and_report(
        self, project_id: int, event_dt: datetime | None = None, report_dt: datetime | None = None
    ):
        event_dt = event_dt or timezone.now()
        report_dt = report_dt or timezone.now()
        event = self.store_event(data={"timestamp": event_dt.isoformat()}, project_id=project_id)
        report = UserReport.objects.create(
            project_id=project_id, event_id=event.event_id, date_added=report_dt
        )
        return event, report

    def test_simple(self):
        now = timezone.now()
        project = self.create_project()
        event1, _ = self.create_event_and_report(project.id)
        event2, _ = self.create_event_and_report(project.id)
        event3, _ = self.create_event_and_report(project.id, report_dt=now - timedelta(days=2))

        with self.tasks():
            update_user_reports(max_events=2)

        report1 = UserReport.objects.get(project_id=project.id, event_id=event1.event_id)
        report2 = UserReport.objects.get(project_id=project.id, event_id=event2.event_id)
        report3 = UserReport.objects.get(project_id=project.id, event_id=event3.event_id)
        assert report1.group_id == event1.group_id
        assert report1.environment_id == event1.get_environment().id
        assert report2.group_id == event2.group_id
        assert report2.environment_id == event2.get_environment().id
        assert report3.group_id is None
        assert report3.environment_id is None

    def test_report_timerange(self):
        # The task should only update UserReports added in the given time range.
        now = timezone.now()
        start = now - timedelta(days=3)
        end = now - timedelta(days=2)
        event_dt = start + timedelta(minutes=5)  # an arbitrary time in [start, end]

        project = self.create_project()
        event1, _ = self.create_event_and_report(
            project.id, event_dt=event_dt, report_dt=start - timedelta(days=1)
        )
        event2, _ = self.create_event_and_report(project.id, event_dt=event_dt, report_dt=start)
        event3, _ = self.create_event_and_report(
            project.id, event_dt=event_dt, report_dt=start + timedelta(days=1)
        )
        event4, _ = self.create_event_and_report(
            project.id, event_dt=event_dt, report_dt=end + timedelta(days=1)
        )

        with self.tasks():
            update_user_reports(start=start, end=end)

        report1 = UserReport.objects.get(project_id=project.id, event_id=event1.event_id)
        report2 = UserReport.objects.get(project_id=project.id, event_id=event2.event_id)
        report3 = UserReport.objects.get(project_id=project.id, event_id=event3.event_id)
        report4 = UserReport.objects.get(project_id=project.id, event_id=event4.event_id)

        assert report1.group_id is None
        assert report1.environment_id is None
        assert report2.group_id == event2.group_id
        assert report2.environment_id == event2.get_environment().id
        assert report3.group_id == event3.group_id
        assert report3.environment_id == event3.get_environment().id
        assert report4.group_id is None
        assert report4.environment_id is None

    def test_event_timerange(self):
        # The task should only query associated events from the given time range, or up to 1 day older.
        event_lookback = timedelta(days=1)

        now = timezone.now()
        start = now - timedelta(days=3)
        end = now - timedelta(days=2)
        report_dt = start + timedelta(hours=2)  # an arbitrary time in [start, end]

        project = self.create_project()
        event1, _ = self.create_event_and_report(
            project.id,
            event_dt=start - event_lookback - timedelta(hours=1),
            report_dt=report_dt,
        )
        event2, _ = self.create_event_and_report(
            project.id, event_dt=start - event_lookback, report_dt=report_dt
        )
        event3, _ = self.create_event_and_report(
            project.id, event_dt=start + timedelta(hours=1), report_dt=report_dt
        )
        event4, _ = self.create_event_and_report(
            project.id, event_dt=end + timedelta(hours=1), report_dt=report_dt
        )

        with self.tasks():
            update_user_reports(start=start, end=end, event_lookback=event_lookback)

        report1 = UserReport.objects.get(project_id=project.id, event_id=event1.event_id)
        report2 = UserReport.objects.get(project_id=project.id, event_id=event2.event_id)
        report3 = UserReport.objects.get(project_id=project.id, event_id=event3.event_id)
        report4 = UserReport.objects.get(project_id=project.id, event_id=event4.event_id)

        assert report1.group_id is None
        assert report1.environment_id is None
        assert report2.group_id == event2.group_id
        assert report2.environment_id == event2.get_environment().id
        assert report3.group_id == event3.group_id
        assert report3.environment_id == event3.get_environment().id
        assert report4.group_id is None
        assert report4.environment_id is None

    @patch("sentry.feedback.usecases.create_feedback.produce_occurrence_to_kafka")
    def test_simple_calls_feedback_shim_if_ff_enabled(self, mock_produce_occurrence_to_kafka):
        project = self.create_project()
        event1 = self.store_event(
            data={
                "environment": self.environment.name,
                "tags": {"foo": "bar"},
            },
            project_id=project.id,
        )
        UserReport.objects.create(
            project_id=project.id,
            event_id=event1.event_id,
            comments="It broke!",
            email="foo@example.com",
            name="Foo Bar",
        )
        with self.tasks():
            update_user_reports(max_events=2)

        report1 = UserReport.objects.get(project_id=project.id, event_id=event1.event_id)
        assert report1.group_id == event1.group_id
        assert report1.environment_id == event1.get_environment().id

        assert len(mock_produce_occurrence_to_kafka.mock_calls) == 1
        mock_event_data = mock_produce_occurrence_to_kafka.call_args_list[0][1]["event_data"]

        assert mock_event_data["contexts"]["feedback"]["contact_email"] == "foo@example.com"
        assert mock_event_data["contexts"]["feedback"]["message"] == "It broke!"
        assert mock_event_data["contexts"]["feedback"]["name"] == "Foo Bar"
        assert mock_event_data["environment"] == self.environment.name
        assert mock_event_data["tags"]["environment"] == self.environment.name
        assert mock_event_data["tags"]["foo"] == "bar"
        assert mock_event_data["tags"]["level"] == "error"
        assert mock_event_data["tags"]["user.email"] == "foo@example.com"

        assert mock_event_data["platform"] == "other"
        assert mock_event_data["contexts"]["feedback"]["associated_event_id"] == event1.event_id
        assert mock_event_data["level"] == "error"

    @patch("sentry.quotas.backend.get_event_retention")
    def test_event_retention(self, mock_get_event_retention):
        retention_days = 21
        mock_get_event_retention.return_value = retention_days
        project = self.create_project()
        now = timezone.now()

        event_dt = now - timedelta(days=retention_days + 1)
        report_dt = now - timedelta(days=retention_days - 1)
        event_lookback = timedelta(days=3)

        self.create_event_and_report(project.id, event_dt=event_dt, report_dt=report_dt)

        with self.tasks():
            update_user_reports(start=epoch, end=now, event_lookback=event_lookback)

        assert mock_get_event_retention.call_count > 0
        report = UserReport.objects.get()
        assert report.group_id is None
        assert report.environment_id is None
