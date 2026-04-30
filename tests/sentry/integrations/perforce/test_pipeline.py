from unittest.mock import patch

import responses
from django.urls import reverse

from sentry.integrations.perforce.integration import PerforceInstallationApiStep
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.organizations.services.organization.serial import serialize_rpc_organization
from sentry.shared_integrations.exceptions import ApiError, ApiUnauthorized
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test


@control_silo_test
class PerforceApiPipelineTest(APITestCase):
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
            provider_key="perforce",
        )
        pipeline.initialize()
        self.save_session()
        return pipeline

    @responses.activate
    @patch(
        "sentry.integrations.perforce.integration.PerforceClient.get_depots",
        return_value=[{"name": "depot"}],
    )
    def test_successful_connection(self, mock_get_depots) -> None:
        pipeline = self._init_pipeline_in_session()
        pipeline.set_api_mode()
        url = self._get_pipeline_url()

        resp = self.client.get(url)
        assert resp.status_code == 200
        assert resp.data["step"] == "installation_config"
        assert resp.data["data"] == {}

        resp = self.client.post(
            url,
            data={
                "p4port": "ssl:perforce.example.com:1666",
                "user": "sentry-bot",
                "authType": "password",
                "password": "secret",
            },
            format="json",
        )
        assert resp.status_code == 200
        assert resp.data["status"] == "complete"

    @responses.activate
    @patch(
        "sentry.integrations.perforce.integration.PerforceClient.get_depots",
        side_effect=ApiUnauthorized("bad credentials"),
    )
    def test_auth_failure_returns_error(self, mock_get_depots) -> None:
        pipeline = self._init_pipeline_in_session()
        pipeline.set_api_mode()
        url = self._get_pipeline_url()

        resp = self.client.post(
            url,
            data={
                "p4port": "ssl:perforce.example.com:1666",
                "user": "bad-user",
                "authType": "password",
                "password": "wrong",
            },
            format="json",
        )
        assert resp.status_code == 400
        assert "Authentication failed" in resp.data["data"]["detail"]

    @responses.activate
    @patch(
        "sentry.integrations.perforce.integration.PerforceClient.get_depots",
        side_effect=ApiError("connection refused"),
    )
    def test_connection_failure_returns_error(self, mock_get_depots) -> None:
        pipeline = self._init_pipeline_in_session()
        pipeline.set_api_mode()
        url = self._get_pipeline_url()

        resp = self.client.post(
            url,
            data={
                "p4port": "ssl:bad-host:1666",
                "user": "user",
                "authType": "password",
                "password": "pass",
            },
            format="json",
        )
        assert resp.status_code == 400
        assert "Failed to connect" in resp.data["data"]["detail"]

    @responses.activate
    def test_missing_required_fields(self) -> None:
        pipeline = self._init_pipeline_in_session()
        pipeline.set_api_mode()
        url = self._get_pipeline_url()

        resp = self.client.post(url, data={}, format="json")
        assert resp.status_code == 400

    @responses.activate
    def test_step_data_is_empty(self) -> None:
        step = PerforceInstallationApiStep()
        data = step.get_step_data(None, None)  # type: ignore[arg-type]
        assert data == {}
