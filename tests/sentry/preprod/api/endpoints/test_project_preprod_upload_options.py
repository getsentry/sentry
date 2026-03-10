from django.conf import settings
from django.urls import reverse
from rest_framework.test import APIClient

from sentry.testutils.cases import APITestCase


class ProjectPreprodUploadOptionsTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.url = reverse(
            "sentry-api-0-project-preprod-snapshots-upload-options",
            args=[self.org.slug, self.project.slug],
        )

    def test_returns_upload_options(self):
        with self.feature("organizations:preprod-snapshots"):
            response = self.client.get(self.url)

        assert response.status_code == 200
        data = response.data["objectstore"]

        assert f"/api/0/organizations/{self.org.id}/objectstore/" in data["url"]

        assert data["scopes"] == [("org", str(self.org.id)), ("project", str(self.project.id))]

        assert data["expirationPolicy"] == "ttl:396 days"

    def test_objectstore_url_uses_region_endpoint(self):
        with (
            self.feature("organizations:preprod-snapshots"),
            self.options({"system.region-api-url-template": "https://{region}.testserver"}),
        ):
            response = self.client.get(self.url)

        assert response.status_code == 200
        url = response.data["objectstore"]["url"]
        region = settings.SENTRY_REGION
        assert url.startswith(f"https://{region}.testserver/")
        assert f"/api/0/organizations/{self.org.id}/objectstore/" in url

    def test_without_feature_flag(self):
        response = self.client.get(self.url)

        assert response.status_code == 403
        assert response.data["detail"] == "Feature not enabled"

    def test_requires_authentication(self):
        unauthenticated_client = APIClient()

        with self.feature("organizations:preprod-snapshots"):
            response = unauthenticated_client.get(self.url)

        assert response.status_code == 401

    def test_requires_project_access(self):
        other_user = self.create_user()
        self.login_as(user=other_user)

        with self.feature("organizations:preprod-snapshots"):
            response = self.client.get(self.url)

        assert response.status_code == 403
