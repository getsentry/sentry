from copy import deepcopy

import responses
from django.http import HttpRequest, HttpResponse
from django.test import RequestFactory
from django.urls import reverse

from fixtures.vsts import WORK_ITEM_UNASSIGNED, WORK_ITEM_UPDATED, WORK_ITEM_UPDATED_STATUS
from sentry.middleware.integrations.classifications import IntegrationClassification
from sentry.middleware.integrations.parsers.vsts import VstsRequestParser
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.outbox import (
    assert_no_webhook_outboxes,
    assert_no_webhook_payloads,
    assert_webhook_outboxes_with_shard_id,
    assert_webhook_payloads_for_mailbox,
)
from sentry.testutils.silo import control_silo_test, create_test_regions


@control_silo_test(regions=create_test_regions("us"))
class VstsRequestParserTest(TestCase):
    factory = RequestFactory()
    shared_secret = "1234567890"
    path = f"{IntegrationClassification.integration_prefix}vsts/issue-updated/"

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
        assert response.status_code == 400
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
        assert_webhook_outboxes_with_shard_id(
            factory_request=request,
            expected_shard_id=self.integration.id,
            region_names=["us"],
        )

    @override_options({"hybridcloud.webhookpayload.rollout": 1.0})
    @responses.activate
    def test_routing_work_item_webhookpayload(self):
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
        assert response.status_code == 400
        assert len(responses.calls) == 0
        assert_no_webhook_payloads()

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
        assert_webhook_payloads_for_mailbox(
            request=request,
            mailbox_name=f"vsts:{self.integration.id}",
            region_names=["us"],
        )

    @responses.activate
    def test_routing_control_paths(self):
        config_request = self.factory.get(
            reverse("vsts-extension-configuration"),
            data={"targetId": "1", "targetName": "foo"},
        )
        parser = VstsRequestParser(request=config_request, response_handler=self.get_response)
        response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == 200
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
        assert len(responses.calls) == 0
        assert_no_webhook_outboxes()

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
        assert_webhook_outboxes_with_shard_id(
            factory_request=request,
            expected_shard_id=self.integration.id,
            region_names=["us"],
        )
