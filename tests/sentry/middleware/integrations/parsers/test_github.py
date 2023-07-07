from typing import Any
from unittest import mock
from unittest.mock import MagicMock

from django.http import HttpResponse
from django.test import RequestFactory, override_settings
from django.urls import reverse

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
    path = reverse("sentry-integration-github-webhook")
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
        assert response.status_code == 200
        assert response.content == b"no-error"

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_routing_properly(self):
        request = self.factory.post(self.path, data={}, content_type="application/json")
        parser = GithubRequestParser(request=request, response_handler=self.get_response)

        # No regions identified
        with mock.patch.object(
            parser, "get_response_from_control_silo"
        ) as get_response_from_control_silo, mock.patch.object(
            parser, "get_regions_from_organizations", return_value=[]
        ):
            parser.get_response()
            assert get_response_from_control_silo.called

        # Regions found
        with mock.patch.object(
            parser, "get_response_from_outbox_creation"
        ) as get_response_from_outbox_creation, mock.patch.object(
            parser, "get_regions_from_organizations", return_value=[self.region]
        ):
            parser.get_response()
            assert get_response_from_outbox_creation.called

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_get_integration_from_request(self):
        request = self.factory.post(
            self.path, data={"installation": {"id": "github:1"}}, content_type="application/json"
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        integration = parser.get_integration_from_request()
        assert integration == self.integration
