from typing import Any

import orjson
from django.test import override_settings

from sentry.preprod.models import PreprodArtifact
from sentry.testutils.auth import generate_service_request_signature
from sentry.testutils.cases import TestCase
from sentry.utils import json


class ProjectPreprodArtifactUpdateEndpointTest(TestCase):
    def setUp(self):
        super().setUp()
        self.file = self.create_file(name="test_artifact.apk", type="application/octet-stream")
        self.preprod_artifact = PreprodArtifact.objects.create(
            project=self.project,
            file_id=self.file.id,
            state=PreprodArtifact.ArtifactState.UPLOADING,
        )

    def _get_url(self, artifact_id=None):
        artifact_id = artifact_id or self.preprod_artifact.id
        return f"/api/0/internal/{self.organization.slug}/{self.project.slug}/files/preprodartifacts/{artifact_id}/update/"

    def _make_request(self, data, artifact_id=None, authenticated=True):
        url = self._get_url(artifact_id)
        json_data = orjson.dumps(data) if isinstance(data, dict) else data

        kwargs: dict[str, Any] = {"data": json_data, "content_type": "application/json"}
        if authenticated:
            signature = generate_service_request_signature(
                url, json_data, ["test-secret-key"], "Launchpad"
            )
            kwargs["HTTP_AUTHORIZATION"] = f"rpcsignature {signature}"

        return self.client.put(url, **kwargs)

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_update_preprod_artifact_success(self):
        data = {
            "date_built": "2024-01-01T00:00:00Z",
            "artifact_type": 1,
            "build_version": "1.2.3",
            "build_number": 123,
        }
        response = self._make_request(data)

        assert response.status_code == 200
        resp_data = response.json()
        assert resp_data["success"] is True
        assert resp_data["artifact_id"] == str(self.preprod_artifact.id)
        assert set(resp_data["updated_fields"]) == {
            "date_built",
            "artifact_type",
            "build_version",
            "build_number",
            "state",
        }

        self.preprod_artifact.refresh_from_db()
        assert self.preprod_artifact.date_built is not None
        assert self.preprod_artifact.date_built.isoformat() == "2024-01-01T00:00:00+00:00"
        assert self.preprod_artifact.artifact_type == 1
        assert self.preprod_artifact.build_version == "1.2.3"
        assert self.preprod_artifact.build_number == 123

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_update_preprod_artifact_partial_update(self):
        data = {"artifact_type": 2, "error_message": "Build failed"}
        response = self._make_request(data)

        assert response.status_code == 200
        resp_data = response.json()
        assert resp_data["success"] is True
        assert set(resp_data["updated_fields"]) == {"artifact_type", "error_message", "state"}

        self.preprod_artifact.refresh_from_db()
        assert self.preprod_artifact.artifact_type == 2
        assert self.preprod_artifact.error_message == "Build failed"
        assert self.preprod_artifact.state == PreprodArtifact.ArtifactState.FAILED

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_update_preprod_artifact_sets_failed_state_on_error(self):
        # Test that setting error_code sets state to FAILED
        data = {"error_code": 1}
        response = self._make_request(data)

        assert response.status_code == 200
        resp_data = response.json()
        assert resp_data["success"] is True
        assert set(resp_data["updated_fields"]) == {"error_code", "state"}

        self.preprod_artifact.refresh_from_db()
        assert self.preprod_artifact.error_code == 1
        assert self.preprod_artifact.state == PreprodArtifact.ArtifactState.FAILED

        # Reset for next test
        self.preprod_artifact.state = PreprodArtifact.ArtifactState.UPLOADING
        self.preprod_artifact.error_code = None
        self.preprod_artifact.save()

        # Test that setting error_message sets state to FAILED
        data_two = {"error_message": "Processing failed"}
        response = self._make_request(data_two)

        assert response.status_code == 200
        resp_data = response.json()
        assert resp_data["success"] is True
        assert set(resp_data["updated_fields"]) == {"error_message", "state"}

        self.preprod_artifact.refresh_from_db()
        assert self.preprod_artifact.error_message == "Processing failed"
        assert self.preprod_artifact.state == PreprodArtifact.ArtifactState.FAILED

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_update_preprod_artifact_not_found(self):
        response = self._make_request({"artifact_type": 1}, artifact_id=999999)
        assert response.status_code == 404
        assert "not found" in response.json()["error"]

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_update_preprod_artifact_invalid_json(self):
        response = self._make_request(b"invalid json")
        assert response.status_code == 400
        assert "Invalid json body" in response.json()["error"]

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_update_preprod_artifact_invalid_schema(self):
        response = self._make_request({"artifact_type": 99})  # Invalid value
        assert response.status_code == 400
        assert (
            "The artifact_type field must be an integer between 0 and 2."
            in response.json()["error"]
        )

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_update_preprod_artifact_extra_properties(self):
        response = self._make_request({"artifact_type": 1, "extra_field": "not allowed"})
        assert response.status_code == 200

    def test_update_preprod_artifact_unauthorized(self):
        response = self._make_request({"artifact_type": 1}, authenticated=False)
        assert response.status_code == 403

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_update_preprod_artifact_empty_update(self):
        response = self._make_request({})
        assert response.status_code == 200
        resp_data = response.json()
        assert resp_data["success"] is True
        assert resp_data["updated_fields"] == []

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_update_preprod_artifact_with_apple_app_info(self):
        apple_info = {
            "is_simulator": True,
            "codesigning_type": "development",
            "profile_name": "Test Profile",
            "is_code_signature_valid": False,
            "code_signature_errors": ["Certificate expired", "Missing entitlements"],
        }
        data = {
            "date_built": "2024-01-01T00:00:00Z",
            "artifact_type": 1,
            "build_version": "1.2.3",
            "build_number": 123,
            "apple_app_info": apple_info,
        }
        response = self._make_request(data)

        assert response.status_code == 200
        resp_data = response.json()
        assert resp_data["success"] is True
        assert "extras" in resp_data["updated_fields"]

        self.preprod_artifact.refresh_from_db()
        stored_apple_info = json.loads(self.preprod_artifact.extras or "{}")
        assert stored_apple_info == apple_info

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_update_preprod_artifact_with_partial_apple_app_info(self):
        apple_info = {
            "is_simulator": False,
            "codesigning_type": "distribution",
        }
        data = {
            "artifact_type": 2,
            "apple_app_info": apple_info,
        }
        response = self._make_request(data)

        assert response.status_code == 200
        resp_data = response.json()
        assert resp_data["success"] is True
        assert "extras" in resp_data["updated_fields"]

        self.preprod_artifact.refresh_from_db()
        stored_apple_info = json.loads(self.preprod_artifact.extras or "{}")
        # Should only contain the fields that were provided
        assert stored_apple_info == apple_info
        assert "profile_name" not in stored_apple_info
        assert "is_code_signature_valid" not in stored_apple_info
