from __future__ import annotations

from collections.abc import Mapping
from unittest.mock import MagicMock, patch

from django.urls import reverse
from objectstore_client import RequestError

from sentry.preprod.analytics import PreprodArtifactApiSnapshotArchiveDownloadEvent
from sentry.preprod.api.endpoints.snapshots.preprod_artifact_snapshot_archive import (
    OrganizationPreprodSnapshotArchiveEndpoint,
)
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.snapshots.models import PreprodSnapshotMetrics
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.analytics import assert_last_analytics_event
from sentry.types.ratelimit import RateLimitCategory

ENQUEUE_TARGET = (
    "sentry.preprod.api.endpoints.snapshots."
    "preprod_artifact_snapshot_archive.build_snapshot_images_zip"
)
SESSION_TARGET = (
    "sentry.preprod.api.endpoints.snapshots.preprod_artifact_snapshot_archive.get_preprod_session"
)


class BaseSnapshotArchiveTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)

    def _artifact(self):
        artifact = self.create_preprod_artifact(
            project=self.project, state=PreprodArtifact.ArtifactState.PROCESSED
        )
        PreprodSnapshotMetrics.objects.create(
            preprod_artifact=artifact, image_count=1, extras={"manifest_key": "k"}
        )
        return artifact

    def _url(self, snapshot_id, download=False):
        url = reverse(
            "sentry-api-0-organization-preprod-snapshots-archive",
            args=[self.org.slug, snapshot_id],
        )
        return f"{url}?download=true" if download else url


class SnapshotArchiveTriggerTest(BaseSnapshotArchiveTest):
    @patch(ENQUEUE_TARGET)
    def test_post_enqueues_build_and_returns_202(self, mock_task):
        artifact = self._artifact()
        response = self.client.post(self._url(artifact.id))
        assert response.status_code == 202
        mock_task.apply_async.assert_called_once_with(
            kwargs={
                "org_id": self.org.id,
                "project_id": self.project.id,
                "artifact_id": artifact.id,
                "user_id": self.user.id,
            }
        )

    @patch(ENQUEUE_TARGET)
    def test_post_returns_503_when_enqueue_fails(self, mock_task):
        artifact = self._artifact()
        mock_task.apply_async.side_effect = RuntimeError("broker down")
        response = self.client.post(self._url(artifact.id))
        assert response.status_code == 503

    def test_rate_limit_applies_to_post_only(self):
        overrides = OrganizationPreprodSnapshotArchiveEndpoint.rate_limits.limit_overrides
        assert isinstance(overrides, Mapping)
        assert "POST" in overrides
        assert "GET" not in overrides
        assert overrides["POST"][RateLimitCategory.USER].limit == 5


class SnapshotArchiveReadinessTest(BaseSnapshotArchiveTest):
    @patch(SESSION_TARGET)
    def test_get_reports_ready_when_archive_present(self, mock_session):
        artifact = self._artifact()
        session = MagicMock()
        session.get.return_value = MagicMock()
        mock_session.return_value = session
        response = self.client.get(self._url(artifact.id))
        assert response.status_code == 200
        assert response.data["ready"] is True

    @patch(SESSION_TARGET)
    def test_get_reports_not_ready_when_archive_absent(self, mock_session):
        artifact = self._artifact()
        session = MagicMock()
        session.get.side_effect = RequestError("not found", status=404, response="")
        mock_session.return_value = session
        response = self.client.get(self._url(artifact.id))
        assert response.status_code == 200
        assert response.data["ready"] is False

    @patch(SESSION_TARGET)
    def test_get_reports_not_ready_on_transient_objectstore_error(self, mock_session):
        artifact = self._artifact()
        session = MagicMock()
        session.get.side_effect = RequestError("unavailable", status=503, response="")
        mock_session.return_value = session
        response = self.client.get(self._url(artifact.id))
        assert response.status_code == 200
        assert response.data["ready"] is False


