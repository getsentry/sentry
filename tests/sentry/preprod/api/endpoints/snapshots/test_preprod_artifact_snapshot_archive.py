from __future__ import annotations

from datetime import datetime, timezone
from io import BytesIO
from unittest.mock import MagicMock, patch

from django.urls import reverse

from sentry.preprod.models import PreprodArtifact
from sentry.preprod.snapshots.models import PreprodSnapshotMetrics
from sentry.testutils.cases import APITestCase
from sentry.utils.locking import UnableToAcquireLock

ENQUEUE_TARGET = (
    "sentry.preprod.api.endpoints.snapshots."
    "preprod_artifact_snapshot_archive.build_snapshot_images_zip"
)


class BaseSnapshotArchiveTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)

    def _artifact(self, extras=None):
        artifact = self.create_preprod_artifact(
            project=self.project, state=PreprodArtifact.ArtifactState.PROCESSED
        )
        PreprodSnapshotMetrics.objects.create(
            preprod_artifact=artifact,
            image_count=1,
            extras={"manifest_key": "k", **(extras or {})},
        )
        return artifact

    def _url(self, snapshot_id, download=False):
        url = reverse(
            "sentry-api-0-organization-preprod-snapshots-archive",
            args=[self.org.slug, snapshot_id],
        )
        return f"{url}?download=true" if download else url


