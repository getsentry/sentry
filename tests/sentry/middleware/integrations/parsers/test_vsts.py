from copy import deepcopy

import responses
from django.http import HttpRequest, HttpResponse
from django.test import RequestFactory, override_settings
from django.urls import reverse

from fixtures.vsts import WORK_ITEM_UNASSIGNED, WORK_ITEM_UPDATED, WORK_ITEM_UPDATED_STATUS
from sentry.middleware.integrations.classifications import IntegrationClassification
from sentry.middleware.integrations.parsers.vsts import VstsRequestParser
from sentry.models.outbox import WebhookProviderIdentifier
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import assert_no_webhook_outboxes, assert_webhook_outboxes
from sentry.testutils.region import override_regions
from sentry.testutils.silo import control_silo_test
from sentry.types.region import Region, RegionCategory

region = Region("us", 1, "https://us.testserver", RegionCategory.MULTI_TENANT)
region_config = (region,)


@control_silo_test
class VstsRequestParserTest(TestCase):
    factory = RequestFactory()
    shared_secret = "1234567890"
    path = f"{IntegrationClassification.integration_prefix}vsts/issue-updated/"

    @override_regions(region_config)
    def setUp(self):
        super().setUp()
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
        account_id = WORK_ITEM_UPDATED["resourceContainers"]["collection"]["id"]
        self.integration = self.create_integration(
            organization=self.organization,
            external_id=account_id,
            provider="vsts",
            name="vsts_name",
            metadata={
                "domain_name": "https://instance.visualstudio.com/",
                "subscription": {"id": 1234, "secret": self.shared_secret},
            },
        )

    def get_response(self, request: HttpRequest) -> HttpResponse:
        return HttpResponse(status=200, content="passthrough")

    @responses.activate
    @override_regions(region_config)
    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_routing_work_item_webhook(self):
        # No integration found for request...
        data = deepcopy(WORK_ITEM_UPDATED)
        data["resourceContainers"]["collection"]["id"] = "non-existant"
        request = self.factory.post(
            self.path,
            data=data,
            content_type="application/json",
            HTTP_SHARED_SECRET=self.shared_secret,
        )
        parser = VstsRequestParser(request=request, response_handler=self.get_response)

        response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == 200
        assert response.content == b"passthrough"
        assert len(responses.calls) == 0
        assert_no_webhook_outboxes()

        # Regions found
        request = self.factory.post(
            self.path,
            data=WORK_ITEM_UPDATED,
            content_type="application/json",
            HTTP_SHARED_SECRET=self.shared_secret,
        )
        parser = VstsRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == 202
        assert_webhook_outboxes(
            factory_request=request,
            webhook_identifier=WebhookProviderIdentifier.VSTS,
            region_names=[region.name],
        )

    @responses.activate
    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_routing_control_paths(self):
        config_request = self.factory.get(
            reverse("vsts-extension-configuration"),
            data={"targetId": "1", "targetName": "foo"},
        )
        parser = VstsRequestParser(request=config_request, response_handler=self.get_response)
        response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == 200
        assert response.content == b"passthrough"
        assert len(responses.calls) == 0
        assert_no_webhook_outboxes()

        search_request = self.factory.get(
            reverse(
                "sentry-extensions-vsts-search",
                kwargs={"organization_slug": "albertos-apples", "integration_id": 1234},
            ),
        )
        parser = VstsRequestParser(request=search_request, response_handler=self.get_response)
        response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == 200
        assert response.content == b"passthrough"
        assert len(responses.calls) == 0
        assert_no_webhook_outboxes()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_get_integration_from_request(self):
        region_silo_payloads = [WORK_ITEM_UNASSIGNED, WORK_ITEM_UPDATED, WORK_ITEM_UPDATED_STATUS]

        for payload in region_silo_payloads:
            request = self.factory.post(
                self.path,
                HTTP_SHARED_SECRET=self.shared_secret,
                data=payload,
                content_type="application/json",
            )
            parser = VstsRequestParser(request=request, response_handler=self.get_response)
            integration = parser.get_integration_from_request()
            assert integration == self.integration

        # Invalid payload or content-type
        request = self.factory.post(
            self.path,
            HTTP_SHARED_SECRET=self.shared_secret,
            data=payload,
            content_type="multipart/form-data",
        )
        parser = VstsRequestParser(request=request, response_handler=self.get_response)
        integration = parser.get_integration_from_request()
        assert integration is None

    @override_regions(region_config)
    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_webhook_outbox_creation(self):
        request = self.factory.post(
            self.path,
            data=WORK_ITEM_UPDATED,
            content_type="application/json",
            HTTP_SHARED_SECRET=self.shared_secret,
        )
        parser = VstsRequestParser(request=request, response_handler=self.get_response)

        assert_no_webhook_outboxes()
        parser.get_response()
        assert_webhook_outboxes(
            factory_request=request,
            webhook_identifier=WebhookProviderIdentifier.VSTS,
            region_names=[region.name],
        )
