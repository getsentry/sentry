from __future__ import annotations

import io
import zipfile
from unittest.mock import MagicMock, patch

import orjson
from objectstore_client import Client, RequestError, Usecase

from sentry.preprod.models import PreprodArtifact
from sentry.preprod.snapshots.models import PreprodSnapshotMetrics
from sentry.preprod.snapshots.storage import SnapshotStorage
from sentry.preprod.snapshots.zip_tasks import build_snapshot_images_zip
from sentry.testutils.cases import TestCase

SESSION_TARGET = "sentry.preprod.snapshots.zip_tasks.get_snapshot_storage"


def _manifest_bytes() -> bytes:
    return orjson.dumps(
        {"images": {"a.png": {"content_hash": "hash_a", "width": 10, "height": 10}}}
    )


class BuildSnapshotImagesZipTest(TestCase):
    def setUp(self):
        super().setUp()
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.artifact = self.create_preprod_artifact(
            project=self.project, state=PreprodArtifact.ArtifactState.PROCESSED
        )
        PreprodSnapshotMetrics.objects.create(
            preprod_artifact=self.artifact, image_count=1, extras={"manifest_key": "mk"}
        )

    def _session(
        self,
        *,
        existing_archive_key: str | None = None,
    ) -> MagicMock:
        manifest_key = "mk"
        image_key = f"{self.org.id}/{self.project.id}/hash_a"
        data = {manifest_key: _manifest_bytes(), image_key: b"PNGDATA"}
        if existing_archive_key is not None:
            data[existing_archive_key] = b"ZIPBYTES"

        def _get(key):
            if key not in data:
                return None
            result = MagicMock()
            result.payload.read.return_value = data[key]
            return result

        session = MagicMock()
        session.get.side_effect = _get
        return session

    @patch("sentry.preprod.snapshots.zip_tasks._send_archive_email")
    @patch(SESSION_TARGET)
    @patch("objectstore_client.client._resumable.upload")
    def test_build_uses_resumable_upload_and_includes_manifest(
        self, mock_upload, mock_session, mock_email
    ):
        session = self._session()
        mock_session.return_value = session
        primary = Client("http://objectstore.invalid").session(
            Usecase("preprod_snapshots", resumable_threshold_bytes=1)
        )
        session.put.side_effect = SnapshotStorage(primary, MagicMock()).put
        archive_bytes = b""

        def upload(client_session, body, size, **kwargs):
            nonlocal archive_bytes
            assert body.seekable()
            assert body.tell() == 0
            archive_bytes = body.read()
            assert len(archive_bytes) == size
            return kwargs["key"]

        mock_upload.side_effect = upload
        build_snapshot_images_zip(
            org_id=self.org.id,
            project_id=self.project.id,
            artifact_id=self.artifact.id,
            user_id=self.user.id,
        )
        session.put.assert_called_once()
        kwargs = session.put.call_args.kwargs
        assert kwargs["key"] == f"snapshot_archives/{self.artifact.id}.zip"
        assert kwargs["compress"] == "none"
        assert kwargs["content_type"] == "application/zip"

        mock_upload.assert_called_once()
        assert mock_upload.call_args.args[1] is session.put.call_args.args[0]
        assert mock_upload.call_args.kwargs["compression"] == "none"
        with zipfile.ZipFile(io.BytesIO(archive_bytes)) as archive:
            assert sorted(archive.namelist()) == ["a.png", "manifest.json"]
            assert archive.read("manifest.json") == _manifest_bytes()
        mock_email.assert_called_once()
        assert mock_email.call_args.kwargs["ready"] is True

    @patch("sentry.preprod.snapshots.zip_tasks._send_archive_email")
    @patch(SESSION_TARGET)
    def test_reuses_existing_archive(self, mock_session, mock_email):
        session = self._session(existing_archive_key=f"snapshot_archives/{self.artifact.id}.zip")
        mock_session.return_value = session
        build_snapshot_images_zip(
            org_id=self.org.id,
            project_id=self.project.id,
            artifact_id=self.artifact.id,
            user_id=self.user.id,
        )
        session.put.assert_not_called()
        mock_email.assert_called_once()
        assert mock_email.call_args.kwargs["ready"] is True

    @patch("sentry.preprod.snapshots.zip_tasks._send_archive_email")
    @patch(SESSION_TARGET)
    def test_emails_failure_when_upload_raises(self, mock_session, mock_email):
        session = self._session()
        session.put.side_effect = RuntimeError("boom")
        mock_session.return_value = session
        build_snapshot_images_zip(
            org_id=self.org.id,
            project_id=self.project.id,
            artifact_id=self.artifact.id,
            user_id=self.user.id,
        )
        mock_email.assert_called_once()
        assert mock_email.call_args.kwargs["ready"] is False

    @patch("sentry.preprod.snapshots.zip_tasks._archive_available", return_value=True)
    @patch("sentry.preprod.snapshots.zip_tasks._send_archive_email")
    @patch(SESSION_TARGET)
    def test_emails_ready_when_failure_superseded_by_existing_archive(
        self, mock_session, mock_email, mock_available
    ):
        session = self._session()
        session.put.side_effect = RuntimeError("boom")
        mock_session.return_value = session
        build_snapshot_images_zip(
            org_id=self.org.id,
            project_id=self.project.id,
            artifact_id=self.artifact.id,
            user_id=self.user.id,
        )
        mock_email.assert_called_once()
        assert mock_email.call_args.kwargs["ready"] is True

    @patch("sentry.preprod.snapshots.zip_tasks._send_archive_email")
    @patch(SESSION_TARGET)
    def test_emails_failure_when_metrics_missing(self, mock_session, mock_email):
        self.artifact.preprodsnapshotmetrics.delete()
        mock_session.return_value = self._session()
        build_snapshot_images_zip(
            org_id=self.org.id,
            project_id=self.project.id,
            artifact_id=self.artifact.id,
            user_id=self.user.id,
        )
        mock_email.assert_called_once()
        assert mock_email.call_args.kwargs["ready"] is False

    def test_snapshot_page_url_targets_frontend_page(self):
        from sentry.preprod.snapshots.zip_tasks import _snapshot_page_url

        url = _snapshot_page_url(self.org, self.artifact.id)
        assert f"/organizations/{self.org.slug}/preprod/snapshots/{self.artifact.id}" in url
        assert "?download" not in url

    @patch("sentry.preprod.snapshots.zip_tasks._send_archive_email")
    @patch(SESSION_TARGET)
    def test_emails_failure_when_objectstore_probe_errors(self, mock_session, mock_email):
        # A non-404 error from the existence probe must surface as a failure email,
        # never a silent wedge (there is no status to poll).
        session = MagicMock()
        session.get.side_effect = RequestError("boom", status=500, response="")
        mock_session.return_value = session
        build_snapshot_images_zip(
            org_id=self.org.id,
            project_id=self.project.id,
            artifact_id=self.artifact.id,
            user_id=self.user.id,
        )
        mock_email.assert_called_once()
        assert mock_email.call_args.kwargs["ready"] is False
