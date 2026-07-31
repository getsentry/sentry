from unittest.mock import MagicMock, patch

import orjson
from django.urls import reverse

from sentry.preprod.analytics import PreprodArtifactApiGetLatestBaseSnapshotEvent
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.snapshots.models import PreprodSnapshotMetrics
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.analytics import assert_last_analytics_event

MOCK_TARGET = "sentry.preprod.api.endpoints.snapshots.preprod_artifact_snapshot_latest_base.get_preprod_session"


class OrganizationPreprodLatestBaseSnapshotTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)

    def _get_url(self):
        return reverse(
            "sentry-api-0-organization-preprod-snapshots-latest-base",
            args=[self.org.slug],
        )

    def _create_base_artifact(self, app_id="com.example.app"):
        """Create a base snapshot (no commit_comparison) with a manifest."""
        artifact = PreprodArtifact.objects.create(
            project=self.project,
            state=PreprodArtifact.ArtifactState.UPLOADED,
            app_id=app_id,
        )
        manifest_key = f"{self.org.id}/{self.project.id}/{artifact.id}/manifest.json"
        PreprodSnapshotMetrics.objects.create(
            preprod_artifact=artifact,
            image_count=1,
            extras={"manifest_key": manifest_key},
        )
        manifest_json = orjson.dumps(
            {
                "images": {
                    "screen1.png": {
                        "content_hash": "hash1",
                        "display_name": "Screen 1",
                        "width": 375,
                        "height": 812,
                        "canvas_theme": "dark",
                    },
                },
            }
        )
        return artifact, manifest_key, manifest_json

    def _create_mock_session(self, manifest_json):
        mock_result = MagicMock()
        mock_result.payload.read.return_value = manifest_json
        mock_session = MagicMock()
        mock_session.get.return_value = mock_result
        return mock_session

    @patch(MOCK_TARGET)
    def test_returns_canvas_theme(self, mock_get_session):
        _, _, manifest_json = self._create_base_artifact()
        mock_get_session.return_value = self._create_mock_session(manifest_json)

        response = self.client.get(self._get_url(), {"app_id": "com.example.app"})

        assert response.status_code == 200
        image = response.data["images"][0]
        assert image["canvas_theme"] == "dark"
        assert image["key"] == "hash1"

    @patch("sentry.analytics.record")
    @patch(MOCK_TARGET)
    def test_records_web_client_analytics(self, mock_get_session, mock_record):
        artifact, _, manifest_json = self._create_base_artifact()
        mock_get_session.return_value = self._create_mock_session(manifest_json)

        response = self.client.get(self._get_url(), {"app_id": "com.example.app"})

        assert response.status_code == 200
        assert_last_analytics_event(
            mock_record,
            PreprodArtifactApiGetLatestBaseSnapshotEvent(
                organization_id=self.org.id,
                project_id=self.project.id,
                user_id=self.user.id,
                artifact_id=str(artifact.id),
                app_id="com.example.app",
                client="web",
            ),
        )

    @patch("sentry.analytics.record")
    @patch(MOCK_TARGET)
    def test_records_mcp_client_analytics(self, mock_get_session, mock_record):
        artifact, _, manifest_json = self._create_base_artifact()
        mock_get_session.return_value = self._create_mock_session(manifest_json)

        response = self.client.get(
            self._get_url(),
            {"app_id": "com.example.app"},
            HTTP_USER_AGENT="sentry-mcp/1.0",
            HTTP_X_SENTRY_MCP_CLIENT_FAMILY="cursor",
        )

        assert response.status_code == 200
        assert_last_analytics_event(
            mock_record,
            PreprodArtifactApiGetLatestBaseSnapshotEvent(
                organization_id=self.org.id,
                project_id=self.project.id,
                user_id=self.user.id,
                artifact_id=str(artifact.id),
                app_id="com.example.app",
                client="mcp:cursor",
            ),
        )
