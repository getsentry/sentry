from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.plugins import plugins
from sentry.testutils import APITestCase


class OrganizationPluginsTest(APITestCase):
    def setUp(self):
        self.projectA = self.create_project()
        self.projectB = self.create_project(organization=self.projectA.organization)

        plugins.get('webhooks').enable(self.projectA)
        plugins.get('mail').enable(self.projectB)

        self.login_as(user=self.user)

    def test_exposes_plugins_across_all_org_projects(self):
        url = reverse(
            'sentry-api-0-organization-plugins',
            kwargs={'organization_slug': self.projectA.organization.slug}
        )

        url = u'{}?{}'.format(url, 'plugins=mail&plugins=webhooks')

        response = self.client.get(url)

        assert response.status_code == 200, \
            (response.status_code, response.content)

        enabled_plugins = [
            (p['project']['id'], p['slug']) for p in
            filter(lambda p: p['enabled'], response.data)
        ]

        assert (self.projectA.id, 'webhooks') in enabled_plugins
        assert (self.projectB.id, 'mail') in enabled_plugins

    def test_exposes_specific_plugins_across_all_org_projects(self):
        url = reverse(
            'sentry-api-0-organization-plugins',
            kwargs={'organization_slug': self.projectA.organization.slug}
        )

        url = '{}?plugins=mail'.format(url)
        response = self.client.get(url)

        assert response.status_code == 200, \
            (response.status_code, response.content)

        enabled_plugins = [
            (p['project']['id'], p['slug']) for p in
            filter(lambda p: p['enabled'], response.data)
        ]

        assert (self.projectA.id, 'webhooks') not in enabled_plugins
        assert (self.projectB.id, 'mail') in enabled_plugins
