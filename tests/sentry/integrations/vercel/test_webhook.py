from __future__ import absolute_import

import responses

from sentry.testutils import APITestCase
from sentry.testutils.helpers import override_options
from sentry.utils.http import absolute_uri

from sentry.models import (
    Integration,
    OrganizationIntegration,
    SentryAppInstallationForProvider,
    SentryAppInstallation,
)

from .testutils import EXAMPLE_DEPLOYMENT_WEBHOOK_RESPONSE

signature = "74b587857986545361e8a4253b74cd6224d34869"
secret = "AiK52QASLJXmCXX3X9gO2Zyh"


class VercelWebhookTest(APITestCase):
    def setUp(self):
        self.url = "/extensions/vercel/webhook/"

    def test_get(self):
        response = self.client.get(self.url)
        assert response.status_code == 405

    def test_valid_signature(self):
        with override_options({"vercel.client-secret": secret}):
            response = self.client.post(
                path=self.url,
                data=EXAMPLE_DEPLOYMENT_WEBHOOK_RESPONSE,
                content_type="application/json",
                HTTP_X_ZEIT_SIGNATURE=signature,
            )

            assert response.status_code == 202

    def test_invalid_signature(self):
        with override_options({"vercel.client-secret": secret}):
            response = self.client.post(
                path=self.url,
                data=EXAMPLE_DEPLOYMENT_WEBHOOK_RESPONSE,
                content_type="application/json",
                HTTP_X_ZEIT_SIGNATURE="xxxinvalidsignaturexxx",
            )

            assert response.status_code == 401

    @responses.activate
    def test_create_release(self):
        self.project = self.create_project(organization=self.organization)
        self.integration = Integration.objects.create(
            provider="vercel",
            external_id="cstd1xKmLGVMed0z0f3SHlD2",
            metadata={"access_token": "my_token"},
        )

        OrganizationIntegration.objects.create(
            organization=self.organization,
            integration=self.integration,
            config={
                "project_mappings": [
                    [self.project.id, "QmQPfU4xn5APjEsSje4ccPcSJCmVAByA8CDKfZRhYyVPAg"]
                ]
            },
        )

        sentry_app = self.create_internal_integration(
            webhook_url=None, name="Vercel Internal Integration", organization=self.organization,
        )
        sentry_app_installation = SentryAppInstallation.objects.get(sentry_app=sentry_app)
        SentryAppInstallationForProvider.objects.create(
            organization=self.organization,
            provider="vercel",
            sentry_app_installation=sentry_app_installation,
        )

        responses.add(
            responses.POST,
            absolute_uri("/api/0/organizations/%s/releases/" % self.organization.slug),
            json={},
        )

        with override_options({"vercel.client-secret": secret}):
            response = self.client.post(
                path=self.url,
                data=EXAMPLE_DEPLOYMENT_WEBHOOK_RESPONSE,
                content_type="application/json",
                HTTP_X_ZEIT_SIGNATURE=signature,
            )

            assert response.status_code == 201
