from unittest.mock import MagicMock, patch

import orjson
import zstandard
from django.urls import reverse

from sentry.models.commitcomparison import CommitComparison
from sentry.preprod.analytics import PreprodArtifactApiGetSnapshotDetailsEvent
from sentry.preprod.api.endpoints.snapshots.preprod_artifact_snapshot_latest_base import (
    LATEST_BASE_SNAPSHOT_GET_QUERY_PARAMS,
)
from sentry.preprod.models import PreprodArtifact, PreprodComparisonApproval
from sentry.preprod.snapshots.models import PreprodSnapshotComparison, PreprodSnapshotMetrics
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.analytics import assert_last_analytics_event


class ProjectPreprodSnapshotTest(APITestCase):
    def setUp(self) -> None:
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
        return reverse(
            "sentry-api-0-project-preprod-snapshots-detail",
            args=[self.org.slug, snapshot_id],
        )

    def test_successful_snapshot_upload(self) -> None:
        url = self._get_create_url()
        data = {
            "app_id": "com.example.app",
            "images": {
                "abc123def456": {
                    "content_hash": "abc123def456",
                    "display_name": "Test Screen",
                    "image_file_name": "test.png",
                    "width": 375,
                    "height": 812,
                    "dark_mode": True,
                },
            },
        }

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

    def _compressible_snapshot_payload(self) -> bytes:
        data = {
            "app_id": "com.example.app",
            "images": {
                "abc123def456": {
                    "content_hash": "abc123def456",
                    "width": 375,
                    "height": 812,
                },
            },
        }
        return orjson.dumps(data)

    def test_snapshot_upload_zstd_encoded(self) -> None:
        url = self._get_create_url()
        body = zstandard.ZstdCompressor().compress(self._compressible_snapshot_payload())

        response = self.client.post(
            url,
            data=body,
            content_type="application/json",
            HTTP_CONTENT_ENCODING="zstd",
        )

        assert response.status_code == 200
        assert response.data["imageCount"] == 1

    def test_snapshot_upload_invalid_zstd_payload(self) -> None:
        url = self._get_create_url()

        response = self.client.post(
            url,
            data=b"this is not a zstd payload",
            content_type="application/json",
            HTTP_CONTENT_ENCODING="zstd",
        )

        assert response.status_code == 400
        assert response.data["detail"] == "Invalid zstd payload"

    def test_snapshot_upload_unsupported_encoding(self) -> None:
        url = self._get_create_url()

        response = self.client.post(
            url,
            data=b"anything",
            content_type="application/json",
            HTTP_CONTENT_ENCODING="br",
        )

        assert response.status_code == 400
        assert response.data["detail"] == "Unsupported Content-Encoding"

    def test_snapshot_upload_creates_commit_comparison(self) -> None:
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
                    "content_hash": "img1",
                    "display_name": "Screen 1",
                    "image_file_name": "screen1.png",
                    "width": 100,
                    "height": 200,
                    "device": "iPhone 14",
                },
            },
        }

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

    def test_snapshot_upload_stores_manifest_key(self) -> None:
        url = self._get_create_url()
        data = {
            "app_id": "com.example.app",
            "images": {
                "hash1": {
                    "content_hash": "hash1",
                    "display_name": "Screen 1",
                    "image_file_name": "screen1.png",
                    "width": 100,
                    "height": 200,
                },
            },
        }

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

    def test_snapshot_with_empty_images(self) -> None:
        url = self._get_create_url()
        data = {
            "app_id": "com.example.app",
            "images": {},
        }

        response = self.client.post(url, data, format="json")

        assert response.status_code == 200
        assert response.data["imageCount"] == 0

    def test_snapshot_missing_required_field(self) -> None:
        url = self._get_create_url()
        data: dict[str, str] = {}

        response = self.client.post(url, data, format="json")

        assert response.status_code == 400
        assert "detail" in response.data

    def test_snapshot_boolean_tag_values_accepted(self) -> None:
        url = self._get_create_url()
        data = {
            "app_id": "com.example.app",
            "images": {
                "screen.png": {
                    "content_hash": "abc123",
                    "width": 375,
                    "height": 812,
                    "tags": {"show_background": True, "count": 42},
                },
            },
        }

        response = self.client.post(url, data, format="json")

        assert response.status_code != 400

    def test_snapshot_invalid_image_schema(self) -> None:
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

        response = self.client.post(url, data, format="json")

        assert response.status_code == 400
        assert 'Validation error in image "hash1"' in response.data["detail"]

    def test_snapshot_missing_content_hash_error_message(self) -> None:
        url = self._get_create_url()
        data = {
            "app_id": "com.example.app",
            "images": {
                "screen.png": {
                    "width": 375,
                    "height": 812,
                },
            },
        }

        response = self.client.post(url, data, format="json")

        assert response.status_code == 400
        assert 'Validation error in image "screen.png"' in response.data["detail"]
        assert "content_hash" in response.data["detail"]

    def test_snapshot_negative_width_error_message(self) -> None:
        url = self._get_create_url()
        data = {
            "app_id": "com.example.app",
            "images": {
                "login.png": {
                    "content_hash": "abc123",
                    "width": -100,
                    "height": 812,
                },
            },
        }

        response = self.client.post(url, data, format="json")

        assert response.status_code == 400
        assert 'Validation error in image "login.png"' in response.data["detail"]
        assert "width" in response.data["detail"]

    def test_snapshot_negative_dimensions(self) -> None:
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

        response = self.client.post(url, data, format="json")

        assert response.status_code == 400
        assert "detail" in response.data

    def test_snapshot_invalid_json(self) -> None:
        url = self._get_create_url()

        response = self.client.post(url, "invalid json", content_type="application/json")

        assert response.status_code == 400
        assert "detail" in response.data

    def test_snapshot_requires_authentication(self) -> None:
        from rest_framework.test import APIClient

        unauthenticated_client = APIClient()
        url = self._get_create_url()
        data = {
            "app_id": "com.example.app",
            "images": {},
        }

        response = unauthenticated_client.post(url, data, format="json")

        assert response.status_code == 401

    def test_snapshot_requires_project_access(self) -> None:
        other_user = self.create_user()
        self.login_as(user=other_user)

        url = self._get_create_url()
        data = {
            "app_id": "com.example.app",
            "images": {},
        }

        response = self.client.post(url, data, format="json")

        assert response.status_code == 403

    def test_snapshot_invalid_sha_format(self) -> None:
        url = self._get_create_url()
        data = {
            "app_id": "com.example.app",
            "head_sha": "not-a-valid-sha",
            "images": {},
        }

        response = self.client.post(url, data, format="json")

        assert response.status_code == 400

    def _selective_data(self, **overrides):
        data = {
            "app_id": "com.test.app",
            "images": {"screen.png": {"content_hash": "screen", "width": 100, "height": 200}},
            "selective": True,
            "all_image_file_names": ["screen.png", "skipped.png"],
            "head_sha": "a" * 40,
            "base_sha": "b" * 40,
            "provider": "github.com",
            "head_repo_name": "org/repo",
            "head_ref": "feature",
        }
        data.update(overrides)
        return data

    def _post_selective(self, **overrides):
        return self.client.post(
            self._get_create_url(), self._selective_data(**overrides), format="json"
        )

    def test_all_image_file_names_rejects_empty_list(self):
        response = self._post_selective(images={}, all_image_file_names=[])
        assert response.status_code == 400
        assert "empty" in response.data["detail"]

    def test_selective_requires_base_sha(self):
        response = self._post_selective(base_sha=None)
        assert response.status_code == 400
        assert "base_sha" in response.data["detail"]

    def test_all_image_file_names_must_contain_all_images(self):
        response = self._post_selective(all_image_file_names=["other.png"])
        assert response.status_code == 400
        assert "all_image_file_names" in response.data["detail"]

    def test_all_image_file_names_requires_selective(self):
        response = self._post_selective(selective=False)
        assert response.status_code == 400
        assert "selective" in response.data["detail"]

    def test_selective_without_all_image_file_names_accepted(self):
        data = self._selective_data()
        del data["all_image_file_names"]
        response = self.client.post(self._get_create_url(), data, format="json")
        assert response.status_code == 200

    def test_selective_with_all_image_file_names_accepted(self):
        response = self._post_selective()
        assert response.status_code == 200

    @patch("sentry.preprod.api.endpoints.snapshots.preprod_artifact_snapshot.get_preprod_session")
    @patch("sentry.preprod.api.endpoints.snapshots.preprod_artifact_snapshot.compare_snapshots")
    def test_base_upload_triggers_comparison_for_waiting_head(
        self, mock_compare_snapshots, mock_get_session
    ) -> None:
        """
        When a head snapshot is uploaded before its base, uploading the base should
        retroactively trigger a comparison for the waiting head.
        """
        head_sha = "a" * 40
        base_sha = "b" * 40
        repo_name = "owner/repo"
        app_id = "com.example.app"

        # Simulate a head artifact that was uploaded before its base was available.
        # It has a commit_comparison with base_sha pointing to the not-yet-uploaded base.
        head_commit_comparison = CommitComparison.objects.create(
            organization_id=self.org.id,
            head_repo_name=repo_name,
            head_sha=head_sha,
            base_sha=base_sha,
            provider="github",
            head_ref="feature-branch",
            base_repo_name=repo_name,
        )
        head_artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.UPLOADED,
            app_id=app_id,
            commit_comparison=head_commit_comparison,
        )
        head_metrics = PreprodSnapshotMetrics.objects.create(
            preprod_artifact=head_artifact,
            image_count=1,
            extras={
                "manifest_key": f"{self.org.id}/{self.project.id}/{head_artifact.id}/manifest.json"
            },
        )

        # No comparison exists yet — the base was missing when the head was uploaded.
        assert not PreprodSnapshotComparison.objects.filter(
            head_snapshot_metrics=head_metrics
        ).exists()

        # Upload the base snapshot. Its head_sha matches the head artifact's base_sha.
        url = self._get_create_url()
        data = {
            "app_id": app_id,
            "head_sha": base_sha,
            "provider": "github",
            "head_repo_name": repo_name,
            "head_ref": "main",
            "images": {
                "img1": {
                    "content_hash": "img1",
                    "display_name": "Screen 1",
                    "width": 375,
                    "height": 812,
                },
            },
        }

        response = self.client.post(url, data, format="json")

        assert response.status_code == 200

        base_artifact = PreprodArtifact.objects.get(id=response.data["artifactId"])
        base_metrics = PreprodSnapshotMetrics.objects.get(preprod_artifact=base_artifact)

        # A pending comparison record should have been created linking head to base.
        comparison = PreprodSnapshotComparison.objects.get(
            head_snapshot_metrics=head_metrics,
            base_snapshot_metrics=base_metrics,
        )
        assert comparison.state == PreprodSnapshotComparison.State.PENDING

        # The comparison task should have been queued for the waiting head.
        mock_compare_snapshots.apply_async.assert_called_once_with(
            kwargs={
                "project_id": self.project.id,
                "org_id": self.org.id,
                "head_artifact_id": head_artifact.id,
                "base_artifact_id": base_artifact.id,
            }
        )

    @patch("sentry.preprod.api.endpoints.snapshots.preprod_artifact_snapshot.get_preprod_session")
    @patch("sentry.preprod.api.endpoints.snapshots.preprod_artifact_snapshot.compare_snapshots")
    def test_selective_base_is_matched_for_comparison(
        self, mock_compare_snapshots, mock_get_session
    ) -> None:
        """
        A SELECTIVE base build is matched as a comparison base and a comparison is
        dispatched against it when an incoming head references it.
        """
        base_sha = "b" * 40
        head_sha = "a" * 40
        repo_name = "owner/repo"
        app_id = "com.example.app"

        # A SELECTIVE base build whose commit_comparison.head_sha is the base_sha that
        # incoming heads will reference.
        base_commit_comparison = CommitComparison.objects.create(
            organization_id=self.org.id,
            head_repo_name=repo_name,
            head_sha=base_sha,
            base_sha="c" * 40,
            provider="github",
            head_ref="main",
            base_repo_name=repo_name,
        )
        base_artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.UPLOADED,
            app_id=app_id,
            commit_comparison=base_commit_comparison,
        )
        PreprodSnapshotMetrics.objects.create(
            preprod_artifact=base_artifact,
            image_count=1,
            is_selective=True,
            extras={
                "manifest_key": f"{self.org.id}/{self.project.id}/{base_artifact.id}/manifest.json"
            },
        )

        url = self._get_create_url()
        head_data = {
            "app_id": app_id,
            "head_sha": head_sha,
            "base_sha": base_sha,
            "provider": "github",
            "head_repo_name": repo_name,
            "base_repo_name": repo_name,
            "head_ref": "feature-branch",
            "images": {
                "img1": {
                    "content_hash": "img1",
                    "display_name": "Screen 1",
                    "width": 375,
                    "height": 812,
                },
            },
        }

        # The selective base IS matched and a comparison is dispatched.
        response = self.client.post(url, head_data, format="json")
        assert response.status_code == 200
        head_artifact = PreprodArtifact.objects.get(id=response.data["artifactId"])

        comparison = PreprodSnapshotComparison.objects.get(
            base_snapshot_metrics__preprod_artifact=base_artifact
        )
        assert comparison.state == PreprodSnapshotComparison.State.PENDING
        mock_compare_snapshots.apply_async.assert_called_once_with(
            kwargs={
                "project_id": self.project.id,
                "org_id": self.org.id,
                "head_artifact_id": head_artifact.id,
                "base_artifact_id": base_artifact.id,
            },
        )


class ProjectPreprodSnapshotGetTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)

    def _get_detail_url(self, snapshot_id):
        return reverse(
            "sentry-api-0-project-preprod-snapshots-detail",
            args=[self.org.slug, snapshot_id],
        )

    def _create_artifact_with_manifest(self, images=None, commit_comparison=None):
        """Helper to create an artifact with snapshot metrics and a manifest key."""
        if images is None:
            images = {
                "img1": {
                    "content_hash": "img1",
                    "display_name": "Screen1",
                    "width": 375,
                    "height": 812,
                },
                "img2": {
                    "content_hash": "img2",
                    "display_name": "Screen2",
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

    @patch("sentry.preprod.api.endpoints.snapshots.preprod_artifact_snapshot.get_preprod_session")
    def test_get_snapshot_details(self, mock_get_session):
        artifact, _, manifest_key, manifest_json, images = self._create_artifact_with_manifest()
        mock_get_session.return_value = self._create_mock_session(manifest_json)

        url = self._get_detail_url(artifact.id)
        response = self.client.get(url)

        assert response.status_code == 200
        assert response.data["head_artifact_id"] == str(artifact.id)
        assert response.data["state"] == PreprodArtifact.ArtifactState.UPLOADED
        assert response.data["image_count"] == 2
        assert len(response.data["images"]) == 2
        # Images should be sorted by key
        assert response.data["images"][0]["key"] == "img1"
        assert response.data["images"][0]["image_file_name"] == "img1"
        assert response.data["images"][1]["key"] == "img2"

    @patch("sentry.analytics.record")
    @patch("sentry.preprod.api.endpoints.snapshots.preprod_artifact_snapshot.get_preprod_session")
    def test_get_snapshot_details_records_web_client(self, mock_get_session, mock_record):
        artifact, _, _, manifest_json, _ = self._create_artifact_with_manifest()
        mock_get_session.return_value = self._create_mock_session(manifest_json)

        response = self.client.get(self._get_detail_url(artifact.id))

        assert response.status_code == 200
        assert_last_analytics_event(
            mock_record,
            PreprodArtifactApiGetSnapshotDetailsEvent(
                organization_id=self.org.id,
                project_id=self.project.id,
                user_id=self.user.id,
                artifact_id=str(artifact.id),
                client="web",
            ),
        )

    @patch("sentry.analytics.record")
    @patch("sentry.preprod.api.endpoints.snapshots.preprod_artifact_snapshot.get_preprod_session")
    def test_get_snapshot_details_records_mcp_client(self, mock_get_session, mock_record):
        artifact, _, _, manifest_json, _ = self._create_artifact_with_manifest()
        mock_get_session.return_value = self._create_mock_session(manifest_json)

        response = self.client.get(
            self._get_detail_url(artifact.id),
            HTTP_USER_AGENT="sentry-mcp/1.0",
            HTTP_X_SENTRY_MCP_CLIENT_FAMILY="cursor",
        )

        assert response.status_code == 200
        assert_last_analytics_event(
            mock_record,
            PreprodArtifactApiGetSnapshotDetailsEvent(
                organization_id=self.org.id,
                project_id=self.project.id,
                user_id=self.user.id,
                artifact_id=str(artifact.id),
                client="mcp:cursor",
            ),
        )

    @patch("sentry.preprod.api.endpoints.snapshots.preprod_artifact_snapshot.get_preprod_session")
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
        response = self.client.get(url)

        assert response.status_code == 200
        vcs_info = response.data["vcs_info"]
        assert vcs_info["head_sha"] == "a" * 40
        assert vcs_info["base_sha"] == "b" * 40
        assert vcs_info["provider"] == "github.com"
        assert vcs_info["head_repo_name"] == "owner/repo"
        assert vcs_info["head_ref"] == "chore/cleanup"
        assert vcs_info["pr_number"] == 123

    @patch("sentry.preprod.api.endpoints.snapshots.preprod_artifact_snapshot.get_preprod_session")
    def test_get_snapshot_details_returns_all_images(self, mock_get_session):
        images = {
            f"img{i:03d}": {
                "content_hash": f"img{i:03d}",
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
        response = self.client.get(url)

        assert response.status_code == 200
        assert len(response.data["images"]) == 10
        assert response.data["images"][0]["key"] == "img000"
        assert response.data["images"][9]["key"] == "img009"

    @patch("sentry.preprod.api.endpoints.snapshots.preprod_artifact_snapshot.get_preprod_session")
    def test_get_snapshot_diff_omits_images(self, mock_get_session):
        from sentry.preprod.snapshots.manifest import (
            ComparisonImageResult,
            ComparisonManifest,
            ComparisonSummary,
            ImageMetadata,
            SnapshotManifest,
        )

        head_images = {
            "changed.png": {
                "content_hash": "head_changed",
                "display_name": "Changed",
                "width": 100,
                "height": 100,
            },
            "unchanged.png": {
                "content_hash": "head_unchanged",
                "display_name": "Unchanged",
                "width": 100,
                "height": 100,
            },
        }
        artifact, head_metrics, head_manifest_key, head_manifest_json, _ = (
            self._create_artifact_with_manifest(images=head_images)
        )

        base_artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.UPLOADED,
            app_id="com.example.app",
        )
        base_manifest_key = f"{self.org.id}/{self.project.id}/{base_artifact.id}/manifest.json"
        PreprodSnapshotMetrics.objects.create(
            preprod_artifact=base_artifact,
            image_count=2,
            extras={"manifest_key": base_manifest_key},
        )
        base_manifest_json = orjson.dumps(
            SnapshotManifest(
                images={
                    "changed.png": ImageMetadata(
                        content_hash="base_changed", width=100, height=100
                    ),
                    "unchanged.png": ImageMetadata(
                        content_hash="head_unchanged", width=100, height=100
                    ),
                }
            ).dict()
        )

        comparison = self.create_preprod_snapshot_comparison(
            head_snapshot_metrics=head_metrics,
            base_snapshot_metrics=PreprodSnapshotMetrics.objects.get(
                preprod_artifact=base_artifact
            ),
            state=PreprodSnapshotComparison.State.SUCCESS,
            images_changed=1,
            images_unchanged=1,
        )
        comparison_key = (
            f"{self.org.id}/{self.project.id}/{artifact.id}/{base_artifact.id}/comparison.json"
        )
        comparison.extras = {"comparison_key": comparison_key}
        comparison.save(update_fields=["extras"])

        comparison_manifest_json = orjson.dumps(
            ComparisonManifest(
                head_artifact_id=artifact.id,
                base_artifact_id=base_artifact.id,
                summary=ComparisonSummary(
                    total=2,
                    changed=1,
                    unchanged=1,
                    added=0,
                    removed=0,
                    errored=0,
                    renamed=0,
                    skipped=0,
                ),
                images={
                    "changed.png": ComparisonImageResult(
                        status="changed",
                        head_hash="head_changed",
                        base_hash="base_changed",
                        changed_pixels=50,
                        total_pixels=100,
                        diff_mask_image_id="diff-mask-1",
                    ),
                    "unchanged.png": ComparisonImageResult(
                        status="unchanged",
                        head_hash="head_unchanged",
                        base_hash="head_unchanged",
                    ),
                },
            ).dict()
        )

        manifests_by_key = {
            head_manifest_key: head_manifest_json,
            base_manifest_key: base_manifest_json,
            comparison_key: comparison_manifest_json,
        }

        def _session_get(key):
            result = MagicMock()
            result.payload.read.return_value = manifests_by_key[key]
            return result

        mock_session = MagicMock()
        mock_session.get.side_effect = _session_get
        mock_get_session.return_value = mock_session

        url = self._get_detail_url(artifact.id)
        response = self.client.get(url)

        assert response.status_code == 200
        assert response.data["comparison_type"] == "diff"
        # Categorized arrays are still populated...
        assert response.data["changed_count"] == 1
        assert len(response.data["changed"]) == 1
        assert response.data["changed"][0]["head_image"]["image_file_name"] == "changed.png"
        assert response.data["unchanged_count"] == 1
        assert response.data["unchanged"][0]["image_file_name"] == "unchanged.png"
        # ...but the redundant flat images array is dropped in diff mode.
        assert response.data["images"] == []
        # image_count is unaffected.
        assert response.data["image_count"] == 2

    def test_get_snapshot_not_found(self) -> None:
        url = self._get_detail_url(99999)
        response = self.client.get(url)

        assert response.status_code == 404
        assert response.data["detail"] == "Snapshot not found"

    def test_get_snapshot_wrong_organization(self) -> None:
        """Artifact belonging to a different organization should return 404 (IDOR protection)."""
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        artifact = PreprodArtifact.objects.create(
            project=other_project,
            state=PreprodArtifact.ArtifactState.UPLOADED,
            app_id="com.other.app",
        )

        url = self._get_detail_url(artifact.id)
        response = self.client.get(url)

        assert response.status_code == 404

    @patch("sentry.preprod.api.endpoints.snapshots.preprod_artifact_snapshot.get_preprod_session")
    def test_get_snapshot_objectstore_error(self, mock_get_session):
        artifact, _, _, _, _ = self._create_artifact_with_manifest()
        mock_session = MagicMock()
        mock_session.get.side_effect = Exception("Storage error")
        mock_get_session.return_value = mock_session

        url = self._get_detail_url(artifact.id)
        response = self.client.get(url)

        assert response.status_code == 500
        assert response.data["detail"] == "Internal server error"

    def test_get_snapshot_no_metrics(self) -> None:
        """Artifact without snapshot metrics should return 404."""
        artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.UPLOADED,
            app_id="com.example.app",
        )

        url = self._get_detail_url(artifact.id)
        response = self.client.get(url)

        assert response.status_code == 404
        assert response.data["detail"] == "Snapshot metrics not found"

    def test_get_snapshot_returns_404_for_member_without_project_access(self) -> None:
        self.org.flags.allow_joinleave = False
        self.org.save()
        artifact, _, _, _, _ = self._create_artifact_with_manifest()
        team = self.create_team(organization=self.org)
        outsider = self.create_user(is_superuser=False)
        self.create_member(user=outsider, organization=self.org, role="member", teams=[team])
        self.login_as(user=outsider)

        url = self._get_detail_url(artifact.id)
        response = self.client.get(url)

        assert response.status_code == 404

    @patch("sentry.preprod.api.endpoints.snapshots.preprod_artifact_snapshot.get_preprod_session")
    def test_get_snapshot_flat_fields_solo_no_approval(self, mock_get_session):
        artifact, _, _, manifest_json, _ = self._create_artifact_with_manifest()
        mock_get_session.return_value = self._create_mock_session(manifest_json)

        url = self._get_detail_url(artifact.id)
        response = self.client.get(url)

        assert response.status_code == 200
        assert response.data["comparison_state"] is None
        assert response.data["approval_status"] is None
        assert response.data["comparison_error_message"] is None
        assert response.data["approvers"] == []
        assert response.data["comparison_type"] == "solo"

    @patch("sentry.preprod.api.endpoints.snapshots.preprod_artifact_snapshot.get_preprod_session")
    def test_get_snapshot_flat_fields_pending_comparison(self, mock_get_session):
        artifact, snapshot_metrics, _, manifest_json, _ = self._create_artifact_with_manifest(
            commit_comparison=CommitComparison.objects.create(
                organization_id=self.org.id,
                head_sha="a" * 40,
                base_sha="b" * 40,
                provider="github",
                head_repo_name="org/repo",
                head_ref="feature",
            ),
        )
        base_artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.UPLOADED,
            app_id="com.example.app",
        )
        base_metrics = PreprodSnapshotMetrics.objects.create(
            preprod_artifact=base_artifact,
            image_count=1,
            extras={"manifest_key": "base-key"},
        )
        self.create_preprod_snapshot_comparison(
            head_snapshot_metrics=snapshot_metrics,
            base_snapshot_metrics=base_metrics,
            state=PreprodSnapshotComparison.State.PENDING,
        )
        mock_get_session.return_value = self._create_mock_session(manifest_json)

        url = self._get_detail_url(artifact.id)
        response = self.client.get(url)

        assert response.status_code == 200
        assert response.data["comparison_state"] == "pending"

    @patch("sentry.preprod.api.endpoints.snapshots.preprod_artifact_snapshot.get_preprod_session")
    def test_get_snapshot_flat_fields_with_approval(self, mock_get_session):
        artifact, _, _, manifest_json, _ = self._create_artifact_with_manifest()
        self.create_preprod_comparison_approval(
            preprod_artifact=artifact,
            approval_status=PreprodComparisonApproval.ApprovalStatus.APPROVED,
            approved_by_id=self.user.id,
        )
        mock_get_session.return_value = self._create_mock_session(manifest_json)

        url = self._get_detail_url(artifact.id)
        response = self.client.get(url)

        assert response.status_code == 200
        assert response.data["approval_status"] == "approved"
        assert len(response.data["approvers"]) == 1
        assert response.data["approvers"][0]["source"] == "sentry"

    @patch("sentry.preprod.api.endpoints.snapshots.preprod_artifact_snapshot.get_preprod_session")
    def test_get_snapshot_flat_fields_auto_approved(self, mock_get_session):
        artifact, _, _, manifest_json, _ = self._create_artifact_with_manifest()
        self.create_preprod_comparison_approval(
            preprod_artifact=artifact,
            approval_status=PreprodComparisonApproval.ApprovalStatus.APPROVED,
            extras={"auto_approval": True},
        )
        mock_get_session.return_value = self._create_mock_session(manifest_json)

        url = self._get_detail_url(artifact.id)
        response = self.client.get(url)

        assert response.status_code == 200
        assert response.data["approval_status"] == "auto_approved"

    @patch("sentry.preprod.api.endpoints.snapshots.preprod_artifact_snapshot.get_preprod_session")
    def test_get_snapshot_flat_fields_waiting_for_base(self, mock_get_session):
        artifact, _, _, manifest_json, _ = self._create_artifact_with_manifest(
            commit_comparison=CommitComparison.objects.create(
                organization_id=self.org.id,
                head_sha="a" * 40,
                base_sha="b" * 40,
                provider="github",
                head_repo_name="org/repo",
                head_ref="feature",
            ),
        )
        mock_get_session.return_value = self._create_mock_session(manifest_json)

        url = self._get_detail_url(artifact.id)
        response = self.client.get(url)

        assert response.status_code == 200
        assert response.data["comparison_state"] == "waiting_for_base"
        assert response.data["comparison_type"] == "waiting_for_base"


class OrganizationPreprodLatestBaseSnapshotTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org, slug="sausage")

    def _get_url(self):
        return reverse(
            "sentry-api-0-organization-preprod-snapshots-latest-base",
            args=[self.org.slug],
        )

    def _create_base_snapshot(self, project=None):
        project = project or self.project
        images = {
            "components/button.png": {
                "content_hash": "hash_button",
                "display_name": "Button",
                "width": 375,
                "height": 812,
            }
        }
        artifact = PreprodArtifact.objects.create(
            project=project,
            state=PreprodArtifact.ArtifactState.UPLOADED,
            app_id="com.example.app",
        )
        manifest_key = f"{self.org.id}/{project.id}/{artifact.id}/manifest.json"
        PreprodSnapshotMetrics.objects.create(
            preprod_artifact=artifact,
            image_count=len(images),
            extras={"manifest_key": manifest_key},
        )
        return artifact, manifest_key, orjson.dumps({"images": images})

    def _create_mock_session(self, manifest_json):
        mock_result = MagicMock()
        mock_result.payload.read.return_value = manifest_json
        mock_session = MagicMock()
        mock_session.get.return_value = mock_result
        return mock_session

    def test_query_params_document_project_id_or_slug(self):
        assert LATEST_BASE_SNAPSHOT_GET_QUERY_PARAMS["project"] == {
            "type": "integer|string",
            "required": False,
            "description": "Project ID or slug to scope the lookup when app_id is not unique across projects or project inference is unavailable.",
        }
        assert LATEST_BASE_SNAPSHOT_GET_QUERY_PARAMS["projectSlug"] == {
            "type": "string",
            "required": False,
            "description": "Project slug to scope the lookup. Use either projectSlug or project when app_id is not unique across projects or project inference is unavailable.",
        }

    @patch(
        "sentry.preprod.api.endpoints.snapshots.preprod_artifact_snapshot_latest_base.get_preprod_session"
    )
    def test_get_latest_base_snapshot_scoped_by_project_slug(self, mock_get_session):
        artifact, manifest_key, manifest_json = self._create_base_snapshot()
        mock_get_session.return_value = self._create_mock_session(manifest_json)

        response = self.client.get(
            self._get_url(),
            {"app_id": "com.example.app", "projectSlug": self.project.slug},
        )

        assert response.status_code == 200
        assert response.data["head_artifact_id"] == str(artifact.id)
        assert response.data["project_slug"] == "sausage"
        assert response.data["image_count"] == 1
        assert response.data["images"][0]["image_file_name"] == "components/button.png"
        mock_get_session.assert_called_once_with(self.org.id, self.project.id)

    @patch(
        "sentry.preprod.api.endpoints.snapshots.preprod_artifact_snapshot_latest_base.get_preprod_session"
    )
    def test_get_latest_base_snapshot_scoped_by_project_param_slug(self, mock_get_session):
        artifact, _, manifest_json = self._create_base_snapshot()
        mock_get_session.return_value = self._create_mock_session(manifest_json)

        response = self.client.get(
            self._get_url(),
            {"app_id": "com.example.app", "project": self.project.slug},
        )

        assert response.status_code == 200
        assert response.data["head_artifact_id"] == str(artifact.id)
        assert response.data["project_slug"] == "sausage"
        mock_get_session.assert_called_once_with(self.org.id, self.project.id)

    @patch(
        "sentry.preprod.api.endpoints.snapshots.preprod_artifact_snapshot_latest_base.get_preprod_session"
    )
    def test_get_latest_base_snapshot_scoped_by_project_param_id(self, mock_get_session):
        artifact, _, manifest_json = self._create_base_snapshot()
        mock_get_session.return_value = self._create_mock_session(manifest_json)

        response = self.client.get(
            self._get_url(),
            {"app_id": "com.example.app", "project": str(self.project.id)},
        )

        assert response.status_code == 200
        assert response.data["head_artifact_id"] == str(artifact.id)
        assert response.data["project_slug"] == "sausage"
        mock_get_session.assert_called_once_with(self.org.id, self.project.id)

    @patch(
        "sentry.preprod.api.endpoints.snapshots.preprod_artifact_snapshot_latest_base.get_preprod_session"
    )
    def test_get_latest_base_snapshot_project_slug_takes_precedence_over_project(
        self, mock_get_session
    ):
        self._create_base_snapshot()
        other_project = self.create_project(organization=self.org, slug="other-project")
        artifact, _, manifest_json = self._create_base_snapshot(project=other_project)
        mock_get_session.return_value = self._create_mock_session(manifest_json)

        response = self.client.get(
            self._get_url(),
            {
                "app_id": "com.example.app",
                "project": self.project.slug,
                "projectSlug": other_project.slug,
            },
        )

        assert response.status_code == 200
        assert response.data["head_artifact_id"] == str(artifact.id)
        assert response.data["project_slug"] == "other-project"
        mock_get_session.assert_called_once_with(self.org.id, other_project.id)

    def test_get_latest_base_snapshot_rejects_all_project_id_sentinel(self):
        response = self.client.get(
            self._get_url(),
            {"app_id": "com.example.app", "project": "-1"},
        )

        assert response.status_code == 400
        assert response.data["detail"] == "Invalid project parameter"

    def test_get_latest_base_snapshot_rejects_all_project_slug_sentinel(self):
        response = self.client.get(
            self._get_url(),
            {"app_id": "com.example.app", "project": "$all"},
        )

        assert response.status_code == 400
        assert response.data["detail"] == "Invalid project parameter"

    def test_get_latest_base_snapshot_rejects_project_slug_all_sentinel(self):
        response = self.client.get(
            self._get_url(),
            {"app_id": "com.example.app", "projectSlug": "$all"},
        )

        assert response.status_code == 400
        assert response.data["detail"] == "Invalid project parameter"

    def test_get_latest_base_snapshot_rejects_project_slug_id_sentinel(self):
        response = self.client.get(
            self._get_url(),
            {"app_id": "com.example.app", "projectSlug": "-1"},
        )

        assert response.status_code == 400
        assert response.data["detail"] == "Invalid project parameter"


class ProjectPreprodSnapshotDeleteTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)

    def _delete_url(self, snapshot_id):
        return reverse(
            "sentry-api-0-project-preprod-snapshots-detail",
            args=[self.org.slug, snapshot_id],
        )

    def _create_snapshot_artifact(self):
        artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.UPLOADED,
            app_id="com.example.app",
        )
        PreprodSnapshotMetrics.objects.create(
            preprod_artifact=artifact,
            image_count=0,
            extras={"manifest_key": f"{self.org.id}/{self.project.id}/{artifact.id}/manifest.json"},
        )
        return artifact

    def test_delete_returns_404_for_member_without_project_access(self) -> None:
        self.org.flags.allow_joinleave = False
        self.org.save()
        artifact = self._create_snapshot_artifact()
        team = self.create_team(organization=self.org)
        outsider = self.create_user(is_superuser=False)
        self.create_member(user=outsider, organization=self.org, role="member", teams=[team])
        self.login_as(user=outsider)

        url = self._delete_url(artifact.id)
        response = self.client.delete(url)

        assert response.status_code == 404
        assert PreprodArtifact.objects.filter(id=artifact.id).exists()
