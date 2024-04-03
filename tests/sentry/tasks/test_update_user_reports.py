from datetime import timedelta

from django.utils import timezone

from sentry.models.userreport import UserReport
from sentry.tasks.update_user_reports import update_user_reports
from sentry.testutils.cases import TestCase
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


class UpdateUserReportTest(TestCase):
    def test_simple(self):
        now = timezone.now()
        project = self.create_project()
        event1 = self.store_event(data={}, project_id=project.id)
        UserReport.objects.create(project_id=project.id, event_id=event1.event_id)
        event2 = self.store_event(data={}, project_id=project.id)
        UserReport.objects.create(project_id=project.id, event_id=event2.event_id)
        event3 = self.store_event(data={}, project_id=project.id)
        UserReport.objects.create(
            project_id=project.id, event_id=event3.event_id, date_added=now - timedelta(days=2)
        )

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

    def test_start_end(self):
        now = timezone.now()
        project = self.create_project()
        event1 = self.store_event(data={}, project_id=project.id)
        UserReport.objects.create(
            project_id=project.id, event_id=event1.event_id, date_added=now - timedelta(days=4)
        )
        event2 = self.store_event(data={}, project_id=project.id)
        UserReport.objects.create(
            project_id=project.id, event_id=event2.event_id, date_added=now - timedelta(days=3)
        )
        event3 = self.store_event(data={}, project_id=project.id)
        UserReport.objects.create(
            project_id=project.id, event_id=event3.event_id, date_added=now - timedelta(days=2)
        )
        event4 = self.store_event(data={}, project_id=project.id)
        UserReport.objects.create(
            project_id=project.id, event_id=event4.event_id, date_added=now - timedelta(days=1)
        )
        event5 = self.store_event(data={}, project_id=project.id)
        UserReport.objects.create(project_id=project.id, event_id=event5.event_id, date_added=now)
        with self.tasks():
            update_user_reports(start=now - timedelta(days=3), end=now - timedelta(days=2))

        report1 = UserReport.objects.get(project_id=project.id, event_id=event1.event_id)
        report2 = UserReport.objects.get(project_id=project.id, event_id=event2.event_id)
        report3 = UserReport.objects.get(project_id=project.id, event_id=event3.event_id)
        report4 = UserReport.objects.get(project_id=project.id, event_id=event4.event_id)
        report5 = UserReport.objects.get(project_id=project.id, event_id=event5.event_id)

        assert report1.group_id is None
        assert report1.environment_id is None
        assert report2.group_id == event2.group_id
        assert report2.environment_id == event2.get_environment().id
        assert report3.group_id == event3.group_id
        assert report3.environment_id == event3.get_environment().id
        assert report4.group_id is None
        assert report4.environment_id is None
        assert report5.group_id is None
        assert report5.environment_id is None
