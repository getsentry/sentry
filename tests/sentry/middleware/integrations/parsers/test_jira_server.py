from unittest import mock
from unittest.mock import MagicMock

import responses
from django.http import HttpResponse
from django.test import RequestFactory, override_settings
from django.urls import reverse

from sentry.middleware.integrations.parsers.jira_server import JiraServerRequestParser
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.outbox import WebhookProviderIdentifier
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import assert_webhook_outboxes
from sentry.testutils.region import override_regions
from sentry.testutils.silo import control_silo_test
from sentry.types.region import Region, RegionCategory


@control_silo_test
class JiraServerRequestParserTest(TestCase):
    get_response = MagicMock(return_value=HttpResponse(content=b"no-error", status=200))
    factory = RequestFactory()
    region = Region("us", 1, "https://us.testserver", RegionCategory.MULTI_TENANT)
    region_config = (region,)

    def setUp(self):
        super().setUp()
        self.path = reverse(
            "sentry-extensions-bitbucket-webhook", kwargs={"organization_id": self.organization.id}
        )
        self.integration = self.create_integration(
            organization=self.organization, external_id="jira_server:1", provider="jira_server"
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_routing_endpoint_no_integration(self):
        route = reverse("sentry-extensions-jiraserver-issue-updated", kwargs={"token": "TOKEN"})
        request = self.factory.post(route)
        parser = JiraServerRequestParser(request=request, response_handler=self.get_response)

        with mock.patch.object(
            parser, "get_response_from_control_silo"
        ) as get_response_from_control_silo, mock.patch(
            "sentry.middleware.integrations.parsers.jira_server.get_integration_from_token"
        ) as mock_get_integration:
            mock_get_integration.side_effect = ValueError("nope!")
            assert not get_response_from_control_silo.called
            parser.get_response()
            assert get_response_from_control_silo.called

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_routing_endpoint_with_integration(self):
        route = reverse("sentry-extensions-jiraserver-issue-updated", kwargs={"token": "TOKEN"})
        request = self.factory.post(route)
        parser = JiraServerRequestParser(request=request, response_handler=self.get_response)

        OrganizationMapping.objects.get(organization_id=self.organization.id).update(
            region_name="us"
        )
        with mock.patch(
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
    def test_routing_search_endpoint(self):
        route = reverse(
            "sentry-extensions-jiraserver-search",
            kwargs={
                "organization_slug": self.organization.slug,
                "integration_id": self.integration.id,
            },
        )
        request = self.factory.get(route)
        parser = JiraServerRequestParser(request=request, response_handler=self.get_response)

        with mock.patch.object(
            parser, "get_response_from_outbox_creation"
        ) as get_response_from_outbox_creation, mock.patch.object(
            parser, "get_response_from_control_silo"
        ) as get_response_from_control_silo:
            parser.get_response()
            assert get_response_from_control_silo.called
            assert not get_response_from_outbox_creation.called
