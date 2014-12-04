from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import Organization, OrganizationStatus
from sentry.testutils import TestCase


class RemoveOrganizationTest(TestCase):
    def setUp(self):
        super(RemoveOrganizationTest, self).setUp()

        self.organization = self.create_organization(name='foo', owner=self.user)
        self.team = self.create_team(organization=self.organization)
        self.path = reverse('sentry-remove-organization', args=[self.organization.id])

        self.login_as(self.user)

    def test_renders_with_context(self):
        resp = self.client.get(self.path)

        assert resp.status_code == 200

        self.assertTemplateUsed(resp, 'sentry/remove-organization.html')

        assert resp.context['organization'] == self.organization
        assert resp.context['form']
        assert resp.context['team_list']

    def test_success(self):
        user2 = self.create_user('bar@example.com')

        resp = self.client.post(self.path)

        assert resp.status_code == 302

        organization = Organization.objects.get(id=self.organization.id)

        assert organization.status == OrganizationStatus.PENDING_DELETION
