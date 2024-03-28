from django.http import HttpRequest, HttpResponse
from django.test import RequestFactory, override_settings
from django.urls import reverse

from sentry.middleware.integrations.parsers.bitbucket import BitbucketRequestParser
from sentry.models.integrations.integration import Integration
from sentry.models.organizationmapping import OrganizationMapping
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import assert_no_webhook_payloads, assert_webhook_payloads_for_mailbox
from sentry.testutils.region import override_regions
from sentry.testutils.silo import control_silo_test
from sentry.types.region import Region, RegionCategory

region = Region("us", 1, "http://us.testserver", RegionCategory.MULTI_TENANT)
region_config = (region,)


@control_silo_test
class BitbucketRequestParserTest(TestCase):
    def get_response(self, req: HttpRequest) -> HttpResponse:
        return HttpResponse(status=200, content="passthrough")

    factory = RequestFactory()
    region = Region("us", 1, "https://us.testserver", RegionCategory.MULTI_TENANT)
    region_config = (region,)

    def get_integration(self) -> Integration:
        return self.create_integration(
            organization=self.organization, external_id="bitbucket:1", provider="bitbucket"
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_regions(region_config)
    def test_routing_endpoints(self):
        self.get_integration()
        control_routes = [
            reverse("sentry-extensions-bitbucket-descriptor"),
            reverse("sentry-extensions-bitbucket-installed"),
            reverse("sentry-extensions-bitbucket-uninstalled"),
            reverse(
                "sentry-extensions-bitbucket-search",
                kwargs={
                    "organization_slug": self.organization.slug,
                    "integration_id": self.integration.id,
                },
            ),
        ]
        for route in control_routes:
            request = self.factory.post(route)
            parser = BitbucketRequestParser(request=request, response_handler=self.get_response)
            response = parser.get_response()

            assert isinstance(response, HttpResponse)
            assert response.status_code == 200
            assert response.content == b"passthrough"
            assert_no_webhook_payloads()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_regions(region_config)
    def test_routing_webhook_no_regions(self):
        region_route = reverse(
            "sentry-extensions-bitbucket-webhook", kwargs={"organization_id": self.organization.id}
        )
        request = self.factory.post(region_route)
        parser = BitbucketRequestParser(request=request, response_handler=self.get_response)

        # Missing region
        OrganizationMapping.objects.get(organization_id=self.organization.id).update(
            region_name="eu"
        )
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == 200
        assert response.content == b"passthrough"
        assert_no_webhook_payloads()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_regions(region_config)
    def test_routing_webhook_with_regions(self):
        self.get_integration()
        region_route = reverse(
            "sentry-extensions-bitbucket-webhook", kwargs={"organization_id": self.organization.id}
        )
        request = self.factory.post(region_route)
        parser = BitbucketRequestParser(request=request, response_handler=self.get_response)

        response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == 202
        assert response.content == b""
        assert_webhook_payloads_for_mailbox(
            request=request,
            mailbox_name=f"bitbucket:{self.organization.id}",
            region_names=[self.region.name],
        )
