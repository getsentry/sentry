from unittest.mock import patch

from django.urls import reverse

from sentry.plugins.base import plugins
from sentry.testutils import APITestCase


class ProjectPluginsTest(APITestCase):
    def test_get(self):
        project = self.create_project()

        issues = plugins.get("issuetrackingplugin2")
        with patch.object(issues, "is_hidden", return_value=True):
            self.login_as(user=self.user)

            url = reverse(
                "sentry-api-0-project-plugins",
                kwargs={
                    "organization_slug": project.organization.slug,
                    "project_slug": project.slug,
                },
            )
            response = self.client.get(url)

        assert response.status_code == 200, (response.status_code, response.content)
        assert len(response.data) >= 9

        auto_tag = next(filter(lambda p: p["slug"] == "browsers", response.data))
        assert auto_tag["name"] == "Auto Tag: Browsers"
        assert auto_tag["enabled"] is True
        assert auto_tag["isHidden"] is False
        self.assert_plugin_shape(auto_tag)

        issues = next(filter(lambda p: p["slug"] == "issuetrackingplugin2", response.data))
        assert issues["name"] == "IssueTrackingPlugin2"
        assert issues["enabled"] is False
        assert issues["isHidden"] is True
        self.assert_plugin_shape(issues)

    def assert_plugin_shape(self, plugin):
        assert "id" in plugin
        assert "name" in plugin
        assert "shortName" in plugin
        assert "slug" in plugin
        assert "type" in plugin
        assert "status" in plugin
        assert "features" in plugin
        assert "featureDescriptions" in plugin
