from unittest.mock import patch

import orjson
from django.test import override_settings

from sentry.preprod.models import PreprodArtifact
from sentry.testutils.auth import generate_service_request_signature
from sentry.testutils.cases import TestCase

SHARED_SECRET_FOR_TESTS = "test-secret-key"


class ProjectPreprodDistributionEndpointTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.file = self.create_file(name="test_artifact.apk", type="application/octet-stream")
        self.artifact = self.create_preprod_artifact(
            project=self.project,
            file_id=self.file.id,
            state=PreprodArtifact.ArtifactState.PROCESSED,
        )

    def _put(self, data, secret=SHARED_SECRET_FOR_TESTS):
        url = f"/api/0/organizations/{self.organization.slug}/preprodartifacts/{self.artifact.id}/distribution/"
        signature = generate_service_request_signature(url, data, [secret], "Launchpad")
        return self.client.put(
            url,
            data=data,
            content_type="application/json",
            HTTP_AUTHORIZATION=f"rpcsignature {signature}",
        )

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=[SHARED_SECRET_FOR_TESTS])
    @patch(
        "sentry.preprod.api.endpoints.project_preprod_distribution.send_build_distribution_webhook"
    )
    def test_bad_auth(self, mock_send_webhook) -> None:
        response = self._put(b"{}", secret="wrong secret")
        assert response.status_code == 401
        mock_send_webhook.assert_not_called()

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=[SHARED_SECRET_FOR_TESTS])
    @patch(
        "sentry.preprod.api.endpoints.project_preprod_distribution.send_build_distribution_webhook"
    )
    def test_missing_fields(self, mock_send_webhook) -> None:
        response = self._put(b"{}")
        assert response.status_code == 400
        mock_send_webhook.assert_not_called()

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=[SHARED_SECRET_FOR_TESTS])
    @patch(
        "sentry.preprod.api.endpoints.project_preprod_distribution.send_build_distribution_webhook"
    )
    def test_bad_json(self, mock_send_webhook) -> None:
        response = self._put(b"{")
        assert response.status_code == 400
        mock_send_webhook.assert_not_called()

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=[SHARED_SECRET_FOR_TESTS])
    @patch(
        "sentry.preprod.api.endpoints.project_preprod_distribution.send_build_distribution_webhook"
    )
    def test_accepts_generic_processing_error(self, mock_send_webhook) -> None:
        response = self._put(orjson.dumps({"error_code": 3, "error_message": "some novel failure"}))

        assert response.status_code == 200
        self.artifact.refresh_from_db()
        assert (
            self.artifact.installable_app_error_code
            == PreprodArtifact.InstallableAppErrorCode.PROCESSING_ERROR
        )
        assert self.artifact.installable_app_error_message == "some novel failure"

        mock_send_webhook.assert_called_once()
        call_kwargs = mock_send_webhook.call_args
        assert call_kwargs.kwargs["organization_id"] == self.project.organization_id

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=[SHARED_SECRET_FOR_TESTS])
    @patch(
        "sentry.preprod.api.endpoints.project_preprod_distribution.send_build_distribution_webhook"
    )
    def test_legacy_payload_stored_verbatim(self, mock_send_webhook) -> None:
        # Launchpad deployments that still send the legacy shape
        # (error_code=SKIPPED + error_message="invalid_signature", etc.)
        # should continue to write unchanged until launchpad emits the
        # new granular codes directly.
        response = self._put(orjson.dumps({"error_code": 2, "error_message": "invalid_signature"}))

        assert response.status_code == 200
        self.artifact.refresh_from_db()
        assert (
            self.artifact.installable_app_error_code
            == PreprodArtifact.InstallableAppErrorCode.SKIPPED
        )
        assert self.artifact.installable_app_error_message == "invalid_signature"

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=[SHARED_SECRET_FOR_TESTS])
    @patch(
        "sentry.preprod.api.endpoints.project_preprod_distribution.send_build_distribution_webhook"
    )
    def test_accepts_new_granular_code(self, mock_send_webhook) -> None:
        response = self._put(
            orjson.dumps(
                {
                    "error_code": int(
                        PreprodArtifact.InstallableAppErrorCode.INVALID_CODE_SIGNATURE
                    ),
                    "error_message": "",
                }
            )
        )

        assert response.status_code == 200
        self.artifact.refresh_from_db()
        assert (
            self.artifact.installable_app_error_code
            == PreprodArtifact.InstallableAppErrorCode.INVALID_CODE_SIGNATURE
        )
        assert self.artifact.installable_app_error_message == ""

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=[SHARED_SECRET_FOR_TESTS])
    def test_invalid_error_code(self) -> None:
        response = self._put(orjson.dumps({"error_code": 99, "error_message": "bad"}))
        assert response.status_code == 400

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=[SHARED_SECRET_FOR_TESTS])
    def test_non_dict_json_body(self) -> None:
        response = self._put(orjson.dumps([1, 2, 3]))
        assert response.status_code == 400

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=[SHARED_SECRET_FOR_TESTS])
    def test_requires_launchpad_rpc_authentication(self) -> None:
        self.login_as(self.user)

        url = f"/api/0/organizations/{self.organization.slug}/preprodartifacts/{self.artifact.id}/distribution/"
        response = self.client.put(
            url,
            data=orjson.dumps({"error_code": 3, "error_message": "some error"}),
            content_type="application/json",
        )

        assert response.status_code == 401
