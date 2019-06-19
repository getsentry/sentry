from __future__ import absolute_import

from datetime import timedelta
from django.core.urlresolvers import reverse
from django.utils import timezone
from sentry.testutils import TestCase
from sentry import options


class ProjectEventTest(TestCase):
    def setUp(self):
        super(ProjectEventTest, self).setUp()
        self.user = self.create_user()
        self.login_as(self.user)
        self.org = self.create_organization()
        self.team = self.create_team(organization=self.org, name='Mariachi Band')
        self.create_member(
            user=self.user,
            organization=self.org,
            role='owner',
            teams=[self.team],
        )
        self.project = self.create_project(organization=self.org, teams=[self.team])
        min_ago = (timezone.now() - timedelta(minutes=1)).isoformat()[:19]
        self.event = self.store_event(
            data={
                'fingerprint': ['group1'],
                'timestamp': min_ago,
            },
            project_id=self.project.id,
        )

    def test_redirect_to_event(self):
        resp = self.client.get(
            reverse(
                'sentry-project-event-redirect',
                args=[
                    self.org.slug,
                    self.project.slug,
                    self.event.event_id]))
        assert resp.status_code == 302
        assert resp['Location'] == '{}/organizations/{}/issues/{}/events/{}/'.format(
            options.get('system.url-prefix'),
            self.org.slug,
            self.event.group_id,
            self.event.event_id,
        )

    def test_event_not_found(self):
        resp = self.client.get(
            reverse(
                'sentry-project-event-redirect',
                args=[
                    self.org.slug,
                    self.project.slug,
                    'event1']))
        assert resp.status_code == 404
