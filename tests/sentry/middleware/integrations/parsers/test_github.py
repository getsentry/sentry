from unittest import mock
from unittest.mock import MagicMock

from django.http import HttpResponse
from django.test import RequestFactory
from django.urls import reverse

from sentry.middleware.integrations.parsers.github import GithubRequestParser
from sentry.models.outbox import ControlOutbox, OutboxCategory, WebhookProviderIdentifier
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import assert_webhook_outboxes
from sentry.testutils.silo import control_silo_test
from sentry.types.region import Region, RegionCategory


@control_silo_test
class GithubRequestParserTest(TestCase):
    get_response = MagicMock(return_value=HttpResponse(content=b"no-error", status=200))
    factory = RequestFactory()
    path = reverse("sentry-integration-github-webhook")
    region = Region("us", 1, "https://us.testserver", RegionCategory.MULTI_TENANT)

    def setUp(self):
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization, external_id="github:1", provider="github"
        )

    def test_invalid_webhook(self):
        if SiloMode.get_current_mode() != SiloMode.CONTROL:
            return

        request = self.factory.post(
            self.path, data=b"invalid-data", content_type="application/x-www-form-urlencoded"
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()
        assert response.status_code == 400

    def test_routing_webhook_properly(self):
        request = self.factory.post(self.path, data={}, content_type="application/json")
        parser = GithubRequestParser(request=request, response_handler=self.get_response)

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

    def test_routing_search_properly(self):
        path = reverse(
            "sentry-integration-github-search",
            kwargs={
                "organization_slug": self.organization.slug,
                "integration_id": self.integration.id,
            },
        )
        request = self.factory.post(path, data={}, content_type="application/json")
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        with mock.patch.object(
            parser, "get_response_from_outbox_creation"
        ) as get_response_from_outbox_creation, mock.patch.object(
            parser, "get_response_from_control_silo"
        ) as get_response_from_control_silo:
            parser.get_response()
            assert get_response_from_control_silo.called
            assert not get_response_from_outbox_creation.called

    def test_get_integration_from_request(self):
        request = self.factory.post(
            self.path, data={"installation": {"id": "github:1"}}, content_type="application/json"
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        integration = parser.get_integration_from_request()
        assert integration == self.integration

    def test_webhook_outbox_creation(self):
        request = self.factory.post(
            self.path, data={"installation": {"id": "github:1"}}, content_type="application/json"
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)

        assert ControlOutbox.objects.filter(category=OutboxCategory.WEBHOOK_PROXY).count() == 0
        with mock.patch.object(
            parser, "get_regions_from_organizations", return_value=[self.region]
        ):
            parser.get_response()
            assert_webhook_outboxes(
                factory_request=request,
                webhook_identifier=WebhookProviderIdentifier.GITHUB,
                region_names=[self.region.name],
            )

    def test_installation_created_routing(self):
        request = self.factory.post(
            reverse("sentry-integration-github-webhook"),
            data={"installation": {"id": "github:1"}, "action": "created"},
            content_type="application/json",
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        with mock.patch.object(
            parser, "get_response_from_outbox_creation"
        ) as get_response_from_outbox_creation, mock.patch.object(
            parser, "get_response_from_control_silo"
        ) as get_response_from_control_silo:
            parser.get_response()
            assert get_response_from_control_silo.called
            assert not get_response_from_outbox_creation.called

    def test_installation_deleted_routing(self):
        request = self.factory.post(
            reverse("sentry-integration-github-webhook"),
            data={"installation": {"id": "github:1"}, "action": "deleted"},
            content_type="application/json",
        )
        parser = GithubRequestParser(request=request, response_handler=self.get_response)
        with mock.patch.object(
            parser, "get_response_from_outbox_creation"
        ) as get_response_from_outbox_creation, mock.patch.object(
            parser, "get_response_from_control_silo"
        ) as get_response_from_control_silo:
            parser.get_response()
            assert get_response_from_control_silo.called
            assert not get_response_from_outbox_creation.called
