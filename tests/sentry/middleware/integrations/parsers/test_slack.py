from unittest.mock import MagicMock, patch

import pytest
from django.test import RequestFactory  # , override_settings

from sentry.integrations.slack.requests.command import SlackCommandRequest
from sentry.middleware.integrations.integration_control import IntegrationControlMiddleware
from sentry.middleware.integrations.parsers.base import RegionResult
from sentry.middleware.integrations.parsers.slack import SlackRequestParser

# from sentry.silo import SiloMode
from sentry.testutils import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.types.region import Region, RegionCategory
from sentry.utils.signing import sign


@control_silo_test(stable=True)
class SlackRequestParserTest(TestCase):
    get_response = MagicMock()
    middleware = IntegrationControlMiddleware(get_response)
    factory = RequestFactory()
    path_base = f"{IntegrationControlMiddleware.webhook_prefix}slack"
    region = Region("na", 1, "https://na.testserver", RegionCategory.MULTI_TENANT)

    def setUp(self):
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
        self.integration = self.create_integration(
            organization=self.organization, external_id="TXXXXXXX1", provider="slack"
        )

    def get_parser(self, path):
        self.request = self.factory.post(f"{self.path_base}{path}")
        parser = SlackRequestParser(self.request, self.get_response)
        parser.get_regions_from_organizations = MagicMock(return_value=[self.region])
        return parser

    @pytest.mark.skip(reason="Will be implemented after frontend installation is setup")
    def test_installation(self):
        pass

    @patch.object(SlackCommandRequest, "integration")
    @patch.object(SlackCommandRequest, "_validate_integration")
    @patch.object(SlackCommandRequest, "_authorize")
    def test_webhook(self, mock_authorize, mock_validate_integration, mock_integration):
        # Retrieve the correct integration
        parser = self.get_parser("/commands/")
        integration = parser.get_integration_from_request()
        assert mock_authorize.called
        assert mock_validate_integration.called
        assert integration == mock_integration

        # Returns response from region
        region_response = RegionResult(response="mock_response")
        with patch.object(
            parser,
            "get_responses_from_region_silos",
            return_value={self.region.name: region_response},
        ) as mock_response_from_region:
            response = parser.get_response()
            assert mock_response_from_region.called
            assert response == region_response.response

        # Falls back to control if region fails
        region_response = RegionResult(error="mock_error")
        with patch.object(
            parser,
            "get_responses_from_region_silos",
            return_value={self.region.name: region_response},
        ) as mock_response_from_region, patch.object(
            parser, "get_response_from_control_silo", return_value="mock_response"
        ) as mock_response_from_control:
            response = parser.get_response()
            assert mock_response_from_region.called
            assert response == mock_response_from_control()

    def test_django_view(self):
        # Retrieve the correct integration
        parser = self.get_parser(f"/link-identity/{sign(integration_id=self.integration.id)}/")
        parser_integration = parser.get_integration_from_request()
        assert parser_integration.id == self.integration.id

        # Forwards to control silo
        with patch.object(
            parser, "get_response_from_control_silo", return_value="mock_response"
        ) as mock_response_from_control:
            response = parser.get_response()
            assert mock_response_from_control.called
            assert response == mock_response_from_control()
