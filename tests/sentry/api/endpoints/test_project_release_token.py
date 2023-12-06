from django.urls import reverse

from sentry.models.options.project_option import ProjectOption
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test
from sentry.types.region import get_local_region


@region_silo_test
class ReleaseTokenGetTest(APITestCase):
    def test_simple(self):
        project = self.create_project(name="foo")
        token = "abcdefghijklmnop"

        ProjectOption.objects.set_value(project, "sentry:release-token", token)

        url = reverse(
            "sentry-api-0-project-releases-token",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )

        self.login_as(user=self.user)

        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert response.data["token"] == "abcdefghijklmnop"

    def test_generates_token(self):
        project = self.create_project(name="foo")

        url = reverse(
            "sentry-api-0-project-releases-token",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )

        self.login_as(user=self.user)

        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert response.data["token"] is not None
        assert ProjectOption.objects.get_value(project, "sentry:release-token") is not None

    def test_generate_region_webhookurl(self):
        project = self.create_project(name="foo")

        url = reverse(
            "sentry-api-0-project-releases-token",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )

        self.login_as(user=self.user)

        response = self.client.get(url)
        assert response.status_code == 200, response.content

        region = get_local_region()
        assert response.data["webhookUrl"].startswith(region.to_url("/"))

    def test_regenerates_token(self):
        project = self.create_project(name="foo")
        token = "abcdefghijklmnop"

        ProjectOption.objects.set_value(project, "sentry:release-token", token)

        url = reverse(
            "sentry-api-0-project-releases-token",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )

        self.login_as(user=self.user)

        response = self.client.post(url, {"project": project.slug})

        assert response.status_code == 200, response.content
        assert response.data["token"] is not None
        assert response.data["token"] != "abcdefghijklmnop"
