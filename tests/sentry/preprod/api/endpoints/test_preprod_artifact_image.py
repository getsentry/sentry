from io import BytesIO

from django.urls import reverse

from sentry.objectstore import preprod
from sentry.testutils.cases import APITestCase
from sentry.testutils.skips import requires_objectstore


class ProjectPreprodArtifactImageTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.api_token = self.create_user_auth_token(
            user=self.user, scope_list=["org:admin", "project:admin"]
        )
        self.image_id = "test-image-123"
        self.base_path = f"/api/0/{self.org.slug}/{self.project.slug}/files/images/{self.image_id}/"

    def _get_url(self, image_id=None):
        image_id = image_id or self.image_id
        return reverse(
            "sentry-api-0-project-preprod-artifact-image",
            args=[self.org.slug, self.project.slug, image_id],
        )

    @requires_objectstore
    def test_successful_image_retrieval_png(self):
        png_data = b"\x89PNG\r\n\x1a\n" + b"fake png content" * 100

        client = preprod.for_project(self.org.id, self.project.id)
        client.put(BytesIO(png_data), id=f"{self.org.id}/{self.project.id}/test-image-123")

        url = self._get_url()
        response = self.client.get(
            url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )

        assert response.status_code == 200
        assert response.content == png_data
        assert response["Content-Type"] == "image/png"

    @requires_objectstore
    def test_successful_image_retrieval_jpeg(self):
        jpeg_data = b"\xff\xd8\xff" + b"fake jpeg content" * 100

        client = preprod.for_project(self.org.id, self.project.id)
        client.put(BytesIO(jpeg_data), id=f"{self.org.id}/{self.project.id}/test-image-123")

        url = self._get_url()
        response = self.client.get(
            url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )

        assert response.status_code == 200
        assert response.content == jpeg_data
        assert response["Content-Type"] == "image/jpeg"

    @requires_objectstore
    def test_successful_image_retrieval_webp(self):
        webp_data = b"RIFF" + b"1234" + b"WEBP" + b"fake webp content" * 100

        client = preprod.for_project(self.org.id, self.project.id)
        client.put(BytesIO(webp_data), id=f"{self.org.id}/{self.project.id}/test-image-123")

        url = self._get_url()
        response = self.client.get(
            url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )

        assert response.status_code == 200
        assert response.content == webp_data
        assert response["Content-Type"] == "image/webp"

    def test_successful_image_retrieval_heic(self):
        heic_data = b"RIFF" + b"ftypheic" + b"fake heic content" * 100

        client = preprod.for_project(self.org.id, self.project.id)
        client.put(BytesIO(heic_data), id=f"{self.org.id}/{self.project.id}/test-image-123")

        url = self._get_url()
        response = self.client.get(
            url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )

        assert response.status_code == 200
        assert response.content == heic_data
        assert response["Content-Type"] == "image/heic"

    @requires_objectstore
    def test_image_not_found(self):
        url = self._get_url()
        response = self.client.get(
            url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )

        assert response.status_code == 404
        assert response.content == b'{"error":"Not found"}'

    @requires_objectstore
    def test_unknown_image_format(self):
        unknown_data = b"unknown binary data" * 50

        client = preprod.for_project(self.org.id, self.project.id)
        client.put(BytesIO(unknown_data), id=f"{self.org.id}/{self.project.id}/test-image-123")

        url = self._get_url()
        response = self.client.get(
            url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )

        assert response.status_code == 200
        assert response.content == unknown_data
        assert response["Content-Type"] == "application/octet-stream"

    def test_endpoint_requires_project_access(self):
        other_user = self.create_user()
        self.login_as(user=other_user)
        self.api_token = self.create_user_auth_token(
            user=other_user, scope_list=["org:read", "project:read"]
        )

        url = self._get_url()
        response = self.client.get(
            url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )
        assert response.status_code == 403
