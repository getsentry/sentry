from __future__ import annotations

import io
from unittest.mock import MagicMock, patch

import orjson
import pytest
from objectstore_client import RequestError
from objectstore_client.multipart import CompletePart

from sentry.preprod.models import PreprodArtifact
from sentry.preprod.snapshots import zip_tasks
from sentry.preprod.snapshots.models import PreprodSnapshotMetrics
from sentry.preprod.snapshots.zip_tasks import (
    _put_part_with_retry,
    _upload_archive_multipart,
    build_snapshot_images_zip,
)
from sentry.testutils.cases import TestCase

SESSION_TARGET = "sentry.preprod.snapshots.zip_tasks.get_preprod_session"


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

    def _session(self, *, archive_exists: bool) -> MagicMock:
        manifest_key = "mk"
        archive_key = f"snapshot_archives/{self.artifact.id}.zip"
        image_key = f"{self.org.id}/{self.project.id}/hash_a"
        data = {manifest_key: _manifest_bytes(), image_key: b"PNGDATA"}
        if archive_exists:
            data[archive_key] = b"ZIPBYTES"

        def _get(key):
            if key in data:
                result = MagicMock()
                result.payload.read.return_value = data[key]
                return result
            raise RequestError("not found", status=404, response="")

        session = MagicMock()
        session.get.side_effect = _get
        return session

    @patch("sentry.preprod.snapshots.zip_tasks._send_archive_email")
    @patch(SESSION_TARGET)
    def test_builds_and_uploads_via_multipart_then_emails(self, mock_session, mock_email):
        session = self._session(archive_exists=False)
        mock_session.return_value = session
        build_snapshot_images_zip(
            org_id=self.org.id,
            project_id=self.project.id,
            artifact_id=self.artifact.id,
            user_id=self.user.id,
        )
        session.initiate_multipart_upload.assert_called_once()
        kwargs = session.initiate_multipart_upload.call_args.kwargs
        assert kwargs["key"] == f"snapshot_archives/{self.artifact.id}.zip"
        assert kwargs["compression"] == "none"
        assert kwargs["content_type"] == "application/zip"

        upload = session.initiate_multipart_upload.return_value
        assert upload.put_part.call_count >= 1
        upload.complete.assert_called_once()
        mock_email.assert_called_once()
        assert mock_email.call_args.kwargs["ready"] is True

    @patch("sentry.preprod.snapshots.zip_tasks._send_archive_email")
    @patch(SESSION_TARGET)
    def test_skips_rebuild_when_archive_exists(self, mock_session, mock_email):
        session = self._session(archive_exists=True)
        mock_session.return_value = session
        build_snapshot_images_zip(
            org_id=self.org.id,
            project_id=self.project.id,
            artifact_id=self.artifact.id,
            user_id=self.user.id,
        )
        session.initiate_multipart_upload.assert_not_called()
        mock_email.assert_called_once()
        assert mock_email.call_args.kwargs["ready"] is True

    @patch("sentry.preprod.snapshots.zip_tasks._send_archive_email")
    @patch(SESSION_TARGET)
    def test_emails_failure_when_upload_raises(self, mock_session, mock_email):
        session = self._session(archive_exists=False)
        session.initiate_multipart_upload.side_effect = RuntimeError("boom")
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
        session = self._session(archive_exists=False)
        session.initiate_multipart_upload.side_effect = RuntimeError("boom")
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
        mock_session.return_value = self._session(archive_exists=False)
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


class MultipartUploadHelperTest(TestCase):
    @patch("sentry.preprod.snapshots.zip_tasks.time.sleep")
    def test_put_part_retries_then_succeeds(self, mock_sleep):
        upload = MagicMock()
        part = CompletePart(part_number=1, etag="e1")
        upload.put_part.side_effect = [
            RequestError("transient", status=500, response=""),
            part,
        ]

        result = _put_part_with_retry(upload, b"data", 1)

        assert result is part
        assert upload.put_part.call_count == 2

    @patch("sentry.preprod.snapshots.zip_tasks.time.sleep")
    def test_put_part_retries_on_transport_error(self, mock_sleep):
        from urllib3.exceptions import ProtocolError

        upload = MagicMock()
        part = CompletePart(part_number=1, etag="e1")
        upload.put_part.side_effect = [ProtocolError("connection aborted"), part]

        result = _put_part_with_retry(upload, b"data", 1)

        assert result is part
        assert upload.put_part.call_count == 2

    @patch("sentry.preprod.snapshots.zip_tasks.time.sleep")
    def test_put_part_raises_after_max_retries(self, mock_sleep):
        upload = MagicMock()
        upload.put_part.side_effect = RequestError("down", status=500, response="")

        with pytest.raises(RequestError):
            _put_part_with_retry(upload, b"data", 1)

        assert upload.put_part.call_count == 3

    def test_upload_archive_multipart_uploads_all_parts(self):
        upload = MagicMock()
        upload.put_part.side_effect = lambda chunk, *, part_number, content_length: CompletePart(
            part_number=part_number, etag=f"e{part_number}"
        )
        session = MagicMock()
        session.initiate_multipart_upload.return_value = upload

        with patch.object(zip_tasks, "MULTIPART_PART_SIZE", 4):
            _upload_archive_multipart(session, "snapshot_archives/1.zip", io.BytesIO(b"abcdefghij"))

        session.initiate_multipart_upload.assert_called_once_with(
            key="snapshot_archives/1.zip",
            compression="none",
            content_type="application/zip",
        )
        assert upload.put_part.call_count == 3
        upload.complete.assert_called_once()
        parts = upload.complete.call_args.args[0]
        assert [p.part_number for p in parts] == [1, 2, 3]
        upload.abort.assert_not_called()

    @patch("sentry.preprod.snapshots.zip_tasks.time.sleep")
    def test_upload_archive_multipart_aborts_on_failure(self, mock_sleep):
        upload = MagicMock()
        upload.put_part.side_effect = RequestError("down", status=500, response="")
        session = MagicMock()
        session.initiate_multipart_upload.return_value = upload

        with patch.object(zip_tasks, "MULTIPART_PART_SIZE", 4):
            with pytest.raises(RequestError):
                _upload_archive_multipart(
                    session, "snapshot_archives/1.zip", io.BytesIO(b"abcdefgh")
                )

        upload.abort.assert_called_once()
        upload.complete.assert_not_called()
