from __future__ import absolute_import, print_function

import six

from datetime import timedelta
from django.utils import timezone

from sentry.models import Monitor, MonitorType
from sentry.testutils import APITestCase


class MonitorDetailsTest(APITestCase):
    def test_simple(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        team = self.create_team(organization=org, members=[user])
        project = self.create_project(teams=[team])

        monitor = Monitor.objects.create(
            organization_id=org.id,
            project_id=project.id,
            next_checkin=timezone.now() - timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            config={'schedule': '* * * * *'},
        )

        self.login_as(user=user)
        with self.feature({'organizations:monitors': True}):
            resp = self.client.get('/api/0/monitors/{}/'.format(monitor.guid))

        assert resp.status_code == 200, resp.content
        assert resp.data['id'] == six.text_type(monitor.guid)
