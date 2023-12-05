from unittest import mock
from unittest.mock import MagicMock

from django.http import HttpResponse
from django.test import RequestFactory, override_settings
from django.urls import reverse

from sentry.middleware.integrations.parsers.bitbucket_server import BitbucketServerRequestParser
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.outbox import WebhookProviderIdentifier
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import assert_webhook_outboxes, outbox_runner
from sentry.testutils.region import override_regions
from sentry.testutils.silo import control_silo_test
from sentry.types.region import Region, RegionCategory


@control_silo_test
class BitbucketServerRequestParserTest(TestCase):
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
            organization=self.organization,
            external_id="bitbucketserver:1",
            provider="bitbucket_server",
        )

    @override_regions(region_config)
    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_routing_webhook(self):
        region_route = reverse(
            "sentry-extensions-bitbucketserver-webhook",
            kwargs={"organization_id": self.organization.id, "integration_id": self.integration.id},
        )
        with outbox_runner():
            request = self.factory.post(region_route)
        parser = BitbucketServerRequestParser(request=request, response_handler=self.get_response)

        # Missing region
        OrganizationMapping.objects.get(organization_id=self.organization.id).update(
            region_name="eu"
        )
        with mock.patch.object(
            parser, "get_response_from_control_silo"
        ) as get_response_from_control_silo:
            parser.get_response()
            assert get_response_from_control_silo.called

        # Valid region
        OrganizationMapping.objects.get(organization_id=self.organization.id).update(
            region_name="us"
        )
        parser.get_response()
        assert_webhook_outboxes(
            factory_request=request,
            webhook_identifier=WebhookProviderIdentifier.BITBUCKET_SERVER,
            region_names=[self.region.name],
        )
