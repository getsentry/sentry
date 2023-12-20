from unittest import mock
from unittest.mock import MagicMock

from django.http import HttpResponse
from django.test import RequestFactory, override_settings
from django.urls import reverse

from sentry.middleware.integrations.parsers.github_enterprise import GithubEnterpriseRequestParser
from sentry.models.outbox import ControlOutbox, OutboxCategory, WebhookProviderIdentifier
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import assert_webhook_outboxes
from sentry.testutils.silo import control_silo_test
from sentry.types.region import Region, RegionCategory


@control_silo_test
class GithubEnterpriseRequestParserTest(TestCase):
    get_response = MagicMock(return_value=HttpResponse(content=b"no-error", status=200))
    factory = RequestFactory()
    path = reverse("sentry-integration-github-enterprise-webhook")
    region = Region("us", 1, "https://us.testserver", RegionCategory.MULTI_TENANT)
    external_host = "12.345.678.901"
    external_identifier = "github_enterprise:1"
    external_id = f"{external_host}:{external_identifier}"

    def setUp(self):
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            external_id=self.external_id,
            provider="github_enterprise",
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_invalid_webhook(self):
        request = self.factory.post(
            self.path, data=b"invalid-data", content_type="application/x-www-form-urlencoded"
        )
        parser = GithubEnterpriseRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()
        assert response.status_code == 400

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_routing_properly(self):
        request = self.factory.post(self.path, data={}, content_type="application/json")
        parser = GithubEnterpriseRequestParser(request=request, response_handler=self.get_response)

        # No regions identified
        with mock.patch.object(
            parser, "get_response_from_outbox_creation"
        ) as get_response_from_outbox_creation, mock.patch.object(
            parser, "get_response_from_control_silo"
        ) as get_response_from_control_silo, mock.patch.object(
            parser, "get_regions_from_organizations", return_value=[]
        ):
            parser.get_response()
            assert get_response_from_control_silo.called
            assert not get_response_from_outbox_creation.called

        # Regions found
        with mock.patch.object(
            parser, "get_response_from_outbox_creation"
        ) as get_response_from_outbox_creation, mock.patch.object(
            parser, "get_regions_from_organizations", return_value=[self.region]
        ):
            parser.get_response()
            assert get_response_from_outbox_creation.called

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_get_integration_from_request(self):
        # No host header
        request = self.factory.post(
            self.path,
            data={"installation": {"id": self.external_identifier}},
            content_type="application/json",
        )
        parser = GithubEnterpriseRequestParser(request=request, response_handler=self.get_response)
        integration = parser.get_integration_from_request()
        assert integration is None

        # With host header
        request = self.factory.post(
            self.path,
            data={"installation": {"id": self.external_identifier}},
            content_type="application/json",
            HTTP_X_GITHUB_ENTERPRISE_HOST=self.external_host,
        )
        parser = GithubEnterpriseRequestParser(request=request, response_handler=self.get_response)
        integration = parser.get_integration_from_request()
        assert integration == self.integration

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_webhook_outbox_creation(self):
        request = self.factory.post(
            self.path,
            data={"installation": {"id": self.external_identifier}},
            content_type="application/json",
        )
        parser = GithubEnterpriseRequestParser(request=request, response_handler=self.get_response)

        assert ControlOutbox.objects.filter(category=OutboxCategory.WEBHOOK_PROXY).count() == 0
        with mock.patch.object(
            parser, "get_regions_from_organizations", return_value=[self.region]
        ):
            parser.get_response()
            assert_webhook_outboxes(
                factory_request=request,
                webhook_identifier=WebhookProviderIdentifier.GITHUB_ENTERPRISE,
                region_names=[self.region.name],
            )
