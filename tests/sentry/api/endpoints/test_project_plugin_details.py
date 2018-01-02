from __future__ import absolute_import

import mock
from django.core.urlresolvers import reverse

from sentry.plugins import plugins, NotificationPlugin
from sentry.models import ProjectOption
from sentry.testutils import APITestCase


class ProjectPluginDetailsTest(APITestCase):
    def test_simple(self):
        project = self.create_project()

        self.login_as(user=self.user)

        url = reverse(
            'sentry-api-0-project-plugin-details',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
                'plugin_id': 'webhooks',
            }
        )
        response = self.client.get(url)
        assert response.status_code == 200, (response.status_code, response.content)
        assert response.data['id'] == 'webhooks'
        assert response.data['config'] == [
            {
                'readonly': False,
                'choices': None,
                'placeholder': 'https://sentry.io/callback/url',
                'name': 'urls',
                'help': 'Enter callback URLs to POST new events to (one per line).',
                'defaultValue': None,
                'required': False,
                'type': 'textarea',
                'value': None,
                'label': 'Callback URLs',
            }
        ]


class UpdateProjectPluginTest(APITestCase):
    def test_simple(self):
        project = self.create_project()

        self.login_as(user=self.user)

        url = reverse(
            'sentry-api-0-project-plugin-details',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
                'plugin_id': 'webhooks',
            }
        )
        response = self.client.put(
            url, data={
                'urls': 'http://example.com/foo',
            }
        )
        assert response.status_code == 200, (response.status_code, response.content)
        assert ProjectOption.objects.get(
            key='webhooks:urls',
            project=project,
        ).value == 'http://example.com/foo'


class EnableProjectPluginTest(APITestCase):
    @mock.patch.object(NotificationPlugin, 'test_configuration', side_effect='test_configuration')
    def test_simple(self, test_configuration):
        project = self.create_project()

        self.login_as(user=self.user)

        plugins.get('webhooks').disable(project)

        url = reverse(
            'sentry-api-0-project-plugin-details',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
                'plugin_id': 'webhooks',
            }
        )
        response = self.client.post(url)
        assert response.status_code == 201, (response.status_code, response.content)
        assert ProjectOption.objects.get(
            key='webhooks:enabled',
            project=project,
        ).value is True

        # Testing the Plugin
        response = self.client.post(url, {'test': True})
        test_configuration.assert_called_once_with(project)
        assert response.status_code == 200, (response.status_code, response.content)

        # Reset the plugin
        response = self.client.post(url, {'reset': True})
        test_configuration.assert_called_once_with(project)
        assert response.status_code == 200, (response.status_code, response.content)

        configs = response.data.get('config')

        for config in configs:
            assert config.get('value') is None


class DisableProjectPluginTest(APITestCase):
    def test_simple(self):
        project = self.create_project()

        self.login_as(user=self.user)

        plugins.get('webhooks').enable(project)

        url = reverse(
            'sentry-api-0-project-plugin-details',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
                'plugin_id': 'webhooks',
            }
        )
        response = self.client.delete(url)
        assert response.status_code == 204, (response.status_code, response.content)
        assert ProjectOption.objects.get(
            key='webhooks:enabled',
            project=project,
        ).value is False
