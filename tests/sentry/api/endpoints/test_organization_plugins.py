from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.plugins import plugins
from sentry.testutils import APITestCase


class OrganizationPluginsTest(APITestCase):
    def test_exposes_plugins_across_all_org_projects(self):
        projectA = self.create_project()
        projectB = self.create_project(organization=projectA.organization)

        plugins.get('webhooks').enable(projectA)
        plugins.get('mail').enable(projectB)

        self.login_as(user=self.user)

        url = reverse(
            'sentry-api-0-organization-plugins',
            kwargs={'organization_slug': projectA.organization.slug}
        )

        response = self.client.get(url)

        assert response.status_code == 200, \
            (response.status_code, response.content)

        enabled_plugins = [
            (p['project']['id'], p['slug']) for p in
            filter(lambda p: p['enabled'], response.data)
        ]

        assert (projectA.id, 'webhooks') in enabled_plugins
        assert (projectB.id, 'mail') in enabled_plugins
