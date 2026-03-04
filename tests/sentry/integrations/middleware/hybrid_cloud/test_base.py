from collections.abc import Iterable
from unittest.mock import MagicMock, patch

import pytest
from django.http import HttpResponse
from django.test import RequestFactory, override_settings
from pytest import raises
from rest_framework import status

from sentry.constants import ObjectStatus
from sentry.hybridcloud.models.webhookpayload import DestinationType, WebhookPayload
from sentry.hybridcloud.outbox.category import WebhookProviderIdentifier
from sentry.integrations.middleware.hybrid_cloud.parser import BaseRequestParser
from sentry.integrations.middleware.metrics import MiddlewareHaltReason
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.silo.base import SiloLimit, SiloMode
from sentry.testutils.asserts import assert_failure_metric, assert_halt_metric
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.types.region import Region, RegionCategory


def error_regions(region: Region, invalid_region_names: Iterable[str]) -> HttpResponse:
    if region.name in invalid_region_names:
        raise SiloLimit.AvailabilityError("Region is offline!")
    return HttpResponse(region.name, status=200)


class ExampleRequestParser(BaseRequestParser):
    provider = "test_provider"
    webhook_identifier = WebhookProviderIdentifier.SLACK


class BaseRequestParserTest(TestCase):
    response_handler = MagicMock()
    region_config = [
        Region("us", 1, "https://us.testserver", RegionCategory.MULTI_TENANT),
        Region("eu", 2, "https://eu.testserver", RegionCategory.MULTI_TENANT),
    ]
    factory = RequestFactory()

    def setUp(self) -> None:
        self.request = self.factory.get("/extensions/slack/webhook/")
        self.parser = ExampleRequestParser(self.request, self.response_handler)

    @override_settings(SILO_MODE=SiloMode.MONOLITH)
    def test_fails_in_monolith_mode(self) -> None:
        with raises(SiloLimit.AvailabilityError):
            self.parser.get_response_from_control_silo()
        with raises(SiloLimit.AvailabilityError):
            self.parser.get_responses_from_region_silos(regions=self.region_config)

    @override_settings(SILO_MODE=SiloMode.REGION)
    def test_fails_in_region_mode(self) -> None:
        with raises(SiloLimit.AvailabilityError):
            self.parser.get_response_from_control_silo()
        with raises(SiloLimit.AvailabilityError):
            self.parser.get_responses_from_region_silos(regions=self.region_config)

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_get_response_from_control_silo(self) -> None:
        self.response_handler.reset_mock()
        response = self.parser.get_response_from_control_silo()
        assert self.response_handler.called
        assert response == self.response_handler(self.request)

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @patch.object(BaseRequestParser, "get_response_from_region_silo")
    def test_get_responses_from_region_silos(self, mock__get_response: MagicMock) -> None:
        mock__get_response.side_effect = lambda region: HttpResponse(region.name, status=200)

        response_map = self.parser.get_responses_from_region_silos(regions=self.region_config)
        assert mock__get_response.call_count == len(self.region_config)

        for region in self.region_config:
            response = response_map[region.name].response
            assert isinstance(response, HttpResponse)
            assert response.content == region.name.encode()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @patch.object(BaseRequestParser, "get_response_from_region_silo")
    def test_get_responses_from_region_silos_with_partial_failure(
        self, mock__get_response: MagicMock
    ) -> None:
        mock__get_response.side_effect = lambda region: error_regions(region, ["eu"])

        response_map = self.parser.get_responses_from_region_silos(regions=self.region_config)
        assert mock__get_response.call_count == len(self.region_config)
        us_response = response_map["us"].response
        assert isinstance(us_response, HttpResponse)
        assert us_response.content == b"us"
        assert type(response_map["eu"].error) is SiloLimit.AvailabilityError

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @patch.object(BaseRequestParser, "get_response_from_region_silo")
    def test_get_responses_from_region_silos_with_complete_failure(
        self, mock__get_response: MagicMock
    ) -> None:
        mock__get_response.side_effect = lambda region: error_regions(region, ["us", "eu"])

        self.response_handler.reset_mock()
        response_map = self.parser.get_responses_from_region_silos(regions=self.region_config)
        assert mock__get_response.call_count == len(self.region_config)

        for region in self.region_config:
            assert type(response_map[region.name].error) is SiloLimit.AvailabilityError

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_get_response_from_webhookpayload_creation(self) -> None:
        with pytest.raises(AttributeError):
            BaseRequestParser(self.request, self.response_handler).get_response_from_webhookpayload(
                regions=self.region_config
            )

        class MockParser(BaseRequestParser):
            webhook_identifier = WebhookProviderIdentifier.SLACK
            provider = "slack"

        parser = MockParser(self.request, self.response_handler)

        response = parser.get_response_from_webhookpayload(regions=self.region_config)
        assert response.status_code == status.HTTP_202_ACCEPTED
        payloads = WebhookPayload.objects.all()
        assert len(payloads) == 2
        for payload in payloads:
            assert payload.region_name in ["us", "eu"]
            assert payload.mailbox_name == "slack:0"
            assert payload.request_path
            assert payload.request_method
            assert payload.destination_type == DestinationType.SENTRY_REGION

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_options({"codecov.forward-webhooks.rollout": 1.0})
    def test_forward_to_codecov(self) -> None:
        class MockParser(BaseRequestParser):
            webhook_identifier = WebhookProviderIdentifier.GITHUB
            provider = "github"

        parser = MockParser(self.request, self.response_handler)

        parser.forward_to_codecov(external_id="1")
        payloads = WebhookPayload.objects.all()
        assert len(payloads) == 1
        for payload in payloads:
            assert payload.region_name is None
            assert payload.mailbox_name == "github:codecov:1"
            assert payload.request_path
            assert payload.request_method
            assert payload.destination_type == DestinationType.CODECOV

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_get_organizations_from_integration_success(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="test_provider",
            external_id="test_external_id",
        )
        # Create additional org integration to test multiple orgs
        other_org = self.create_organization()
        OrganizationIntegration.objects.create(
            organization_id=other_org.id,
            integration_id=integration.id,
            status=ObjectStatus.ACTIVE,
        )

        parser = ExampleRequestParser(self.request, self.response_handler)
        organizations = parser.get_organizations_from_integration(integration)

        assert len(organizations) == 2
        org_ids = {org.id for org in organizations}
        assert self.organization.id in org_ids
        assert other_org.id in org_ids

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @patch("sentry.integrations.middleware.hybrid_cloud.parser.logger.info")
    def test_get_organizations_from_integration_inactive_org(self, mock_log: MagicMock) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="test_provider",
            external_id="test_external_id",
        )

        other_org = self.create_organization()
        OrganizationIntegration.objects.create(
            organization_id=other_org.id,
            integration_id=integration.id,
            status=ObjectStatus.DISABLED,
        )

        parser = ExampleRequestParser(self.request, self.response_handler)
        organizations = parser.get_organizations_from_integration(integration)
        assert len(organizations) == 1
        assert organizations[0].id == self.organization.id

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_get_organizations_from_integration_missing_integration(
        self, mock_record: MagicMock
    ) -> None:
        parser = ExampleRequestParser(self.request, self.response_handler)
        with pytest.raises(Integration.DoesNotExist):
            parser.get_organizations_from_integration()

        assert mock_record.call_count == 2
        assert_failure_metric(mock_record, Integration.DoesNotExist())

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_get_organizations_from_integration_missing_org_integration(
        self, mock_record: MagicMock
    ) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="test_provider",
            external_id="test_external_id",
            oi_params={"status": ObjectStatus.DISABLED},
        )
        parser = ExampleRequestParser(self.request, self.response_handler)
        organizations = parser.get_organizations_from_integration(integration)
        assert len(organizations) == 0

        assert mock_record.call_count == 2
        assert_halt_metric(mock_record, MiddlewareHaltReason.ORG_INTEGRATION_DOES_NOT_EXIST)
