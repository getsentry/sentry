from unittest.mock import MagicMock, patch

import orjson
from django.urls import reverse

from sentry.models.commitcomparison import CommitComparison
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
                    "display_name": "Test Screen",
                    "image_file_name": "test.png",
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
                    "display_name": "Screen 1",
                    "image_file_name": "screen1.png",
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
                    "display_name": "Screen 1",
                    "image_file_name": "screen1.png",
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
                    "display_name": "Test Screen",
                    "image_file_name": "test.png",
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


class ProjectPreprodSnapshotGetTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)

    def _get_detail_url(self, snapshot_id):
        return reverse(
            "sentry-api-0-project-preprod-snapshots-detail",
            args=[self.org.slug, self.project.slug, snapshot_id],
        )

    def _create_artifact_with_manifest(self, images=None, commit_comparison=None):
        """Helper to create an artifact with snapshot metrics and a manifest key."""
        if images is None:
            images = {
                "img1": {
                    "display_name": "Screen1",
                    "image_file_name": "Screen1",
                    "width": 375,
                    "height": 812,
                },
                "img2": {
                    "display_name": "Screen2",
                    "image_file_name": "Screen2",
                    "width": 1080,
                    "height": 1920,
                },
            }

        artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.UPLOADED,
            app_id="com.example.app",
            commit_comparison=commit_comparison,
        )

        manifest_key = f"{self.org.id}/{self.project.id}/{artifact.id}/manifest.json"
        snapshot_metrics = PreprodSnapshotMetrics.objects.create(
            preprod_artifact=artifact,
            image_count=len(images),
            extras={"manifest_key": manifest_key},
        )

        manifest_json = orjson.dumps({"images": images})
        return artifact, snapshot_metrics, manifest_key, manifest_json, images

    def _create_mock_session(self, manifest_json):
        mock_result = MagicMock()
        mock_result.payload.read.return_value = manifest_json
        mock_session = MagicMock()
        mock_session.get.return_value = mock_result
        return mock_session

    @patch("sentry.preprod.api.endpoints.preprod_artifact_snapshot.get_preprod_session")
    def test_get_snapshot_details(self, mock_get_session):
        artifact, _, manifest_key, manifest_json, images = self._create_artifact_with_manifest()
        mock_get_session.return_value = self._create_mock_session(manifest_json)

        url = self._get_detail_url(artifact.id)
        with self.feature("organizations:preprod-snapshots"):
            response = self.client.get(url)

        assert response.status_code == 200
        assert response.data["head_artifact_id"] == str(artifact.id)
        assert response.data["state"] == PreprodArtifact.ArtifactState.UPLOADED
        assert response.data["image_count"] == 2
        assert len(response.data["images"]) == 2
        # Images should be sorted by key
        assert response.data["images"][0]["key"] == "img1"
        assert (
            response.data["images"][0]["image_file_name"] == "Screen1"
        )  # response field is still "file_name"
        assert response.data["images"][1]["key"] == "img2"

    @patch("sentry.preprod.api.endpoints.preprod_artifact_snapshot.get_preprod_session")
    def test_get_snapshot_details_with_vcs_info(self, mock_get_session):
        commit_comparison = CommitComparison.objects.create(
            organization_id=self.org.id,
            head_repo_name="owner/repo",
            head_sha="a" * 40,
            base_sha="b" * 40,
            provider="github.com",
            head_ref="chore/cleanup",
            pr_number=123,
        )
        artifact, _, manifest_key, manifest_json, _ = self._create_artifact_with_manifest(
            commit_comparison=commit_comparison,
        )
        mock_get_session.return_value = self._create_mock_session(manifest_json)

        url = self._get_detail_url(artifact.id)
        with self.feature("organizations:preprod-snapshots"):
            response = self.client.get(url)

        assert response.status_code == 200
        vcs_info = response.data["vcs_info"]
        assert vcs_info["head_sha"] == "a" * 40
        assert vcs_info["base_sha"] == "b" * 40
        assert vcs_info["provider"] == "github.com"
        assert vcs_info["head_repo_name"] == "owner/repo"
        assert vcs_info["head_ref"] == "chore/cleanup"
        assert vcs_info["pr_number"] == 123

    @patch("sentry.preprod.api.endpoints.preprod_artifact_snapshot.get_preprod_session")
    def test_get_snapshot_details_pagination(self, mock_get_session):
        images = {
            f"img{i:03d}": {
                "display_name": f"Image {i}",
                "image_file_name": f"image{i}.png",
                "width": 100,
                "height": 200,
            }
            for i in range(10)
        }
        artifact, _, _, manifest_json, _ = self._create_artifact_with_manifest(images=images)
        mock_get_session.return_value = self._create_mock_session(manifest_json)

        url = self._get_detail_url(artifact.id)
        with self.feature("organizations:preprod-snapshots"):
            # First page: items 0-2
            response = self.client.get(url, {"per_page": "3"})

        assert response.status_code == 200
        assert len(response.data["images"]) == 3
        assert response.data["images"][0]["key"] == "img000"
        assert response.data["images"][2]["key"] == "img002"

        with self.feature("organizations:preprod-snapshots"):
            # Second page: cursor format is "{per_page}:{page}:0"
            response = self.client.get(url, {"cursor": "3:1:0", "per_page": "3"})

        assert response.status_code == 200
        assert len(response.data["images"]) == 3
        assert response.data["images"][0]["key"] == "img003"
        assert response.data["images"][2]["key"] == "img005"

    def test_get_snapshot_not_found(self):
        url = self._get_detail_url(99999)
        with self.feature("organizations:preprod-snapshots"):
            response = self.client.get(url)

        assert response.status_code == 404
        assert response.data["detail"] == "Snapshot not found"

    def test_get_snapshot_wrong_project(self):
        """Artifact belonging to a different project should return 404 (IDOR protection)."""
        other_project = self.create_project(organization=self.org)
        artifact = PreprodArtifact.objects.create(
            project=other_project,
            state=PreprodArtifact.ArtifactState.UPLOADED,
            app_id="com.other.app",
        )

        url = self._get_detail_url(artifact.id)
        with self.feature("organizations:preprod-snapshots"):
            response = self.client.get(url)

        assert response.status_code == 404

    def test_get_snapshot_without_feature_flag(self):
        artifact, _, _, _, _ = self._create_artifact_with_manifest()

        url = self._get_detail_url(artifact.id)
        response = self.client.get(url)

        assert response.status_code == 403
        assert response.data["detail"] == "Feature not enabled"

    @patch("sentry.preprod.api.endpoints.preprod_artifact_snapshot.get_preprod_session")
    def test_get_snapshot_invalid_pagination(self, mock_get_session):
        artifact, _, _, manifest_json, _ = self._create_artifact_with_manifest()
        mock_get_session.return_value = self._create_mock_session(manifest_json)

        url = self._get_detail_url(artifact.id)
        with self.feature("organizations:preprod-snapshots"):
            response = self.client.get(url, {"per_page": "0"})

        assert response.status_code == 400

    @patch("sentry.preprod.api.endpoints.preprod_artifact_snapshot.get_preprod_session")
    def test_get_snapshot_limit_too_large(self, mock_get_session):
        artifact, _, _, manifest_json, _ = self._create_artifact_with_manifest()
        mock_get_session.return_value = self._create_mock_session(manifest_json)

        url = self._get_detail_url(artifact.id)
        with self.feature("organizations:preprod-snapshots"):
            response = self.client.get(url, {"per_page": "101"})

        assert response.status_code == 400

    @patch("sentry.preprod.api.endpoints.preprod_artifact_snapshot.get_preprod_session")
    def test_get_snapshot_objectstore_error(self, mock_get_session):
        artifact, _, _, _, _ = self._create_artifact_with_manifest()
        mock_session = MagicMock()
        mock_session.get.side_effect = Exception("Storage error")
        mock_get_session.return_value = mock_session

        url = self._get_detail_url(artifact.id)
        with self.feature("organizations:preprod-snapshots"):
            response = self.client.get(url)

        assert response.status_code == 500
        assert response.data["detail"] == "Internal server error"

    def test_get_snapshot_no_metrics(self):
        """Artifact without snapshot metrics should return 404."""
        artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.UPLOADED,
            app_id="com.example.app",
        )

        url = self._get_detail_url(artifact.id)
        with self.feature("organizations:preprod-snapshots"):
            response = self.client.get(url)

        assert response.status_code == 404
        assert response.data["detail"] == "Snapshot metrics not found"