class SnapshotDownloadStatusTest(BaseSnapshotArchiveTest):
    @patch(ENQUEUE_TARGET)
    def test_status_enqueues_build_when_absent(self, mock_task):
        artifact = self._artifact()
        with self.feature("organizations:preprod-snapshots"):
            response = self.client.get(self._url(artifact.id))
        assert response.status_code == 200
        assert response.data["status"] == "building"
        extras = PreprodSnapshotMetrics.objects.get(preprod_artifact=artifact).extras
        assert extras is not None
        state = extras["images_zip"]
        mock_task.apply_async.assert_called_once_with(
            kwargs={
                "org_id": self.org.id,
                "project_id": self.project.id,
                "artifact_id": artifact.id,
                "build_token": state["enqueued_at"],
            }
        )

    @patch(ENQUEUE_TARGET)
    def test_status_resets_progress_on_fresh_enqueue(self, mock_task):
        artifact = self._artifact()
        with self.feature("organizations:preprod-snapshots"):
            response = self.client.get(self._url(artifact.id))
        assert response.status_code == 200
        assert response.data["status"] == "building"
        assert response.data["progress"] == 0

    @patch(ENQUEUE_TARGET)
    def test_status_surfaces_build_progress(self, mock_task):
        enqueued_at = datetime.now(timezone.utc).isoformat()
        artifact = self._artifact(
            extras={
                "images_zip": {
                    "status": "building",
                    "enqueued_at": enqueued_at,
                    "progress": 42,
                }
            }
        )
        with self.feature("organizations:preprod-snapshots"):
            response = self.client.get(self._url(artifact.id))
        assert response.status_code == 200
        assert response.data["status"] == "building"
        assert response.data["progress"] == 42
        mock_task.apply_async.assert_not_called()

    @patch(ENQUEUE_TARGET)
    def test_status_reports_ready_without_reenqueue(self, mock_task):
        f = self.create_file(name="z.zip", type="preprod_snapshot_images.zip")
        f.putfile(BytesIO(b"zipbytes"))
        artifact = self._artifact(
            extras={"images_zip": {"status": "ready", "file_id": f.id, "size": f.size}}
        )
        with self.feature("organizations:preprod-snapshots"):
            response = self.client.get(self._url(artifact.id))
        assert response.status_code == 200
        assert response.data["status"] == "ready"
        mock_task.apply_async.assert_not_called()

    @patch(ENQUEUE_TARGET)
    def test_status_reenqueues_when_ready_but_file_missing(self, mock_task):
        artifact = self._artifact(
            extras={"images_zip": {"status": "ready", "file_id": 999999, "size": 5}}
        )
        with self.feature("organizations:preprod-snapshots"):
            response = self.client.get(self._url(artifact.id))
        assert response.status_code == 200
        assert response.data["status"] == "building"

    @patch(ENQUEUE_TARGET)
    def test_status_reports_failed_without_reenqueue(self, mock_task):
        artifact = self._artifact(extras={"images_zip": {"status": "failed"}})
        with self.feature("organizations:preprod-snapshots"):
            response = self.client.get(self._url(artifact.id))
        assert response.status_code == 200
        assert response.data["status"] == "failed"
        mock_task.apply_async.assert_not_called()

    @patch(ENQUEUE_TARGET)
    def test_status_retry_reenqueues_failed_build(self, mock_task):
        artifact = self._artifact(extras={"images_zip": {"status": "failed"}})
        with self.feature("organizations:preprod-snapshots"):
            response = self.client.get(self._url(artifact.id) + "?retry=true")
        assert response.status_code == 200
        assert response.data["status"] == "building"
        mock_task.apply_async.assert_called_once()

    @patch(ENQUEUE_TARGET)
    def test_status_lock_contention_does_not_report_stale_ready(self, mock_task):
        artifact = self._artifact(
            extras={"images_zip": {"status": "ready", "file_id": 999999, "size": 5}}
        )
        lock = MagicMock()
        lock.acquire.side_effect = UnableToAcquireLock
        with (
            patch(
                "sentry.preprod.api.endpoints.snapshots."
                "preprod_artifact_snapshot_archive.locks.get",
                return_value=lock,
            ),
            self.feature("organizations:preprod-snapshots"),
        ):
            response = self.client.get(self._url(artifact.id))
        assert response.status_code == 200
        assert response.data["status"] == "building"

    @patch(ENQUEUE_TARGET)
    def test_status_marks_failed_when_enqueue_fails(self, mock_task):
        mock_task.apply_async.side_effect = Exception("broker down")
        artifact = self._artifact()
        with self.feature("organizations:preprod-snapshots"):
            response = self.client.get(self._url(artifact.id))
        assert response.status_code == 200
        assert response.data["status"] == "failed"
        metrics = PreprodSnapshotMetrics.objects.get(preprod_artifact=artifact)
        assert metrics.extras is not None
        state = metrics.extras["images_zip"]
        assert state["status"] == "failed"

    @patch(ENQUEUE_TARGET)
    def test_status_returns_404_when_metrics_deleted_mid_request(self, mock_task):
        artifact = self._artifact()
        with (
            patch.object(
                PreprodSnapshotMetrics,
                "refresh_from_db",
                side_effect=PreprodSnapshotMetrics.DoesNotExist,
            ),
            self.feature("organizations:preprod-snapshots"),
        ):
            response = self.client.get(self._url(artifact.id))
        assert response.status_code == 404

    @patch(ENQUEUE_TARGET)
    def test_status_reconciles_to_ready_when_build_finishes_mid_request(self, mock_task):
        f = self.create_file(name="z.zip", type="preprod_snapshot_images.zip")
        f.putfile(BytesIO(b"zipbytes"))
        enqueued_at = datetime.now(timezone.utc).isoformat()
        artifact = self._artifact(
            extras={
                "images_zip": {
                    "status": "building",
                    "enqueued_at": enqueued_at,
                    "progress": 10,
                }
            }
        )

        original_refresh = PreprodSnapshotMetrics.refresh_from_db

        def finish_build(self_metrics, *args, **kwargs):
            PreprodSnapshotMetrics.objects.filter(pk=self_metrics.pk).update(
                extras={
                    "manifest_key": "k",
                    "images_zip": {"status": "ready", "file_id": f.id, "size": f.size},
                }
            )
            original_refresh(self_metrics, *args, **kwargs)

        with (
            patch.object(
                PreprodSnapshotMetrics, "refresh_from_db", autospec=True, side_effect=finish_build
            ),
            self.feature("organizations:preprod-snapshots"),
        ):
            response = self.client.get(self._url(artifact.id))
        assert response.status_code == 200
        assert response.data["status"] == "ready"
        mock_task.apply_async.assert_not_called()

    @patch(ENQUEUE_TARGET)
    def test_status_reconciles_to_failed_when_build_fails_mid_request(self, mock_task):
        enqueued_at = datetime.now(timezone.utc).isoformat()
        artifact = self._artifact(
            extras={
                "images_zip": {
                    "status": "building",
                    "enqueued_at": enqueued_at,
                    "progress": 10,
                }
            }
        )

        original_refresh = PreprodSnapshotMetrics.refresh_from_db

        def fail_build(self_metrics, *args, **kwargs):
            PreprodSnapshotMetrics.objects.filter(pk=self_metrics.pk).update(
                extras={"manifest_key": "k", "images_zip": {"status": "failed"}}
            )
            original_refresh(self_metrics, *args, **kwargs)

        with (
            patch.object(
                PreprodSnapshotMetrics, "refresh_from_db", autospec=True, side_effect=fail_build
            ),
            self.feature("organizations:preprod-snapshots"),
        ):
            response = self.client.get(self._url(artifact.id))
        assert response.status_code == 200
        assert response.data["status"] == "failed"
        assert "progress" not in response.data


