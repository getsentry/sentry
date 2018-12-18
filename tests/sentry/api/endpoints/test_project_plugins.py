from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.plugins import plugins
from sentry.testutils import APITestCase
from mock import patch


class ProjectPluginsTest(APITestCase):

    def test_get(self):
        project = self.create_project()

        issues = plugins.get('issuetrackingplugin2')
        with patch.object(issues, 'is_hidden', return_value=True):
            self.login_as(user=self.user)

            url = reverse(
                'sentry-api-0-project-plugins',
                kwargs={
                    'organization_slug': project.organization.slug,
                    'project_slug': project.slug,
                }
            )
            response = self.client.get(url)

        assert response.status_code == 200, (response.status_code, response.content)
        assert len(response.data) >= 9

        auto_tag = response.data[0]
        assert auto_tag['name'] == 'Auto Tag: Browsers'
        assert auto_tag['enabled'] is True
        assert auto_tag['isHidden'] is False
        self.assert_plugin_shape(auto_tag)

        issues = filter(lambda p: p['slug'] == 'issuetrackingplugin2', response.data)[0]
        assert issues['name'] == 'IssueTrackingPlugin2'
        assert issues['enabled'] is False
        assert issues['isHidden'] is True
        self.assert_plugin_shape(issues)

    def assert_plugin_shape(self, plugin):
        assert 'id' in plugin
        assert 'name' in plugin
        assert 'shortName' in plugin
        assert 'slug' in plugin
        assert 'type' in plugin
        assert 'status' in plugin
