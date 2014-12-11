from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import TestCase


class OrganizationUsageTest(TestCase):
    def test_renders_with_context(self):
        organization = self.create_organization(name='foo', owner=self.user)
        team_1 = self.create_team(name='foo', organization=organization)
        team_2 = self.create_team(name='bar', organization=organization)

        path = reverse('sentry-organization-usage', args=[organization.slug])

        self.login_as(self.user)

        resp = self.client.get(path)

        assert resp.status_code == 200

        self.assertTemplateUsed(resp, 'sentry/organization-usage.html')

        assert resp.context['organization'] == organization
