from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import TestCase


class OrganizationHomeTest(TestCase):
    def test_renders_with_context(self):
        organization = self.create_organization(name='foo', owner=self.user)
        team = self.create_team(organization=organization)
        project = self.create_project(team=team)

        path = reverse('sentry-organization-home', args=[organization.id])

        self.login_as(self.user)

        resp = self.client.get(path)

        assert resp.status_code == 200

        self.assertTemplateUsed(resp, 'sentry/organization-home.html')

        assert resp.context['organization'] == organization
        assert resp.context['team_list'] == [(team, [project])]
