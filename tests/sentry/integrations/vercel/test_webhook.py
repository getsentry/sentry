from __future__ import absolute_import

import hashlib
import hmac
import responses

from sentry import VERSION
from sentry.models import (
    Integration,
    OrganizationIntegration,
    SentryAppInstallationForProvider,
    SentryAppInstallation,
    SentryAppInstallationToken,
)
from sentry.testutils import APITestCase
from sentry.testutils.helpers import override_options
from sentry.utils import json
from sentry.utils.http import absolute_uri

from .testutils import EXAMPLE_DEPLOYMENT_WEBHOOK_RESPONSE, DEPLOYMENT_WEBHOOK_NO_COMMITS

signature = "74b587857986545361e8a4253b74cd6224d34869"
secret = "AiK52QASLJXmCXX3X9gO2Zyh"


webhook_url = "/extensions/vercel/webhook/"


class SignatureVercelTest(APITestCase):
    def test_get(self):
        response = self.client.get(webhook_url)
        assert response.status_code == 405

    def test_invalid_signature(self):
        with override_options({"vercel.client-secret": secret}):
            response = self.client.post(
                path=webhook_url,
                data=EXAMPLE_DEPLOYMENT_WEBHOOK_RESPONSE,
                content_type="application/json",
                HTTP_X_ZEIT_SIGNATURE="xxxinvalidsignaturexxx",
            )

            assert response.status_code == 401


class VercelReleasesTest(APITestCase):
    def setUp(self):
        super(VercelReleasesTest, self).setUp()
        self.project = self.create_project(organization=self.organization)
        self.integration = Integration.objects.create(
            provider="vercel",
            external_id="cstd1xKmLGVMed0z0f3SHlD2",
            metadata={"access_token": "my_token"},
        )

        self.org_integration = OrganizationIntegration.objects.create(
            organization=self.organization,
            integration=self.integration,
            config={
                "project_mappings": [
                    [self.project.id, "QmQPfU4xn5APjEsSje4ccPcSJCmVAByA8CDKfZRhYyVPAg"]
                ]
            },
        )

        self.sentry_app = self.create_internal_integration(
            webhook_url=None, name="Vercel Internal Integration", organization=self.organization,
        )
        sentry_app_installation = SentryAppInstallation.objects.get(sentry_app=self.sentry_app)
        self.installation_for_provider = SentryAppInstallationForProvider.objects.create(
            organization=self.organization,
            provider="vercel",
            sentry_app_installation=sentry_app_installation,
        )

    @responses.activate
    def test_create_release(self):
        responses.add(
            responses.POST,
            absolute_uri("/api/0/organizations/%s/releases/" % self.organization.slug),
            json={},
        )

        with override_options({"vercel.client-secret": secret}):
            response = self.client.post(
                path=webhook_url,
                data=EXAMPLE_DEPLOYMENT_WEBHOOK_RESPONSE,
                content_type="application/json",
                HTTP_X_ZEIT_SIGNATURE=signature,
            )

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
            assert release_request.headers["User-Agent"] == u"sentry_vercel/{}".format(VERSION)

    @responses.activate
    def test_no_match(self):
        responses.add(
            responses.POST,
            absolute_uri("/api/0/organizations/%s/releases/" % self.organization.slug),
            json={},
        )

        self.org_integration.config = {}
        self.org_integration.save()

        with override_options({"vercel.client-secret": secret}):
            response = self.client.post(
                path=webhook_url,
                data=EXAMPLE_DEPLOYMENT_WEBHOOK_RESPONSE,
                content_type="application/json",
                HTTP_X_ZEIT_SIGNATURE=signature,
            )

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

        with override_options({"vercel.client-secret": secret}):
            response = self.client.post(
                path=webhook_url,
                data=EXAMPLE_DEPLOYMENT_WEBHOOK_RESPONSE,
                content_type="application/json",
                HTTP_X_ZEIT_SIGNATURE=signature,
            )

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

        with override_options({"vercel.client-secret": secret}):
            response = self.client.post(
                path=webhook_url,
                data=EXAMPLE_DEPLOYMENT_WEBHOOK_RESPONSE,
                content_type="application/json",
                HTTP_X_ZEIT_SIGNATURE=signature,
            )

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

        with override_options({"vercel.client-secret": secret}):
            response = self.client.post(
                path=webhook_url,
                data=EXAMPLE_DEPLOYMENT_WEBHOOK_RESPONSE,
                content_type="application/json",
                HTTP_X_ZEIT_SIGNATURE=signature,
            )

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

        with override_options({"vercel.client-secret": secret}):
            response = self.client.post(
                path=webhook_url,
                data=EXAMPLE_DEPLOYMENT_WEBHOOK_RESPONSE,
                content_type="application/json",
                HTTP_X_ZEIT_SIGNATURE=signature,
            )

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

        with override_options({"vercel.client-secret": secret}):
            response = self.client.post(
                path=webhook_url,
                data=EXAMPLE_DEPLOYMENT_WEBHOOK_RESPONSE,
                content_type="application/json",
                HTTP_X_ZEIT_SIGNATURE=signature,
            )

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

        with override_options({"vercel.client-secret": secret}):
            response = self.client.post(
                path=webhook_url,
                data=EXAMPLE_DEPLOYMENT_WEBHOOK_RESPONSE,
                content_type="application/json",
                HTTP_X_ZEIT_SIGNATURE=signature,
            )

            assert len(responses.calls) == 2
            assert response.status_code == 400
            assert "Error setting refs" in response.data["detail"]

    @responses.activate
    def test_manual_vercel_deploy(self):
        local_signature = hmac.new(
            key="vercel-client-secret".encode("utf-8"),
            msg=DEPLOYMENT_WEBHOOK_NO_COMMITS.encode("utf-8"),
            digestmod=hashlib.sha1,
        ).hexdigest()

        response = self.client.post(
            path=webhook_url,
            data=DEPLOYMENT_WEBHOOK_NO_COMMITS,
            content_type="application/json",
            HTTP_X_ZEIT_SIGNATURE=local_signature,
        )

        assert response.status_code == 404
        assert "No commit found" == response.data["detail"]
        assert len(responses.calls) == 0
