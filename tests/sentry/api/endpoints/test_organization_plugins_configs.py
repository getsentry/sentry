from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.conf import settings

from sentry.plugins.base import plugins
from sentry.testutils import APITestCase
from sentry.runner.initializer import register_plugins, unregister_plugins


class OrganizationPluginsTest(APITestCase):
    def setUp(self):

        register_plugins(settings, raise_on_plugin_load_failure=True)

        self.projectA = self.create_project()
        self.projectB = self.create_project(organization=self.projectA.organization)
        self.projectC = self.create_project(organization=self.projectA.organization)

        plugins.get("webhooks").enable(self.projectA)

        plugins.get("trello").enable(self.projectA)
        plugins.get("trello").set_option("key", "some_value", self.projectA)
        plugins.get("trello").disable(self.projectB)
        plugins.get("trello").set_option("key", "some_value", self.projectB)
        plugins.get("trello").set_option("wrong_key", "some_value", self.projectC)

        plugins.get("opsgenie").set_option("api_key", "another_value", self.projectA)
        plugins.get("opsgenie").set_option("api_key", None, self.projectB)
        plugins.get("opsgenie").disable(self.projectB)
        plugins.get("opsgenie").set_option("api_key", "another_value", self.projectC)

        self.login_as(user=self.user)

    def tearDown(self):
        unregister_plugins(settings)

    def test_simple(self):
        url = reverse(
            "sentry-api-0-organization-plugins-configs",
            kwargs={"organization_slug": self.projectA.organization.slug},
        )

        response = self.client.get(url)

        assert response.status_code == 200, (response.status_code, response.content)

        assert filter(lambda x: x["slug"] == "webhooks", response.data)[0]["projectCount"] == 1
        assert filter(lambda x: x["slug"] == "trello", response.data)[0]["projectCount"] == 2
        assert filter(lambda x: x["slug"] == "opsgenie", response.data)[0]["projectCount"] == 2
        assert filter(lambda x: x["slug"] == "asana", response.data)[0]["projectCount"] == 0
