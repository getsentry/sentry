import hashlib
import hmac
from typing import Optional

import responses
from rest_framework.response import Response

from fixtures.vercel import (
    DEPLOYMENT_WEBHOOK_NO_COMMITS,
    EXAMPLE_DEPLOYMENT_WEBHOOK_RESPONSE_NEW,
    EXAMPLE_DEPLOYMENT_WEBHOOK_RESPONSE_OLD,
    MINIMAL_WEBHOOK,
    SECRET,
    SIGNATURE,
    SIGNATURE_NEW,
)
from sentry import VERSION
from sentry.models import (
    Integration,
    OrganizationIntegration,
    SentryAppInstallation,
    SentryAppInstallationForProvider,
    SentryAppInstallationToken,
)
from sentry.testutils import APITestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.silo import control_silo_test
from sentry.utils import json
from sentry.utils.http import absolute_uri


class SignatureVercelTest(APITestCase):
    webhook_url = "/extensions/vercel/webhook/"

    def test_get(self):
        response = self.client.get(self.webhook_url)
        assert response.status_code == 405

    def test_invalid_signature(self):
        with override_options({"vercel.client-secret": SECRET}):
            response = self.client.post(
                path=self.webhook_url,
                data=EXAMPLE_DEPLOYMENT_WEBHOOK_RESPONSE_OLD,
                content_type="application/json",
                HTTP_X_ZEIT_SIGNATURE="xxxinvalidsignaturexxx",
            )

            assert response.status_code == 401