class SnapshotDownloadBytesTest(BaseSnapshotArchiveTest):
    def setUp(self):
        super().setUp()
        self.content = b"0123456789" * 100  # 1000 bytes

    def _ready_artifact(self):
        f = self.create_file(
            name="snapshot_images.zip",
            type="preprod_snapshot_images.zip",
            headers={"Content-Type": "application/zip"},
        )
        f.putfile(BytesIO(self.content))
        artifact = self._artifact(
            extras={"images_zip": {"status": "ready", "file_id": f.id, "size": f.size}}
        )
        return artifact, f

    def _read(self, response):
        return b"".join(response.streaming_content)

    def test_full_download(self):
        artifact, f = self._ready_artifact()
        with self.feature("organizations:preprod-snapshots"):
            response = self.client.get(self._url(artifact.id, download=True))
        assert response.status_code == 200
        assert self._read(response) == self.content
        assert response["Content-Length"] == str(len(self.content))
        assert response["Accept-Ranges"] == "bytes"
        assert response["ETag"] == f'"{f.checksum}"'
        assert "attachment" in response["Content-Disposition"]
        # nginx buffering disabled so >1GB control-silo downloads aren't truncated
        assert response["X-Accel-Buffering"] == "no"

    def test_bounded_range(self):
        artifact, _ = self._ready_artifact()
        with self.feature("organizations:preprod-snapshots"):
            response = self.client.get(
                self._url(artifact.id, download=True), HTTP_RANGE="bytes=5-14"
            )
        assert response.status_code == 206
        assert self._read(response) == self.content[5:15]
        assert response["Content-Length"] == "10"
        assert response["Content-Range"] == f"bytes 5-14/{len(self.content)}"
        assert response["X-Accel-Buffering"] == "no"

    def test_suffix_range(self):
        artifact, _ = self._ready_artifact()
        with self.feature("organizations:preprod-snapshots"):
            response = self.client.get(
                self._url(artifact.id, download=True), HTTP_RANGE="bytes=-10"
            )
        assert response.status_code == 206
        assert self._read(response) == self.content[-10:]
        assert response["Content-Range"] == f"bytes 990-999/{len(self.content)}"

    def test_unbounded_range(self):
        artifact, _ = self._ready_artifact()
        with self.feature("organizations:preprod-snapshots"):
            response = self.client.get(
                self._url(artifact.id, download=True), HTTP_RANGE="bytes=990-"
            )
        assert response.status_code == 206
        assert self._read(response) == self.content[990:]
        assert response["Content-Range"] == f"bytes 990-999/{len(self.content)}"

    def test_invalid_range_416(self):
        artifact, _ = self._ready_artifact()
        with self.feature("organizations:preprod-snapshots"):
            response = self.client.get(
                self._url(artifact.id, download=True), HTTP_RANGE="bytes=5000-6000"
            )
        assert response.status_code == 416

    def test_download_not_ready_409(self):
        artifact = self._artifact()
        with self.feature("organizations:preprod-snapshots"):
            response = self.client.get(self._url(artifact.id, download=True))
        assert response.status_code == 409

    def test_head_advertises_accept_ranges(self):
        artifact, f = self._ready_artifact()
        with self.feature("organizations:preprod-snapshots"):
            response = self.client.head(self._url(artifact.id))
        assert response.status_code == 200
        assert response["Content-Length"] == str(len(self.content))
        assert response["Accept-Ranges"] == "bytes"
        assert response["Content-Type"] == "application/zip"
        assert response["ETag"] == f'"{f.checksum}"'

    def test_head_not_ready_409(self):
        artifact = self._artifact()
        with self.feature("organizations:preprod-snapshots"):
            response = self.client.head(self._url(artifact.id))
        assert response.status_code == 409