class SnapshotArchiveDownloadTest(BaseSnapshotArchiveTest):
    @patch(SESSION_TARGET)
    def test_download_streams_when_object_present(self, mock_session):
        artifact = self._artifact()
        result = MagicMock()
        result.payload.read.side_effect = [b"ZIPBYTES", b""]
        result.metadata = MagicMock()
        session = MagicMock()
        session.get.return_value = result
        mock_session.return_value = session
        response = self.client.get(self._url(artifact.id, download=True))
        assert response.status_code == 200
        assert response["Content-Type"] == "application/zip"
        assert b"".join(response.streaming_content) == b"ZIPBYTES"

    @patch(SESSION_TARGET)
    def test_download_returns_409_when_absent(self, mock_session):
        artifact = self._artifact()
        session = MagicMock()
        session.get.side_effect = RequestError("not found", status=404, response="")
        mock_session.return_value = session
        response = self.client.get(self._url(artifact.id, download=True))
        assert response.status_code == 409

    def _ready_session(self, mock_session):
        result = MagicMock()
        result.payload.read.side_effect = [b"ZIPBYTES", b""]
        result.metadata = MagicMock()
        session = MagicMock()
        session.get.return_value = result
        mock_session.return_value = session

    @patch("sentry.analytics.record")
    @patch(SESSION_TARGET)
    def test_download_records_web_client_analytics(self, mock_session, mock_record):
        artifact = self._artifact()
        self._ready_session(mock_session)
        # setUp logged the user in via session cookies and sent no token, so the
        # request classifies as a frontend (web) download.
        response = self.client.get(self._url(artifact.id, download=True))
        assert response.status_code == 200
        assert_last_analytics_event(
            mock_record,
            PreprodArtifactApiSnapshotArchiveDownloadEvent(
                organization_id=self.org.id,
                project_id=self.project.id,
                user_id=self.user.id,
                artifact_id=str(artifact.id),
                client="web",
            ),
        )

    @patch("sentry.analytics.record")
    @patch(SESSION_TARGET)
    def test_download_records_sentry_cli_client_analytics(self, mock_session, mock_record):
        artifact = self._artifact()
        self._ready_session(mock_session)
        token = self.create_user_auth_token(user=self.user, scope_list=["project:read"])
        # Bearer auth sets request.auth, so the request is not a frontend request and
        # the sentry-cli User-Agent drives classification — mirroring the real CLI.
        response = self.client.get(
            self._url(artifact.id, download=True),
            HTTP_AUTHORIZATION=f"Bearer {token.token}",
            HTTP_USER_AGENT="sentry-cli/2.30.0",
        )
        assert response.status_code == 200
        assert_last_analytics_event(
            mock_record,
            PreprodArtifactApiSnapshotArchiveDownloadEvent(
                organization_id=self.org.id,
                project_id=self.project.id,
                user_id=self.user.id,
                artifact_id=str(artifact.id),
                client="sentry-cli",
            ),
        )

    @patch("sentry.analytics.record")
    @patch(SESSION_TARGET)
    def test_readiness_probe_records_no_download_event(self, mock_session, mock_record):
        artifact = self._artifact()
        session = MagicMock()
        session.get.return_value = MagicMock()
        mock_session.return_value = session
        response = self.client.get(self._url(artifact.id))
        assert response.status_code == 200
        assert not any(
            isinstance(call.args[0], PreprodArtifactApiSnapshotArchiveDownloadEvent)
            for call in mock_record.call_args_list
        )

    @patch("sentry.analytics.record")
    @patch(ENQUEUE_TARGET)
    def test_post_build_trigger_records_no_download_event(self, mock_task, mock_record):
        artifact = self._artifact()
        response = self.client.post(self._url(artifact.id))
        assert response.status_code == 202
        assert not any(
            isinstance(call.args[0], PreprodArtifactApiSnapshotArchiveDownloadEvent)
            for call in mock_record.call_args_list
        )
