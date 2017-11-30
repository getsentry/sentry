from __future__ import absolute_import

from sentry.models import UserReport
from sentry.tasks.user_reports import backfill_group
from sentry.testutils import TestCase


class UserReporBackfillGroupTest(TestCase):
    def test_simple(self):
        org = self.create_organization()
        project = self.create_project(organization=org)
        group = self.create_group(project=project)
        event = self.create_event(group=group)
        report = UserReport.objects.create(
            project=project,
            event_id=event.event_id,
            email='foo@example.com',
            comments='i clicked it and it broke',
        )

        assert report.group is None

        with self.tasks():
            backfill_group(report.id)

        assert UserReport.objects.get(id=report.id).group == group
