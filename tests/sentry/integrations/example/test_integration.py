from unittest.mock import patch

import responses
from django.urls import reverse

from sentry.integrations.example import ExampleIntegrationProvider
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.organizations.services.organization.serial import serialize_rpc_organization
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test


@control_silo_test
class ExampleIntegrationTest(APITestCase):
    endpoint = "sentry-api-0-organization-pipeline"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def _get_pipeline_url(self) -> str:
        return reverse(
            self.endpoint,
            args=[self.organization.slug, IntegrationPipeline.pipeline_name],
        )

    def _init_pipeline_in_session(self) -> IntegrationPipeline:
        with assume_test_silo_mode(SiloMode.CELL):
            rpc_org = serialize_rpc_organization(self.organization)

        request = self.make_request(self.user)
        pipeline = IntegrationPipeline(
            request=request,
            organization=rpc_org,
            provider_key=ExampleIntegrationProvider.key,
        )
        pipeline.initialize()
        self.save_session()
        return pipeline

    @responses.activate
    def test_basic_flow(self) -> None:
        pipeline = self._init_pipeline_in_session()
        pipeline.set_api_mode()
        url = self._get_pipeline_url()

        resp = self.client.get(url)
        assert resp.status_code == 200
        assert resp.data["step"] == "setup"
        assert resp.data["data"] == {}

        resp = self.client.post(url, data={"name": "test"}, format="json")
        assert resp.status_code == 200
        assert resp.data["status"] == "complete"

        integration = Integration.objects.get(provider=ExampleIntegrationProvider.key)
        assert integration.external_id == "test"
        assert integration.name == "test"
        assert integration.metadata == {}
        assert OrganizationIntegration.objects.filter(
            integration=integration, organization_id=self.organization.id
        ).exists()

    @responses.activate
    def test_name_required(self) -> None:
        pipeline = self._init_pipeline_in_session()
        pipeline.set_api_mode()
        url = self._get_pipeline_url()

        resp = self.client.post(url, data={}, format="json")
        assert resp.status_code == 400

    @responses.activate
    @patch(
        "sentry.api.endpoints.organization_pipeline.initialize_integration_pipeline",
    )
    def test_initialize_via_api(self, mock_init) -> None:
        pipeline = self._init_pipeline_in_session()
        pipeline.set_api_mode()
        mock_init.return_value = pipeline
        url = self._get_pipeline_url()

        resp = self.client.post(
            url,
            data={"action": "initialize", "provider": "example"},
            format="json",
        )
        assert resp.status_code == 200
        assert resp.data["step"] == "setup"
