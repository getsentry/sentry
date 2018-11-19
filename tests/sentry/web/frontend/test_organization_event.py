from __future__ import absolute_import

from django.core.urlresolvers import reverse
from sentry.testutils import TestCase
from sentry import options


class OrganizationEventTest(TestCase):
    def setUp(self):
        super(OrganizationEventTest, self).setUp()
        self.user = self.create_user('foo@example.com')
        self.org = self.create_organization(
            owner=self.user
        )
        self.project = self.create_project(organization=self.org)
        self.group = self.create_group(project=self.project)
        self.event = self.create_event(event_id='a' * 32, group=self.group)
        self.login_as(self.user)

    def test_redirect_to_event(self):
        resp = self.client.get(
            reverse(
                'sentry-organization-event-redirect',
                args=[
                    self.org.slug,
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
                'sentry-organization-event-redirect',
                args=[
                    self.org.slug,
                    'event1']))
        assert resp.status_code == 404
