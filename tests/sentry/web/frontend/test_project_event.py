from __future__ import absolute_import

from django.core.urlresolvers import reverse
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
        self.group = self.create_group(project=self.project)
        self.event = self.create_event(event_id='a' * 32, group=self.group)

    def test_redirect_to_event(self):
        resp = self.client.get(
            reverse(
                'sentry-project-event-redirect',
                args=[
                    self.org.slug,
                    self.project.slug,
                    'a' * 32]))
        assert resp.status_code == 302
        assert resp['Location'] == '{}/{}/{}/issues/{}/events/{}/'.format(
            options.get('system.url-prefix'),
            self.org.slug,
            self.project.slug,
            self.group.id,
            self.event.id,
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
