from typing import Any
from unittest.mock import MagicMock, patch

from django.test import RequestFactory, override_settings

from sentry.middleware.integrations.integration_control import IntegrationControlMiddleware
from sentry.middleware.integrations.parsers.jira import JiraRequestParser
from sentry.models.outbox import (
    ControlOutbox,
    OutboxCategory,
    OutboxScope,
    WebhookProviderIdentifier,
)
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.types.region import Region, RegionCategory


@control_silo_test(stable=True)
class JiraRequestParserTest(TestCase):
    get_response = MagicMock()
    middleware = IntegrationControlMiddleware(get_response)
    factory = RequestFactory()
    path_base = f"{IntegrationControlMiddleware.integration_prefix}jira"
    region = Region("na", 1, "https://na.testserver", RegionCategory.MULTI_TENANT)

    def setUp(self):
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization, external_id="jira:1", provider="jira"
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_get_integration_from_request(self):
        request = self.factory.post(path=f"{self.path_base}/issue-updated/")
        parser = JiraRequestParser(request, self.get_response)
        assert parser.get_integration_from_request() is None

        with patch(
            "sentry.middleware.integrations.parsers.jira.parse_integration_from_request"
        ) as mock_parse:
            mock_parse.return_value = self.integration
            assert parser.get_integration_from_request() == self.integration

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_get_response_routing_to_control(self):
        paths = [
            "/ui-hook/",
            "/descriptor/",
            "/installed/",
            "/uninstalled/",
            "/search/org/123/",
            "/configure/",
        ]
        for path in paths:
            request = self.factory.post(path=f"{self.path_base}{path}")
            parser = JiraRequestParser(request, self.get_response)
            with patch.object(
                parser, "get_response_from_outbox_creation"
            ) as get_response_from_outbox_creation, patch.object(
                parser, "get_response_from_control_silo"
            ) as mock_from_control:
                assert not get_response_from_outbox_creation.called
                assert not mock_from_control.called
                parser.get_response()
                assert mock_from_control.called

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_get_response_routing_to_region_sync(self):
        request = self.factory.post(path=f"{self.path_base}/issue/LR-123/")
        parser = JiraRequestParser(request, self.get_response)
        with patch.object(
            parser, "get_regions_from_organizations", return_value=[self.region]
        ), patch.object(parser, "get_response_from_region_silo") as mock_from_region:
            parser.get_response()
            mock_from_region.assert_called_once_with(region=self.region)

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_get_response_routing_to_region_async(self):
        request = self.factory.post(path=f"{self.path_base}/issue-updated/")
        parser = JiraRequestParser(request, self.get_response)
        with patch.object(
            parser, "get_regions_from_organizations", return_value=[self.region]
        ), patch.object(parser, "get_response_from_outbox_creation") as mock_from_outbox:
            parser.get_response()
            mock_from_outbox.assert_called_once_with(regions=[self.region])

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_get_response_invalid(self):
        # Invalid path
        request = self.factory.post(path="/new-route/for/no/reason/")
        parser = JiraRequestParser(request, self.get_response)
        with patch.object(
            parser, "get_response_from_outbox_creation"
        ) as get_response_from_outbox_creation, patch.object(
            parser, "get_response_from_control_silo"
        ) as mock_from_control:
            parser.get_response()
            assert mock_from_control.called
            assert not get_response_from_outbox_creation.called

        # Too many regions
        request = self.factory.post(path="/issue/LR-123/")
        parser = JiraRequestParser(request, self.get_response)
        with patch.object(
            parser, "get_response_from_outbox_creation"
        ) as get_response_from_outbox_creation, patch.object(
            parser, "get_response_from_control_silo"
        ) as mock_from_control, patch.object(
            parser,
            "get_regions_from_organizations",
            return_value=[
                Region("na", 1, "https://na.testserver", RegionCategory.MULTI_TENANT),
                Region("eu", 2, "https://eu.testserver", RegionCategory.MULTI_TENANT),
            ],
        ) as mock_get_regions:
            parser.get_response()
            assert mock_from_control.called
            assert mock_get_regions.called
            assert not get_response_from_outbox_creation.called

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_webhook_outbox_creation(self):
        path = f"{self.path_base}/issue-updated/"
        request = self.factory.post(path=path)
        parser = JiraRequestParser(request, self.get_response)

        assert ControlOutbox.objects.count() == 0
        with patch.object(parser, "get_regions_from_organizations", return_value=[self.region]):
            parser.get_response()

            assert ControlOutbox.objects.count() == 1
            outbox = ControlOutbox.objects.first()
            expected_payload: Any = {
                "method": "POST",
                "path": path,
                "uri": f"http://testserver{path}",
                "headers": {
                    "Content-Length": "20",
                    "Content-Type": "multipart/form-data; boundary=BoUnDaRyStRiNg",
                    "Cookie": "",
                },
                "body": request.body.decode(encoding="utf-8"),
            }

            assert outbox.shard_scope == OutboxScope.WEBHOOK_SCOPE
            assert outbox.shard_identifier == WebhookProviderIdentifier.JIRA
            assert outbox.category == OutboxCategory.WEBHOOK_PROXY
            assert outbox.region_name == self.region.name
            assert outbox.payload == expected_payload
