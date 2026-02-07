from django.urls import reverse

from sentry.models.files.file import File
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
            "images": {
                "abc123def456": {
                    "fileName": "test.png",
                    "width": 375,
                    "height": 812,
                    "darkMode": True,
                    "orientation": "landscape",
                    "device": "iPhone 11",
                },
            },
        }

        with self.feature("organizations:preprod-frontend-routes"):
            response = self.client.post(url, data, format="json")

        assert response.status_code == 201
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
                    "orientation": "portrait",
                    "device": "iPhone 14",
                },
            },
        }

        with self.feature("organizations:preprod-frontend-routes"):
            response = self.client.post(url, data, format="json")

        assert response.status_code == 201

        artifact = PreprodArtifact.objects.get(id=response.data["artifactId"])
        assert artifact.commit_comparison is not None

        commit_comparison = artifact.commit_comparison
        assert commit_comparison.head_sha == "a" * 40
        assert commit_comparison.base_sha == "b" * 40
        assert commit_comparison.provider == "github"
        assert commit_comparison.head_repo_name == "owner/repo"
        assert commit_comparison.pr_number == 123

    def test_snapshot_upload_stores_manifest_file(self):
        url = self._get_create_url()
        data = {
            "images": {
                "hash1": {
                    "fileName": "screen1.png",
                    "width": 100,
                    "height": 200,
                    "orientation": "portrait",
                    "device": "iPhone",
                },
            },
        }

        with self.feature("organizations:preprod-frontend-routes"):
            response = self.client.post(url, data, format="json")

        assert response.status_code == 201

        snapshot_metrics = PreprodSnapshotMetrics.objects.get(id=response.data["snapshotMetricsId"])
        assert "manifest_file_ids" in snapshot_metrics.extras
        assert "0" in snapshot_metrics.extras["manifest_file_ids"]

        manifest_file_id = snapshot_metrics.extras["manifest_file_ids"]["0"]
        manifest_file = File.objects.get(id=manifest_file_id)
        assert manifest_file.type == "preprod.snapshot_manifest"

    def test_snapshot_with_empty_images(self):
        url = self._get_create_url()
        data = {
            "images": {},
        }

        with self.feature("organizations:preprod-frontend-routes"):
            response = self.client.post(url, data, format="json")

        assert response.status_code == 201
        assert response.data["imageCount"] == 0

    def test_snapshot_missing_required_field(self):
        url = self._get_create_url()
        data = {
            # Missing images field
        }

        with self.feature("organizations:preprod-frontend-routes"):
            response = self.client.post(url, data, format="json")

        assert response.status_code == 400
        assert "detail" in response.data

    def test_snapshot_invalid_image_schema(self):
        url = self._get_create_url()
        data = {
            "images": {
                "hash1": {
                    "width": 375,
                    # Missing height, orientation, device
                },
            },
        }

        with self.feature("organizations:preprod-frontend-routes"):
            response = self.client.post(url, data, format="json")

        assert response.status_code == 400
        assert "detail" in response.data

    def test_snapshot_negative_dimensions(self):
        url = self._get_create_url()
        data = {
            "images": {
                "hash1": {
                    "width": -100,
                    "height": 812,
                    "orientation": "portrait",
                    "device": "iPhone 11",
                },
            },
        }

        with self.feature("organizations:preprod-frontend-routes"):
            response = self.client.post(url, data, format="json")

        assert response.status_code == 400
        assert "detail" in response.data

    def test_snapshot_without_feature_flag(self):
        url = self._get_create_url()
        data = {
            "images": {},
        }

        response = self.client.post(url, data, format="json")

        assert response.status_code == 403
        assert response.data["detail"] == "Feature not enabled"

    def test_snapshot_invalid_json(self):
        url = self._get_create_url()

        with self.feature("organizations:preprod-frontend-routes"):
            response = self.client.post(url, "invalid json", content_type="application/json")

        assert response.status_code == 400
        assert "detail" in response.data

    def test_snapshot_requires_authentication(self):
        from rest_framework.test import APIClient

        unauthenticated_client = APIClient()
        url = self._get_create_url()
        data = {
            "images": {},
        }

        with self.feature("organizations:preprod-frontend-routes"):
            response = unauthenticated_client.post(url, data, format="json")

        assert response.status_code == 401

    def test_snapshot_requires_project_access(self):
        other_user = self.create_user()
        self.login_as(user=other_user)

        url = self._get_create_url()
        data = {
            "images": {},
        }

        with self.feature("organizations:preprod-frontend-routes"):
            response = self.client.post(url, data, format="json")

        assert response.status_code == 403

    def test_snapshot_invalid_sha_format(self):
        url = self._get_create_url()
        data = {
            "head_sha": "not-a-valid-sha",
            "images": {},
        }

        with self.feature("organizations:preprod-frontend-routes"):
            response = self.client.post(url, data, format="json")

        assert response.status_code == 400
