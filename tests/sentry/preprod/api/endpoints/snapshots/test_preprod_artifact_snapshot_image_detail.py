from unittest.mock import MagicMock, patch

import orjson
from django.urls import reverse

from sentry.preprod.models import PreprodArtifact
from sentry.preprod.snapshots.models import PreprodSnapshotComparison, PreprodSnapshotMetrics
from sentry.testutils.cases import APITestCase

MOCK_TARGET = "sentry.preprod.api.endpoints.snapshots.preprod_artifact_snapshot_image_detail.get_preprod_session"


class OrganizationPreprodSnapshotImageDetailTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)

    def _get_url(self, snapshot_id, image_identifier):
        return reverse(
            "sentry-api-0-organization-preprod-snapshots-image-detail",
            args=[self.org.slug, snapshot_id, image_identifier],
        )

    def _create_artifact_with_manifest(self, images=None):
        if images is None:
            images = {
                "screen1.png": {
                    "content_hash": "hash_screen1",
                    "display_name": "Screen 1",
                    "width": 375,
                    "height": 812,
                },
            }
        artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.UPLOADED,
            app_id="com.example.app",
        )
        manifest_key = f"{self.org.id}/{self.project.id}/{artifact.id}/manifest.json"
        snapshot_metrics = PreprodSnapshotMetrics.objects.create(
            preprod_artifact=artifact,
            image_count=len(images),
            extras={"manifest_key": manifest_key},
        )
        manifest_json = orjson.dumps({"images": images})
        return artifact, snapshot_metrics, manifest_key, manifest_json

    def _create_mock_session(self, key_to_data):
        def side_effect(key):
            mock_result = MagicMock()
            mock_result.payload.read.return_value = key_to_data[key]
            return mock_result

        mock_session = MagicMock()
        mock_session.get.side_effect = side_effect
        return mock_session

    def _build_comparison_manifest(self, head_artifact, base_artifact, images, summary=None):
        if summary is None:
            summary = {
                "total": len(images),
                "changed": 0,
                "unchanged": 0,
                "added": 0,
                "removed": 0,
                "errored": 0,
                "renamed": 0,
                "skipped": 0,
            }
        return orjson.dumps(
            {
                "head_artifact_id": head_artifact.id,
                "base_artifact_id": base_artifact.id,
                "summary": summary,
                "images": images,
            }
        )

    def _create_comparison(
        self,
        head_images,
        base_images,
        comparison_images,
        summary=None,
    ):
        head_artifact, head_metrics, head_manifest_key, head_manifest_json = (
            self._create_artifact_with_manifest(head_images)
        )
        base_artifact, base_metrics, base_manifest_key, base_manifest_json = (
            self._create_artifact_with_manifest(base_images)
        )
        comparison_key = f"{self.org.id}/{self.project.id}/comparisons/{head_artifact.id}_{base_artifact.id}.json"
        PreprodSnapshotComparison.objects.create(
            head_snapshot_metrics=head_metrics,
            base_snapshot_metrics=base_metrics,
            state=PreprodSnapshotComparison.State.SUCCESS,
            extras={"comparison_key": comparison_key},
        )
        comparison_manifest_json = self._build_comparison_manifest(
            head_artifact, base_artifact, comparison_images, summary
        )
        key_to_data = {
            head_manifest_key: head_manifest_json,
            base_manifest_key: base_manifest_json,
            comparison_key: comparison_manifest_json,
        }
        return head_artifact, base_artifact, key_to_data

    @patch(MOCK_TARGET)
    def test_solo_snapshot_returns_head_image(self, mock_get_session):
        images = {
            "components/alert.png": {
                "content_hash": "abc123",
                "display_name": "Alert",
                "group": "components",
                "width": 400,
                "height": 200,
                "diff_threshold": 0.01,
                "description": "An alert component",
                "tags": ["dark"],
            },
        }
        artifact, _, manifest_key, manifest_json = self._create_artifact_with_manifest(images)
        mock_get_session.return_value = self._create_mock_session({manifest_key: manifest_json})

        url = self._get_url(artifact.id, "components/alert.png")
        with self.feature("organizations:preprod-snapshots"):
            response = self.client.get(url)

        assert response.status_code == 200
        data = response.data
        assert data["image_file_name"] == "components/alert.png"
        assert data["comparison_status"] is None
        assert data["base_image"] is None
        assert data["diff_image_url"] is None
        assert data["diff_percentage"] is None

        head = data["head_image"]
        assert head is not None
        assert head["content_hash"] == "abc123"
        assert head["display_name"] == "Alert"
        assert head["group"] == "components"
        assert head["image_file_name"] == "components/alert.png"
        assert head["width"] == 400
        assert head["height"] == 200
        assert head["diff_threshold"] == 0.01
        assert head["description"] == "An alert component"
        assert head["tags"] == {"dark": "dark"}
        assert "image_url" in head
        assert (
            head["image_url"]
            == f"/api/0/projects/{self.org.slug}/{self.project.slug}/files/images/abc123/"
        )

    @patch(MOCK_TARGET)
    def test_changed_image_returns_full_comparison(self, mock_get_session):
        head_images = {
            "alert.png": {
                "content_hash": "head_hash",
                "display_name": "Alert",
                "group": "components",
                "width": 400,
                "height": 200,
            },
        }
        base_images = {
            "alert.png": {
                "content_hash": "base_hash",
                "display_name": "Alert",
                "group": "components",
                "width": 400,
                "height": 195,
            },
        }
        comparison_images = {
            "alert.png": {
                "status": "changed",
                "head_hash": "head_hash",
                "base_hash": "base_hash",
                "diff_mask_image_id": "diff_mask_123",
                "changed_pixels": 100,
                "total_pixels": 10000,
                "before_width": 400,
                "before_height": 195,
                "after_width": 400,
                "after_height": 200,
            },
        }
        head_artifact, base_artifact, key_to_data = self._create_comparison(
            head_images,
            base_images,
            comparison_images,
            summary={
                "total": 1,
                "changed": 1,
                "unchanged": 0,
                "added": 0,
                "removed": 0,
                "errored": 0,
                "renamed": 0,
                "skipped": 0,
            },
        )
        mock_get_session.return_value = self._create_mock_session(key_to_data)

        url = self._get_url(head_artifact.id, "alert.png")
        with self.feature("organizations:preprod-snapshots"):
            response = self.client.get(url)

        assert response.status_code == 200
        data = response.data
        assert data["comparison_status"] == "changed"
        assert data["image_file_name"] == "alert.png"

        head = data["head_image"]
        assert head is not None
        assert head["content_hash"] == "head_hash"
        assert head["width"] == 400
        assert head["height"] == 200
        assert "/files/images/head_hash/" in head["image_url"]

        base = data["base_image"]
        assert base is not None
        assert base["content_hash"] == "base_hash"
        assert base["width"] == 400
        assert base["height"] == 195
        assert "/files/images/base_hash/" in base["image_url"]

        assert data["diff_image_url"] is not None
        assert "diff_mask_123" in data["diff_image_url"]
        assert data["diff_percentage"] == 0.01

    @patch(MOCK_TARGET)
    def test_added_image(self, mock_get_session):
        head_images = {
            "new_screen.png": {
                "content_hash": "head_hash",
                "display_name": "New Screen",
                "width": 375,
                "height": 812,
            },
        }
        base_images: dict = {}
        comparison_images = {
            "new_screen.png": {
                "status": "added",
                "head_hash": "head_hash",
            },
        }
        head_artifact, _, key_to_data = self._create_comparison(
            head_images,
            base_images,
            comparison_images,
            summary={
                "total": 1,
                "changed": 0,
                "unchanged": 0,
                "added": 1,
                "removed": 0,
                "errored": 0,
                "renamed": 0,
                "skipped": 0,
            },
        )
        mock_get_session.return_value = self._create_mock_session(key_to_data)

        url = self._get_url(head_artifact.id, "new_screen.png")
        with self.feature("organizations:preprod-snapshots"):
            response = self.client.get(url)

        assert response.status_code == 200
        data = response.data
        assert data["comparison_status"] == "added"
        assert data["head_image"] is not None
        assert data["head_image"]["content_hash"] == "head_hash"
        assert data["base_image"] is None
        assert data["diff_image_url"] is None

    @patch(MOCK_TARGET)
    def test_removed_image(self, mock_get_session):
        head_images: dict = {}
        base_images = {
            "old_screen.png": {
                "content_hash": "base_hash",
                "display_name": "Old Screen",
                "width": 375,
                "height": 812,
            },
        }
        comparison_images = {
            "old_screen.png": {
                "status": "removed",
                "base_hash": "base_hash",
            },
        }
        head_artifact, _, key_to_data = self._create_comparison(
            head_images,
            base_images,
            comparison_images,
            summary={
                "total": 1,
                "changed": 0,
                "unchanged": 0,
                "added": 0,
                "removed": 1,
                "errored": 0,
                "renamed": 0,
                "skipped": 0,
            },
        )
        mock_get_session.return_value = self._create_mock_session(key_to_data)

        url = self._get_url(head_artifact.id, "old_screen.png")
        with self.feature("organizations:preprod-snapshots"):
            response = self.client.get(url)

        assert response.status_code == 200
        data = response.data
        assert data["comparison_status"] == "removed"
        assert data["head_image"] is None
        assert data["base_image"] is not None
        assert data["base_image"]["content_hash"] == "base_hash"
        assert data["base_image"]["display_name"] == "Old Screen"
        assert "/files/images/base_hash/" in data["base_image"]["image_url"]

    @patch(MOCK_TARGET)
    def test_renamed_image(self, mock_get_session):
        head_images = {
            "new_alert.png": {
                "content_hash": "shared_hash",
                "display_name": "Alert",
                "width": 400,
                "height": 200,
            },
        }
        base_images = {
            "old_alert.png": {
                "content_hash": "shared_hash",
                "display_name": "Alert",
                "width": 400,
                "height": 200,
            },
        }
        comparison_images = {
            "new_alert.png": {
                "status": "renamed",
                "head_hash": "shared_hash",
                "base_hash": "shared_hash",
                "previous_image_file_name": "old_alert.png",
            },
        }
        head_artifact, _, key_to_data = self._create_comparison(
            head_images,
            base_images,
            comparison_images,
            summary={
                "total": 1,
                "changed": 0,
                "unchanged": 0,
                "added": 0,
                "removed": 0,
                "errored": 0,
                "renamed": 1,
                "skipped": 0,
            },
        )
        mock_get_session.return_value = self._create_mock_session(key_to_data)

        url = self._get_url(head_artifact.id, "new_alert.png")
        with self.feature("organizations:preprod-snapshots"):
            response = self.client.get(url)

        assert response.status_code == 200
        data = response.data
        assert data["comparison_status"] == "renamed"
        assert data["head_image"] is not None
        assert data["base_image"] is not None
        assert data["previous_image_file_name"] == "old_alert.png"

    @patch(MOCK_TARGET)
    def test_unchanged_image(self, mock_get_session):
        images = {
            "stable.png": {
                "content_hash": "same_hash",
                "display_name": "Stable",
                "width": 300,
                "height": 600,
            },
        }
        comparison_images = {
            "stable.png": {
                "status": "unchanged",
                "head_hash": "same_hash",
                "base_hash": "same_hash",
            },
        }
        head_artifact, _, key_to_data = self._create_comparison(
            images,
            images,
            comparison_images,
            summary={
                "total": 1,
                "changed": 0,
                "unchanged": 1,
                "added": 0,
                "removed": 0,
                "errored": 0,
                "renamed": 0,
                "skipped": 0,
            },
        )
        mock_get_session.return_value = self._create_mock_session(key_to_data)

        url = self._get_url(head_artifact.id, "stable.png")
        with self.feature("organizations:preprod-snapshots"):
            response = self.client.get(url)

        assert response.status_code == 200
        data = response.data
        assert data["comparison_status"] == "unchanged"
        assert data["head_image"] is not None
        assert data["base_image"] is not None

    @patch(MOCK_TARGET)
    def test_skipped_image(self, mock_get_session):
        head_images: dict = {}
        base_images = {
            "skipped_screen.png": {
                "content_hash": "base_hash",
                "display_name": "Skipped Screen",
                "width": 375,
                "height": 812,
            },
        }
        comparison_images = {
            "skipped_screen.png": {
                "status": "skipped",
                "base_hash": "base_hash",
                "reason": "image_too_large",
            },
        }
        head_artifact, _, key_to_data = self._create_comparison(
            head_images,
            base_images,
            comparison_images,
            summary={
                "total": 1,
                "changed": 0,
                "unchanged": 0,
                "added": 0,
                "removed": 0,
                "errored": 0,
                "renamed": 0,
                "skipped": 1,
            },
        )
        mock_get_session.return_value = self._create_mock_session(key_to_data)

        url = self._get_url(head_artifact.id, "skipped_screen.png")
        with self.feature("organizations:preprod-snapshots"):
            response = self.client.get(url)

        assert response.status_code == 200
        data = response.data
        assert data["comparison_status"] == "skipped"
        assert data["head_image"] is not None
        assert data["head_image"]["content_hash"] == "base_hash"
        assert data["head_image"]["display_name"] == "Skipped Screen"
        assert "/files/images/base_hash/" in data["head_image"]["image_url"]
        assert data["base_image"] is not None
        assert data["base_image"]["content_hash"] == "base_hash"
        assert data["diff_image_url"] is None
        assert data["diff_percentage"] is None

    @patch(MOCK_TARGET)
    def test_lookup_by_content_hash(self, mock_get_session):
        images = {
            "components/alert.png": {
                "content_hash": "abc123",
                "display_name": "Alert",
                "width": 400,
                "height": 200,
            },
        }
        artifact, _, manifest_key, manifest_json = self._create_artifact_with_manifest(images)
        mock_get_session.return_value = self._create_mock_session({manifest_key: manifest_json})

        url = self._get_url(artifact.id, "abc123")
        with self.feature("organizations:preprod-snapshots"):
            response = self.client.get(url)

        assert response.status_code == 200
        data = response.data
        assert data["image_file_name"] == "components/alert.png"
        assert data["head_image"] is not None
        assert data["head_image"]["content_hash"] == "abc123"

    @patch(MOCK_TARGET)
    def test_extra_metadata_fields_passed_through(self, mock_get_session):
        images = {
            "screen.png": {
                "content_hash": "hash1",
                "display_name": "Screen",
                "width": 375,
                "height": 812,
                "context": {"viewport": "mobile"},
                "custom_field": "value",
            },
        }
        artifact, _, manifest_key, manifest_json = self._create_artifact_with_manifest(images)
        mock_get_session.return_value = self._create_mock_session({manifest_key: manifest_json})

        url = self._get_url(artifact.id, "screen.png")
        with self.feature("organizations:preprod-snapshots"):
            response = self.client.get(url)

        assert response.status_code == 200
        head = response.data["head_image"]
        assert head is not None
        assert head["context"] == {"viewport": "mobile"}
        assert head["custom_field"] == "value"
