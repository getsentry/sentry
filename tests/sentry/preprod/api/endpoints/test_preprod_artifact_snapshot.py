from django.urls import reverse

from sentry.testutils.cases import APITestCase


class ProjectPreprodSnapshotTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)

    def _get_create_url(self):
        """URL for POST (creating snapshots)"""
        return reverse(
            "sentry-api-0-project-preprod-snapshots-create",
            args=[self.org.slug, self.project.slug],
        )

    def _get_detail_url(self, snapshot_id):
        """URL for GET (retrieving snapshots)"""
        return reverse(
            "sentry-api-0-project-preprod-snapshots-detail",
            args=[self.org.slug, self.project.slug, snapshot_id],
        )

    def test_successful_snapshot_upload(self):
        url = self._get_create_url()
        data = {
            "shardIndex": 0,
            "numShards": 2,
            "images": [
                {
                    "width": 375,
                    "height": 812,
                    "colorScheme": "dark",
                    "orientation": "landscape",
                    "device": "iPhone 11",
                },
                {
                    "width": 375,
                    "height": 812,
                    "colorScheme": "dark",
                    "orientation": "landscape",
                    "device": "iPhone 11",
                },
            ],
            "errors": [],
        }

        with self.feature("organizations:preprod-frontend-routes"):
            response = self.client.post(url, data, format="json")

        assert response.status_code == 200

    def test_snapshot_with_empty_images(self):
        url = self._get_create_url()
        data = {
            "shardIndex": 1,
            "numShards": 3,
            "images": [],
            "errors": [],
        }

        with self.feature("organizations:preprod-frontend-routes"):
            response = self.client.post(url, data, format="json")

        assert response.status_code == 200

    def test_snapshot_missing_required_field(self):
        url = self._get_create_url()
        data = {
            "shardIndex": 0,
            "images": [
                {
                    "width": 375,
                    "height": 812,
                    "colorScheme": "dark",
                    "orientation": "portrait",
                    "device": "iPhone 11",
                },
            ],
            # Missing errors field
        }

        with self.feature("organizations:preprod-frontend-routes"):
            response = self.client.post(url, data, format="json")

        assert response.status_code == 400
        assert "error" in response.data

    def test_snapshot_invalid_image_schema(self):
        url = self._get_create_url()
        data = {
            "shardIndex": 0,
            "numShards": 1,
            "images": [
                {
                    "width": 375,
                    # Missing height
                    "colorScheme": "dark",
                    "orientation": "portrait",
                    "device": "iPhone 11",
                },
            ],
            "errors": [],
        }

        with self.feature("organizations:preprod-frontend-routes"):
            response = self.client.post(url, data, format="json")

        assert response.status_code == 400
        assert "error" in response.data

    def test_snapshot_negative_dimensions(self):
        url = self._get_create_url()
        data = {
            "shardIndex": 0,
            "numShards": 1,
            "images": [
                {
                    "width": -100,
                    "height": 812,
                    "colorScheme": "dark",
                    "orientation": "portrait",
                    "device": "iPhone 11",
                },
            ],
            "errors": [],
        }

        with self.feature("organizations:preprod-frontend-routes"):
            response = self.client.post(url, data, format="json")

        assert response.status_code == 400
        assert "error" in response.data

    def test_snapshot_without_feature_flag(self):
        url = self._get_create_url()
        data = {
            "shardIndex": 0,
            "numShards": 1,
            "images": [
                {
                    "width": 375,
                    "height": 812,
                    "colorScheme": "dark",
                    "orientation": "portrait",
                    "device": "iPhone 11",
                },
            ],
            "errors": [],
        }

        response = self.client.post(url, data, format="json")

        assert response.status_code == 403
        assert response.data["error"] == "Feature not enabled"

    def test_snapshot_invalid_json(self):
        url = self._get_create_url()

        with self.feature("organizations:preprod-frontend-routes"):
            response = self.client.post(url, "invalid json", content_type="application/json")

        assert response.status_code == 400
        assert "error" in response.data

    def test_snapshot_requires_authentication(self):
        # Create a new unauthenticated client instead of logging out
        from rest_framework.test import APIClient

        unauthenticated_client = APIClient()
        url = self._get_create_url()
        data = {
            "shardIndex": 0,
            "numShards": 1,
            "images": [],
            "errors": [],
        }

        with self.feature("organizations:preprod-frontend-routes"):
            response = unauthenticated_client.post(url, data, format="json")

        assert response.status_code == 401

    def test_snapshot_requires_project_access(self):
        other_user = self.create_user()
        self.login_as(user=other_user)

        url = self._get_create_url()
        data = {
            "shardIndex": 0,
            "numShards": 1,
            "images": [],
            "errors": [],
        }

        with self.feature("organizations:preprod-frontend-routes"):
            response = self.client.post(url, data, format="json")

        assert response.status_code == 403
