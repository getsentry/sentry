from django.urls import reverse

from sentry.preprod.models import PreprodArtifact
from sentry.preprod.snapshots.models import PreprodSnapshotMetrics
from sentry.testutils.cases import APITestCase


class ProjectPreprodSnapshotTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)

    def _get_create_url(self):
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
            "app_id": "com.example.app",
            "images": {
                "abc123def456": {
                    "file_name": "test.png",
                    "width": 375,
                    "height": 812,
                    "dark_mode": True,
                },
            },
        }

        with self.feature("organizations:preprod-snapshots"):
            response = self.client.post(url, data, format="json")

        assert response.status_code == 200
        assert "artifactId" in response.data
        assert "snapshotMetricsId" in response.data
        assert response.data["imageCount"] == 1

        # Verify database models were created
        artifact = PreprodArtifact.objects.get(id=response.data["artifactId"])
        assert artifact.project == self.project
        assert artifact.state == PreprodArtifact.ArtifactState.UPLOADED

        snapshot_metrics = PreprodSnapshotMetrics.objects.get(id=response.data["snapshotMetricsId"])
        assert snapshot_metrics.preprod_artifact == artifact
        assert snapshot_metrics.image_count == 1

    def test_snapshot_upload_creates_commit_comparison(self):
        url = self._get_create_url()
        data = {
            "app_id": "com.example.app",
            "head_sha": "a" * 40,
            "base_sha": "b" * 40,
            "provider": "github",
            "head_repo_name": "owner/repo",
            "head_ref": "feature-branch",
            "pr_number": 123,
            "images": {
                "img1": {
                    "width": 100,
                    "height": 200,
                    "device": "iPhone 14",
                },
            },
        }

        with self.feature("organizations:preprod-snapshots"):
            response = self.client.post(url, data, format="json")

        assert response.status_code == 200

        artifact = PreprodArtifact.objects.get(id=response.data["artifactId"])
        assert artifact.commit_comparison is not None

        commit_comparison = artifact.commit_comparison
        assert commit_comparison.head_sha == "a" * 40
        assert commit_comparison.base_sha == "b" * 40
        assert commit_comparison.provider == "github"
        assert commit_comparison.head_repo_name == "owner/repo"
        assert commit_comparison.pr_number == 123

    def test_snapshot_upload_stores_manifest_key(self):
        url = self._get_create_url()
        data = {
            "app_id": "com.example.app",
            "images": {
                "hash1": {
                    "file_name": "screen1.png",
                    "width": 100,
                    "height": 200,
                },
            },
        }

        with self.feature("organizations:preprod-snapshots"):
            response = self.client.post(url, data, format="json")

        assert response.status_code == 200

        snapshot_metrics = PreprodSnapshotMetrics.objects.get(id=response.data["snapshotMetricsId"])
        assert snapshot_metrics.extras is not None
        assert "manifest_key" in snapshot_metrics.extras

        artifact_id = response.data["artifactId"]
        expected_key = (
            f"{self.project.organization_id}/{self.project.id}/{artifact_id}/manifest.json"
        )
        assert snapshot_metrics.extras["manifest_key"] == expected_key

    def test_snapshot_with_empty_images(self):
        url = self._get_create_url()
        data = {
            "app_id": "com.example.app",
            "images": {},
        }

        with self.feature("organizations:preprod-snapshots"):
            response = self.client.post(url, data, format="json")

        assert response.status_code == 200
        assert response.data["imageCount"] == 0

    def test_snapshot_missing_required_field(self):
        url = self._get_create_url()
        data: dict[str, str] = {
            # Missing images field
        }

        with self.feature("organizations:preprod-snapshots"):
            response = self.client.post(url, data, format="json")

        assert response.status_code == 400
        assert "detail" in response.data

    def test_snapshot_invalid_image_schema(self):
        url = self._get_create_url()
        data = {
            "app_id": "com.example.app",
            "images": {
                "hash1": {
                    "width": 375,
                    # Missing height (required)
                },
            },
        }

        with self.feature("organizations:preprod-snapshots"):
            response = self.client.post(url, data, format="json")

        assert response.status_code == 400
        assert "detail" in response.data

    def test_snapshot_negative_dimensions(self):
        url = self._get_create_url()
        data = {
            "app_id": "com.example.app",
            "images": {
                "hash1": {
                    "width": -100,
                    "height": 812,
                },
            },
        }

        with self.feature("organizations:preprod-snapshots"):
            response = self.client.post(url, data, format="json")

        assert response.status_code == 400
        assert "detail" in response.data

    def test_snapshot_without_feature_flag(self):
        url = self._get_create_url()
        data = {
            "app_id": "com.example.app",
            "images": {},
        }

        response = self.client.post(url, data, format="json")

        assert response.status_code == 403
        assert response.data["detail"] == "Feature not enabled"

    def test_snapshot_invalid_json(self):
        url = self._get_create_url()

        with self.feature("organizations:preprod-snapshots"):
            response = self.client.post(url, "invalid json", content_type="application/json")

        assert response.status_code == 400
        assert "detail" in response.data

    def test_snapshot_requires_authentication(self):
        from rest_framework.test import APIClient

        unauthenticated_client = APIClient()
        url = self._get_create_url()
        data = {
            "app_id": "com.example.app",
            "images": {},
        }

        with self.feature("organizations:preprod-snapshots"):
            response = unauthenticated_client.post(url, data, format="json")

        assert response.status_code == 401

    def test_snapshot_requires_project_access(self):
        other_user = self.create_user()
        self.login_as(user=other_user)

        url = self._get_create_url()
        data = {
            "app_id": "com.example.app",
            "images": {},
        }

        with self.feature("organizations:preprod-snapshots"):
            response = self.client.post(url, data, format="json")

        assert response.status_code == 403

    def test_snapshot_invalid_sha_format(self):
        url = self._get_create_url()
        data = {
            "app_id": "com.example.app",
            "head_sha": "not-a-valid-sha",
            "images": {},
        }

        with self.feature("organizations:preprod-snapshots"):
            response = self.client.post(url, data, format="json")

        assert response.status_code == 400
