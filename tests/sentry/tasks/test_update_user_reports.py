from datetime import timedelta

from django.utils import timezone

from sentry.models.userreport import UserReport
from sentry.tasks.update_user_reports import update_user_reports
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


@region_silo_test
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
