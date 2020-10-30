from __future__ import absolute_import

from datetime import timedelta

from django.utils import timezone

from sentry.models import UserReport
from sentry.tasks.update_user_reports import update_user_reports
from sentry.testutils import TestCase


class UpdateUserReportTest(TestCase):
    def test_simple(self):
        now = timezone.now()
        project = self.create_project()
        event1 = self.store_event(data={}, project_id=project.id)
        report1 = UserReport.objects.create(project=project, event_id=event1.event_id)
        event2 = self.store_event(data={}, project_id=project.id)
        report2 = UserReport.objects.create(project=project, event_id=event2.event_id)
        event3 = self.store_event(data={}, project_id=project.id)
        report3 = UserReport.objects.create(
            project=project, event_id=event3.event_id, date_added=now - timedelta(days=2)
        )

        with self.tasks():
            update_user_reports()

        report1 = UserReport.objects.get(project=project, event_id=event1.event_id)
        report2 = UserReport.objects.get(project=project, event_id=event2.event_id)
        report3 = UserReport.objects.get(project=project, event_id=event3.event_id)
        assert report1.group_id == event1.group_id
        assert report1.environment == event1.get_environment()
        assert report2.group_id == event2.group_id
        assert report2.environment == event2.get_environment()
        assert report3.group is None
        assert report3.environment is None