@control_silo_test
class VercelReleasesTest(APITestCase):
    webhook_url = "/extensions/vercel/webhook/"
    header = "VERCEL"

    @staticmethod
    def get_signature(message: str) -> str:
        return hmac.new(
            key=b"vercel-client-secret",
            msg=message.encode("utf-8"),
            digestmod=hashlib.sha1,
        ).hexdigest()

    def _get_response(self, message: str, signature: Optional[str] = None) -> Response:
        signature = signature or self.get_signature(message)
        return self.client.post(
            path=self.webhook_url,
            data=message,
            content_type="application/json",
            **{f"HTTP_X_{self.header}_SIGNATURE": signature},
        )

    def setUp(self):
        super().setUp()
        self.project = self.create_project(organization=self.organization)
        self.integration = Integration.objects.create(
            provider="vercel",
            external_id="cstd1xKmLGVMed0z0f3SHlD2",
            metadata={"access_token": "my_token"},
        )

        self.org_integration = OrganizationIntegration.objects.create(
            organization_id=self.organization.id,
            integration=self.integration,
            config={
                "project_mappings": [
                    [self.project.id, "QmQPfU4xn5APjEsSje4ccPcSJCmVAByA8CDKfZRhYyVPAg"]
                ]
            },
        )

        self.sentry_app = self.create_internal_integration(
            webhook_url=None,
            name="Vercel Internal Integration",
            organization=self.organization,
        )
        sentry_app_installation = SentryAppInstallation.objects.get(sentry_app=self.sentry_app)
        self.installation_for_provider = SentryAppInstallationForProvider.objects.create(
            organization_id=self.organization.id,
            provider="vercel",
            sentry_app_installation=sentry_app_installation,
        )

    def tearDown(self):
        responses.reset()

    @responses.activate
    def test_create_release(self):
        responses.add(
            responses.POST,
            absolute_uri("/api/0/organizations/%s/releases/" % self.organization.slug),
            json={},
        )

        with override_options({"vercel.client-secret": SECRET}):
            response = self._get_response(EXAMPLE_DEPLOYMENT_WEBHOOK_RESPONSE_OLD, SIGNATURE)

            assert response.status_code == 201

            assert len(responses.calls) == 2
            release_request = responses.calls[0].request
            release_body = json.loads(release_request.body)
            set_refs_body = json.loads(responses.calls[1].request.body)
            assert release_body == {
                "projects": [self.project.slug],
                "version": "7488658dfcf24d9b735e015992b316e2a8340d9d",
            }
            assert set_refs_body == {
                "projects": [self.project.slug],
                "version": "7488658dfcf24d9b735e015992b316e2a8340d9d",
                "refs": [
                    {
                        "commit": "7488658dfcf24d9b735e015992b316e2a8340d9d",
                        "repository": "MeredithAnya/nextjsblog-demo",
                    }
                ],
            }
            assert release_request.headers["User-Agent"] == f"sentry_vercel/{VERSION}"

    @responses.activate
    def test_create_release_new(self):
        responses.add(
            responses.POST,
            absolute_uri("/api/0/organizations/%s/releases/" % self.organization.slug),
            json={},
        )

        with override_options({"vercel.client-secret": SECRET}):
            response = self._get_response(EXAMPLE_DEPLOYMENT_WEBHOOK_RESPONSE_NEW, SIGNATURE_NEW)

            assert response.status_code == 201

            assert len(responses.calls) == 2
            release_request = responses.calls[0].request
            release_body = json.loads(release_request.body)
            set_refs_body = json.loads(responses.calls[1].request.body)
            assert release_body == {
                "projects": [self.project.slug],
                "version": "7488658dfcf24d9b735e015992b316e2a8340d93",
            }
            assert set_refs_body == {
                "projects": [self.project.slug],
                "version": "7488658dfcf24d9b735e015992b316e2a8340d93",
                "refs": [
                    {
                        "commit": "7488658dfcf24d9b735e015992b316e2a8340d93",
                        "repository": "MeredithAnya/nextjsblog-demo-new",
                    }
                ],
            }
            assert release_request.headers["User-Agent"] == f"sentry_vercel/{VERSION}"

    @responses.activate
    def test_no_match(self):
        responses.add(
            responses.POST,
            absolute_uri("/api/0/organizations/%s/releases/" % self.organization.slug),
            json={},
        )

        self.org_integration.config = {}
        self.org_integration.save()

        with override_options({"vercel.client-secret": SECRET}):
            response = self._get_response(EXAMPLE_DEPLOYMENT_WEBHOOK_RESPONSE_OLD, SIGNATURE)

            assert len(responses.calls) == 0
            assert response.status_code == 204

    @responses.activate
    def test_no_integration(self):
        responses.add(
            responses.POST,
            absolute_uri("/api/0/organizations/%s/releases/" % self.organization.slug),
            json={},
        )
        self.integration.delete()

        with override_options({"vercel.client-secret": SECRET}):
            response = self._get_response(EXAMPLE_DEPLOYMENT_WEBHOOK_RESPONSE_OLD, SIGNATURE)

            assert len(responses.calls) == 0
            assert response.status_code == 404
            assert response.data["detail"] == "Integration not found"

    @responses.activate
    def test_no_project(self):
        responses.add(
            responses.POST,
            absolute_uri("/api/0/organizations/%s/releases/" % self.organization.slug),
            json={},
        )
        self.project.delete()

        with override_options({"vercel.client-secret": SECRET}):
            response = self._get_response(EXAMPLE_DEPLOYMENT_WEBHOOK_RESPONSE_OLD, SIGNATURE)

            assert len(responses.calls) == 0
            assert response.status_code == 404
            assert response.data["detail"] == "Project not found"

    @responses.activate
    def test_no_installation(self):
        responses.add(
            responses.POST,
            absolute_uri("/api/0/organizations/%s/releases/" % self.organization.slug),
            json={},
        )
        self.installation_for_provider.delete()

        with override_options({"vercel.client-secret": SECRET}):
            response = self._get_response(EXAMPLE_DEPLOYMENT_WEBHOOK_RESPONSE_OLD, SIGNATURE)

            assert len(responses.calls) == 0
            assert response.status_code == 404
            assert response.data["detail"] == "Installation not found"

    @responses.activate
    def test_no_token(self):
        responses.add(
            responses.POST,
            absolute_uri("/api/0/organizations/%s/releases/" % self.organization.slug),
            json={},
        )

        SentryAppInstallationToken.objects.filter().delete()

        with override_options({"vercel.client-secret": SECRET}):
            response = self._get_response(EXAMPLE_DEPLOYMENT_WEBHOOK_RESPONSE_OLD, SIGNATURE)

            assert len(responses.calls) == 0
            assert response.status_code == 404
            assert response.data["detail"] == "Token not found"

    @responses.activate
    def test_create_release_fails(self):
        responses.add(
            responses.POST,
            absolute_uri("/api/0/organizations/%s/releases/" % self.organization.slug),
            json={},
            status=400,
        )

        with override_options({"vercel.client-secret": SECRET}):
            response = self._get_response(EXAMPLE_DEPLOYMENT_WEBHOOK_RESPONSE_OLD, SIGNATURE)

            assert len(responses.calls) == 1
            assert response.status_code == 400
            assert "Error creating release" in response.data["detail"]

    @responses.activate
    def test_set_refs_failed(self):
        def request_callback(request):
            payload = json.loads(request.body)
            status_code = 400 if payload.get("refs") else 200
            return (status_code, {}, json.dumps({}))

        responses.add_callback(
            responses.POST,
            absolute_uri("/api/0/organizations/%s/releases/" % self.organization.slug),
            callback=request_callback,
        )

        with override_options({"vercel.client-secret": SECRET}):
            response = self._get_response(EXAMPLE_DEPLOYMENT_WEBHOOK_RESPONSE_OLD, SIGNATURE)

            assert len(responses.calls) == 2
            assert response.status_code == 400
            assert "Error setting refs" in response.data["detail"]

    @responses.activate
    def test_manual_vercel_deploy(self):
        response = self._get_response(DEPLOYMENT_WEBHOOK_NO_COMMITS)

        assert response.status_code == 404
        assert "No commit found" == response.data["detail"]
        assert len(responses.calls) == 0

    def test_empty_payload(self):
        response = self._get_response("{}")

        assert response.status_code == 400

    def test_missing_repository(self):
        response = self._get_response(MINIMAL_WEBHOOK)

        assert response.status_code == 400
        assert "Could not determine repository" == response.data["detail"]


class VercelReleasesNewTest(VercelReleasesTest):
    webhook_url = "/extensions/vercel/delete/"
    header = "VERCEL"

    @responses.activate
    def test_release_already_created(self):
        responses.add(
            responses.POST,
            absolute_uri("/api/0/organizations/%s/releases/" % self.organization.slug),
            json={},
        )

        self.create_release(
            project=self.project, version="7488658dfcf24d9b735e015992b316e2a8340d9d"
        )

        with override_options({"vercel.client-secret": SECRET}):
            response = self._get_response(EXAMPLE_DEPLOYMENT_WEBHOOK_RESPONSE_OLD, SIGNATURE)

            assert response.status_code == 201
