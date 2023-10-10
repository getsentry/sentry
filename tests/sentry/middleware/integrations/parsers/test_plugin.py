from unittest import mock
from unittest.mock import MagicMock

from django.test import RequestFactory, override_settings
from django.urls import reverse

from sentry.middleware.integrations.parsers.plugin import PluginRequestParser
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.outbox import ControlOutbox, WebhookProviderIdentifier
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import assert_webhook_outboxes
from sentry.testutils.region import override_regions
from sentry.testutils.silo import control_silo_test
from sentry.types.region import Region, RegionCategory


@control_silo_test(stable=True)
class PluginRequestParserTest(TestCase):
    get_response = MagicMock()
    factory = RequestFactory()
    region = Region("us", 1, "https://us.testserver", RegionCategory.MULTI_TENANT)

    @override_regions(regions=(region,))
    @override_settings(SILO_MODE=SiloMode.CONTROL)
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
            with mock.patch.object(
                parser, "get_response_from_control_silo"
            ) as get_response_from_control_silo:
                parser.get_response()
                assert get_response_from_control_silo.called

    @override_regions(regions=(region,))
    @override_settings(SILO_MODE=SiloMode.CONTROL)
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
            assert_webhook_outboxes(
                factory_request=request,
                webhook_identifier=WebhookProviderIdentifier.LEGACY_PLUGIN,
                region_names=[self.region.name],
            )
            # Purge outboxes after checking each route
            ControlOutbox.objects.all().delete()

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
