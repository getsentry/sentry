from unittest.mock import MagicMock

from django.http import HttpResponse
from django.test import RequestFactory, override_settings

from sentry.middleware.integrations.integration_control import IntegrationControlMiddleware
from sentry.middleware.integrations.parsers.github import GithubRequestParser
from sentry.silo.base import SiloMode
from sentry.testutils import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.types.region import Region, RegionCategory


@control_silo_test(stable=True)
class GithubRequestParserTest(TestCase):
    get_response = MagicMock(return_value=HttpResponse(content=b"no-error", status=200))
    middleware = IntegrationControlMiddleware(get_response)
    factory = RequestFactory()
    path = f"{IntegrationControlMiddleware.webhook_prefix}github/webhook/"
    region = Region("na", 1, "https://na.testserver", RegionCategory.MULTI_TENANT)

    def setUp(self):
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization, external_id="github:1", provider="github"
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_invalid_webhook(self):
        request = self.factory.post(
            self.path, data=b"invalid-data", content_type="application/x-www-form-urlencoded"
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()
        assert response.content == b"no-error"

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_routing_properly(self):
        request = self.factory.post(self.path, data={}, content_type="application/json")
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        parser.get_response_from_control_silo = MagicMock()
        parser.get_response_from_outbox_creation = MagicMock()

        # No regions identified
        parser.get_regions_from_organizations = MagicMock(return_value=[])
        parser.get_response()
        assert parser.get_response_from_control_silo.called

        # Regions found
        parser.get_regions_from_organizations = MagicMock(return_value=[self.region])
        parser.get_response()
        assert parser.get_response_from_outbox_creation.called

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_get_integration_from_request(self):
        request = self.factory.post(
            self.path, data={"installation": {"id": "github:1"}}, content_type="application/json"
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        integration = parser.get_integration_from_request()
        assert integration == self.integration
