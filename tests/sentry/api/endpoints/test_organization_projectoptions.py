from datetime import datetime

from django.urls import reverse
from django.utils import timezone
from freezegun import freeze_time

from sentry.testutils import APITestCase


class OrganizationProjectOptionsTest(APITestCase):
    CURRENT_TIME = datetime(2022, 9, 29, 0, 0, tzinfo=timezone.utc)

    @freeze_time(CURRENT_TIME)
    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.project1 = self.create_project(
            organization=self.organization, slug="project1", name="Project 1"
        )
        self.project1.update_option("sentry:spike_projection_config", True)
        self.project1.update_option("option2", "hello")
        self.project2 = self.create_project(
            organization=self.organization, slug="project2", name="Project 2"
        )
        self.project2.update_option("option3", 123)
        self.organization2 = self.create_organization(slug="org2", owner=self.user)
        self.project3 = self.create_project(organization=self.organization2)
        self.path = reverse(
            "sentry-api-0-organization-project-options",
            args=[self.organization.slug],
        )
        self.now = datetime(2022, 9, 29, 0, 0, tzinfo=timezone.utc)
        self.options_list = [
            "sentry:option-epoch",
            "sentry:csp_ignored_sources_defaults",
            "sentry:csp_ignored_sources",
            "sentry:reprocessing_active",
            "sentry:performance_issue_creation_rate",
            "filters:blacklisted_ips",
            "filters:releases",
            "filters:error_messages",
            "feedback:branding",
        ]

    def test_organization_projectoptions_get_all(self):
        response = self.client.get(self.path)

        assert response.status_code == 200

        project1_options = response.data[1]["options"]
        project2_options = response.data[0]["options"]

        assert project1_options["sentry:spike_projection_config"]
        assert not project1_options.get("option2")
        assert not project2_options.get("option3")

        for option in self.options_list:
            assert option in project1_options
            assert option in project2_options

        assert response.data[1]["id"] == str(self.project1.id)
        assert response.data[1]["slug"] == self.project1.slug
        assert response.data[1]["name"] == self.project1.name
        assert response.data[0]["id"] == str(self.project2.id)
        assert response.data[0]["slug"] == self.project2.slug
        assert response.data[0]["name"] == self.project2.name

    def test_organization_projectoptions_get_option(self):
        query = {"option": "sentry:spike_projection_config"}
        response = self.client.get(self.path, query)

        assert response.status_code == 200

        project1_options = response.data[1]["options"]
        project2_options = response.data[0]["options"]

        assert project1_options == {"sentry:spike_projection_config": True}
        assert project2_options == {}

        assert response.data[1]["id"] == str(self.project1.id)
        assert response.data[1]["slug"] == self.project1.slug
        assert response.data[1]["name"] == self.project1.name
        assert response.data[0]["id"] == str(self.project2.id)
        assert response.data[0]["slug"] == self.project2.slug
        assert response.data[0]["name"] == self.project2.name
