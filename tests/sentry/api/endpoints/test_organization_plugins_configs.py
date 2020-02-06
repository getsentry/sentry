from __future__ import absolute_import

from django.core.urlresolvers import reverse
from sentry.plugins.base import plugins
from sentry.testutils import APITestCase


class OrganizationPluginsTest(APITestCase):
    def setUp(self):
        self.projectA = self.create_project(slug="proj_a")
        self.organization = self.projectA.organization
        self.projectB = self.create_project(
            slug="proj_b", organization=self.organization, platform="react"
        )

        self.url = reverse(
            "sentry-api-0-organization-plugins-configs",
            kwargs={"organization_slug": self.organization.slug},
        )

        self.login_as(user=self.user)

    def test_no_configs(self):
        response = self.client.get(self.url)
        assert response.status_code == 200, (response.status_code, response.content)
        # the number of plugins might change so let's just make sure we have most of them
        assert len(response.data) > 18

    def test_only_configuable_plugins(self):
        response = self.client.get(self.url)
        assert filter(lambda x: not x["hasConfiguration"], response.data) == []

    def test_enabled_not_configured(self):
        plugins.get("webhooks").enable(self.projectA)
        response = self.client.get(self.url)
        assert filter(lambda x: x["slug"] == "webhooks", response.data)[0]["projectList"] == []

    def test_configured_not_enabled(self):
        plugins.get("trello").disable(self.projectA)
        plugins.get("trello").set_option("key", "some_value", self.projectA)
        response = self.client.get(self.url)
        assert filter(lambda x: x["slug"] == "trello", response.data)[0]["projectList"] == [
            {
                "projectId": self.projectA.id,
                "projectSlug": self.projectA.slug,
                "projectName": self.projectA.name,
                "enabled": False,
                "configured": True,
                "projectPlatform": None,
            }
        ]

    def test_configured_and_enabled(self):
        plugins.get("trello").enable(self.projectA)
        plugins.get("trello").set_option("key", "some_value", self.projectA)
        response = self.client.get(self.url)
        assert filter(lambda x: x["slug"] == "trello", response.data)[0]["projectList"] == [
            {
                "projectId": self.projectA.id,
                "projectSlug": self.projectA.slug,
                "projectName": self.projectA.name,
                "enabled": True,
                "configured": True,
                "projectPlatform": None,
            }
        ]

    def test_configured_multiple_projects(self):
        plugins.get("trello").set_option("key", "some_value", self.projectA)
        plugins.get("trello").set_option("key", "another_value", self.projectB)
        response = self.client.get(self.url)
        projectList = filter(lambda x: x["slug"] == "trello", response.data)[0]["projectList"]
        assert filter(lambda x: x["projectId"] == self.projectA.id, projectList)[0] == {
            "projectId": self.projectA.id,
            "projectSlug": self.projectA.slug,
            "projectName": self.projectA.name,
            "enabled": False,
            "configured": True,
            "projectPlatform": None,
        }
        assert filter(lambda x: x["projectId"] == self.projectB.id, projectList)[0] == {
            "projectId": self.projectB.id,
            "projectSlug": self.projectB.slug,
            "projectName": self.projectB.name,
            "enabled": False,
            "configured": True,
            "projectPlatform": "react",
        }

    def test_query_parameter(self):
        url = self.url + "?plugins=trello"
        response = self.client.get(url)
        assert len(response.data) == 1
        assert response.data[0]["id"] == "trello"

    def test_query_parameter_bad_slug(self):
        url = self.url + "?plugins=bad_plugin"
        response = self.client.get(url)
        assert response.status_code == 404
        assert response.data["detail"] == "Plugin bad_plugin not found"

    def test_sort_by_slug(self):
        another = self.create_project(slug="another")
        plugins.get("trello").set_option("key", "some_value", self.projectA)
        plugins.get("trello").set_option("key", "some_value", self.projectB)
        plugins.get("trello").set_option("key", "some_value", another)
        url = self.url + "?plugins=trello"
        response = self.client.get(url)
        assert map(lambda x: x["projectSlug"], response.data[0]["projectList"]) == [
            "another",
            "proj_a",
            "proj_b",
        ]
