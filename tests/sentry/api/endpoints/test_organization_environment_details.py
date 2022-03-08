from django.urls import reverse
from exam import fixture

from sentry.api.serializers import serialize
from sentry.models.environmentbookmark import EnvironmentBookmark
from sentry.testutils import APITestCase


class OrganizationEnvironmentDetailsTest(APITestCase):
    endpoint = "sentry-api-0-organization-environment-details"

    def setUp(self):
        self.login_as(user=self.user)

    @fixture
    def project(self):
        return self.create_project()

    def test_simple(self):
        prod = self.create_environment(name="production", project=self.project)

        response = self.get_valid_response(self.project.organization.slug, "production")
        assert response.data == serialize(prod)

    def test_bookmark(self):
        prod = self.create_environment(name="production", project=self.project)

        url = reverse(
            self.endpoint,
            kwargs={
                "organization_slug": self.project.organization.slug,
                "environment": "production",
            },
        )

        # Mark bookmark
        response = self.client.put(url, {"isBookmarked": True}, format="json")
        assert response.status_code == 200, response.content
        assert response.data["isBookmarked"]

        assert EnvironmentBookmark.objects.filter(environment=prod, user=self.user).exists()

        # Delete bookmark
        response = self.client.put(url, {"isBookmarked": False}, format="json")
        assert response.status_code == 200, response.content
        assert not response.data["isBookmarked"]

        assert not EnvironmentBookmark.objects.filter(environment=prod, user=self.user).exists()
