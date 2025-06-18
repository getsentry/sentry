import orjson
from django.conf import settings
from django.test import override_settings
from django.urls import reverse

from sentry.testutils.auth import generate_service_request_signature
from sentry.testutils.cases import APITestCase


def generate_launchpad_request_signature(url_path: str, body: bytes) -> str:
    """
    Generate a signature for the request body
    with the first shared secret. If there are other
    shared secrets in the list they are only to be used
    for verification during key rotation.

    NOTE: This function is only used for testing and has been moved
    from production code since the actual launchpad service doesn't exist yet.
    """
    return generate_service_request_signature(
        url_path, body, settings.LAUNCHPAD_RPC_SHARED_SECRET, "Launchpad"
    )


@override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["launchpad-test-secret-key"])
class TestLaunchpadAuthentication(APITestCase):
    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)

    def auth_header(self, path: str, data: dict | str) -> str:
        if isinstance(data, dict):
            data = orjson.dumps(data).decode()
        signature = generate_launchpad_request_signature(path, data.encode())
        return f"rpcsignature {signature}"

    def test_size_analysis_endpoint_requires_auth(self):
        """Test that the size analysis endpoint requires Launchpad authentication"""
        path = reverse(
            "sentry-api-0-project-preprod-artifact-assemble-size-analysis",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "project_id_or_slug": self.project.slug,
                "artifact_id": "123",
            },
        )
        data = {
            "checksum": "a" * 40,
            "chunks": ["b" * 40, "c" * 40],
        }

        # Test without authentication - should fail
        response = self.client.post(path, data=data)
        assert response.status_code in [401, 403]  # Either is acceptable for no auth

        # Test with valid authentication - should succeed (even if missing chunks)
        response = self.client.post(
            path, data=data, HTTP_AUTHORIZATION=self.auth_header(path, data)
        )
        # Should return 200 with missing chunks error (not 403 auth error)
        assert response.status_code == 200
        assert "missingChunks" in response.json()

    def test_update_endpoint_requires_auth(self):
        """Test that the update endpoint requires Launchpad authentication"""
        path = reverse(
            "sentry-api-0-project-preprod-artifact-update",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "project_id_or_slug": self.project.slug,
                "artifact_id": "123",
            },
        )
        data = {
            "state": 1,
            "artifact_type": 0,
        }

        # Test without authentication - should fail
        response = self.client.put(path, data=data)
        assert response.status_code in [401, 403]  # Either is acceptable for no auth

        # Test with valid authentication - should succeed (even if artifact doesn't exist)
        response = self.client.put(path, data=data, HTTP_AUTHORIZATION=self.auth_header(path, data))
        # Should return 404 (artifact not found) not 403 (auth error)
        assert response.status_code == 404

    def test_invalid_signature_fails(self):
        """Test that invalid signatures are rejected"""
        path = reverse(
            "sentry-api-0-project-preprod-artifact-assemble-size-analysis",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "project_id_or_slug": self.project.slug,
                "artifact_id": "123",
            },
        )
        data = {
            "checksum": "a" * 40,
            "chunks": ["b" * 40, "c" * 40],
        }

        # Test with invalid signature
        response = self.client.post(
            path, data=data, HTTP_AUTHORIZATION="rpcsignature rpc0:invalidsignature"
        )
        assert response.status_code == 401
