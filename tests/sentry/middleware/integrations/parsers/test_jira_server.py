from unittest import mock
from unittest.mock import MagicMock

import responses
from django.http import HttpResponse
from django.test import RequestFactory, override_settings
from django.urls import reverse

from sentry.middleware.integrations.integration_control import IntegrationControlMiddleware
from sentry.middleware.integrations.parsers.jira_server import JiraServerRequestParser
from sentry.models.outbox import WebhookProviderIdentifier
from sentry.services.hybrid_cloud.organization_mapping.service import organization_mapping_service
from sentry.silo.base import SiloMode
from sentry.testutils import TestCase
from sentry.testutils.outbox import assert_webhook_outboxes
from sentry.testutils.region import override_regions
from sentry.testutils.silo import control_silo_test
from sentry.types.region import Region, RegionCategory
from sentry.utils import json


@control_silo_test()
class JiraServerRequestParserTest(TestCase):
    get_response = MagicMock(return_value=HttpResponse(content=b"no-error", status=200))
    middleware = IntegrationControlMiddleware(get_response)
    factory = RequestFactory()
    region = Region("na", 1, "https://na.testserver", RegionCategory.MULTI_TENANT)
    region_config = (region,)

    def setUp(self):
        super().setUp()
        self.path = reverse(
            "sentry-extensions-bitbucket-webhook", kwargs={"organization_id": self.organization.id}
        )
        self.integration = self.create_integration(
            organization=self.organization, external_id="jira_server:1", provider="jira_server"
        )
        organization_mapping_service

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_routing_endpoint(self):
        route = reverse("sentry-extensions-jiraserver-issue-updated", kwargs={"token": "TOKEN"})
        request = self.factory.post(route)
        parser = JiraServerRequestParser(request=request, response_handler=self.get_response)

        # Couldn't find an integration
        with mock.patch.object(
            parser, "get_response_from_control_silo"
        ) as get_response_from_control_silo, mock.patch(
            "sentry.middleware.integrations.parsers.jira_server.get_integration_from_token"
        ) as mock_get_integration:
            mock_get_integration.side_effect = ValueError("nope!")
            assert not get_response_from_control_silo.called
            parser.get_response()
            assert get_response_from_control_silo.called

        # Found the integration

        organization_mapping_service.update(
            organization_id=self.organization.id, update={"region_name": "na"}
        )
        with mock.patch(  # type: ignore[unreachable]
            "sentry.middleware.integrations.parsers.jira_server.get_integration_from_token"
        ) as mock_get_integration, override_regions(self.region_config):
            mock_get_integration.return_value = self.integration
            parser.get_response()
            assert_webhook_outboxes(
                factory_request=request,
                webhook_identifier=WebhookProviderIdentifier.JIRA_SERVER,
                region_names=[self.region.name],
            )

    @responses.activate
    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_routing_webhook(self):
        route = reverse(
            "sentry-extensions-jiraserver-search",
            kwargs={
                "organization_slug": self.organization.slug,
                "integration_id": self.integration.id,
            },
        )
        request = self.factory.get(route)
        parser = JiraServerRequestParser(request=request, response_handler=self.get_response)

        # Missing region
        organization_mapping_service.update(
            organization_id=self.organization.id, update={"region_name": "eu"}
        )
        with mock.patch.object(
            parser, "get_response_from_control_silo"
        ) as get_response_from_control_silo:
            parser.get_response()
            assert get_response_from_control_silo.called

        # Valid region
        proxy_response = responses.add(
            responses.GET, f"{self.region.address}{route}", json={"some": "data"}
        )
        organization_mapping_service.update(
            organization_id=self.organization.id, update={"region_name": "na"}
        )
        with override_regions(self.region_config):
            response = parser.get_response()
            assert json.loads(proxy_response.body) == json.loads(response.content)  # type: ignore
