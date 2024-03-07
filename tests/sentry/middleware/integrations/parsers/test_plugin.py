import responses
from django.http import HttpRequest, HttpResponse
from django.test import RequestFactory
from django.urls import reverse

from sentry.hybridcloud.models.webhookpayload import WebhookPayload
from sentry.middleware.integrations.parsers.plugin import PluginRequestParser
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.outbox import ControlOutbox
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.outbox import (
    assert_no_webhook_outboxes,
    assert_webhook_outboxes_with_shard_id,
    assert_webhook_payloads_for_mailbox,
)
from sentry.testutils.silo import control_silo_test, create_test_regions


@control_silo_test(regions=create_test_regions("us"))
class PluginRequestParserTest(TestCase):
    factory = RequestFactory()

    def get_response(self, request: HttpRequest) -> HttpResponse:
        return HttpResponse(status=200, content="passthrough")

    @responses.activate
    def test_routing_webhooks_no_region(self):
        routes = [
            reverse("sentry-plugins-github-webhook", args=[self.organization.id]),
            reverse("sentry-plugins-bitbucket-webhook", args=[self.organization.id]),
        ]
        # No mapping
        OrganizationMapping.objects.get(organization_id=self.organization.id).update(
            region_name="eu"
        )
        for route in routes:
            request = self.factory.post(route)
            parser = PluginRequestParser(request=request, response_handler=self.get_response)

            response = parser.get_response()
            assert isinstance(response, HttpResponse)
            assert response.status_code == 200
            assert response.content == b"passthrough"
            assert len(responses.calls) == 0
            assert_no_webhook_outboxes()

    def test_routing_webhooks_with_region(self):
        routes = [
            reverse("sentry-plugins-github-webhook", args=[self.organization.id]),
            reverse("sentry-plugins-bitbucket-webhook", args=[self.organization.id]),
        ]
        OrganizationMapping.objects.get(organization_id=self.organization.id).update(
            region_name="us"
        )
        for route in routes:
            request = self.factory.post(route)
            parser = PluginRequestParser(request=request, response_handler=self.get_response)
            parser.get_response()
            assert_webhook_outboxes_with_shard_id(
                factory_request=request,
                expected_shard_id=self.organization.id,
                region_names=["us"],
            )
            # Purge outboxes after checking each route
            ControlOutbox.objects.all().delete()

    @override_options({"hybridcloud.webhookpayload.rollout": 1.0})
    def test_routing_webhooks_with_region_webhookpayload(self):
        routes = [
            reverse("sentry-plugins-github-webhook", args=[self.organization.id]),
            reverse("sentry-plugins-bitbucket-webhook", args=[self.organization.id]),
        ]
        OrganizationMapping.objects.get(organization_id=self.organization.id).update(
            region_name="us"
        )
        for route in routes:
            request = self.factory.post(route)
            parser = PluginRequestParser(request=request, response_handler=self.get_response)
            parser.get_response()
            assert_webhook_payloads_for_mailbox(
                request=request,
                mailbox_name=f"plugins:{self.organization.id}",
                region_names=["us"],
            )
            # Purge outboxes after checking each route
            WebhookPayload.objects.all().delete()

    def test_routing_for_missing_organization(self):
        # Delete the mapping to simulate an org being deleted.
        OrganizationMapping.objects.filter(organization_id=self.organization.id).delete()
        routes = {
            reverse("sentry-plugins-github-webhook", args=[self.organization.id]): True,
            reverse("sentry-plugins-bitbucket-webhook", args=[self.organization.id]): True,
        }
        for route in routes:
            request = self.factory.post(route)
            parser = PluginRequestParser(request=request, response_handler=self.get_response)
            response = parser.get_response()
            assert response.status_code == 400

    def test_invalid_webhooks(self):
        routes = {
            reverse("sentry-plugins-github-webhook", args=[self.organization.id]): True,
            reverse("sentry-plugins-bitbucket-webhook", args=[self.organization.id]): True,
            reverse("sentry-plugins-github-installation-webhook"): False,
            "/api/0/organizations": False,
        }
        for route, should_operate in routes.items():
            request = self.factory.post(route)
            parser = PluginRequestParser(request=request, response_handler=self.get_response)
            assert parser.should_operate() == should_operate
