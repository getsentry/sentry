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
from sentry.integrations.middleware.hybrid_cloud.parser import (
    SHED_INBOUND_KILLSWITCH,
    BaseRequestParser,
)
from sentry.integrations.middleware.metrics import MiddlewareHaltReason
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.silo.base import SiloLimit, SiloMode
from sentry.testutils.asserts import assert_failure_metric, assert_halt_metric
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.types.cell import Cell


def error_regions(region: Cell, invalid_region_names: Iterable[str]) -> HttpResponse:
    if region.name in invalid_region_names:
        raise SiloLimit.AvailabilityError("Region is offline!")
    return HttpResponse(region.name, status=200)


class ExampleRequestParser(BaseRequestParser):
    provider = "test_provider"
    webhook_identifier = WebhookProviderIdentifier.SLACK


class BaseRequestParserTest(TestCase):
    response_handler = MagicMock()
    region_config = [
        Cell("us", 1, "https://us.testserver"),
        Cell("eu", 2, "https://eu.testserver"),
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
            self.parser.get_responses_from_cell_silos(cells=self.region_config)

    @override_settings(SILO_MODE=SiloMode.CELL)
    def test_fails_in_region_mode(self) -> None:
        with raises(SiloLimit.AvailabilityError):
            self.parser.get_response_from_control_silo()
        with raises(SiloLimit.AvailabilityError):
            self.parser.get_responses_from_cell_silos(cells=self.region_config)

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_get_response_from_control_silo(self) -> None:
        self.response_handler.reset_mock()
        response = self.parser.get_response_from_control_silo()
        assert self.response_handler.called
        assert response == self.response_handler(self.request)

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @patch.object(BaseRequestParser, "get_response_from_cell_silo")
    def test_get_responses_from_cell_silos(self, mock__get_response: MagicMock) -> None:
        mock__get_response.side_effect = lambda region: HttpResponse(region.name, status=200)

        response_map = self.parser.get_responses_from_cell_silos(cells=self.region_config)
        assert mock__get_response.call_count == len(self.region_config)

        for region in self.region_config:
            response = response_map[region.name].response
            assert isinstance(response, HttpResponse)
            assert response.content == region.name.encode()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @patch.object(BaseRequestParser, "get_response_from_cell_silo")
    def test_get_responses_from_cell_silos_with_partial_failure(
        self, mock__get_response: MagicMock
    ) -> None:
        mock__get_response.side_effect = lambda region: error_regions(region, ["eu"])

        response_map = self.parser.get_responses_from_cell_silos(cells=self.region_config)
        assert mock__get_response.call_count == len(self.region_config)
        us_response = response_map["us"].response
        assert isinstance(us_response, HttpResponse)
        assert us_response.content == b"us"
        assert type(response_map["eu"].error) is SiloLimit.AvailabilityError

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @patch.object(BaseRequestParser, "get_response_from_cell_silo")
    def test_get_responses_from_cell_silos_with_complete_failure(
        self, mock__get_response: MagicMock
    ) -> None:
        mock__get_response.side_effect = lambda region: error_regions(region, ["us", "eu"])

        self.response_handler.reset_mock()
        response_map = self.parser.get_responses_from_cell_silos(cells=self.region_config)
        assert mock__get_response.call_count == len(self.region_config)

        for region in self.region_config:
            assert type(response_map[region.name].error) is SiloLimit.AvailabilityError

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_get_response_from_webhookpayload_creation(self) -> None:
        with pytest.raises(AttributeError):
            BaseRequestParser(self.request, self.response_handler).get_response_from_webhookpayload(
                cells=self.region_config
            )

        class MockParser(BaseRequestParser):
            webhook_identifier = WebhookProviderIdentifier.SLACK
            provider = "slack"

        parser = MockParser(self.request, self.response_handler)

        response = parser.get_response_from_webhookpayload(cells=self.region_config)
        assert response.status_code == status.HTTP_202_ACCEPTED
        payloads = WebhookPayload.objects.all()
        assert len(payloads) == 2
        for payload in payloads:
            assert payload.cell_name in ["us", "eu"]
            assert payload.mailbox_name == f"slack:{payload.cell_name}:0"
            assert payload.request_path
            assert payload.request_method
            assert payload.destination_type == DestinationType.SENTRY_CELL

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @patch("sentry.integrations.middleware.hybrid_cloud.parser.maybe_trigger_drain")
    def test_get_response_from_webhookpayload_triggers_drain_per_mailbox(
        self, mock_trigger: MagicMock
    ) -> None:
        class MockParser(BaseRequestParser):
            webhook_identifier = WebhookProviderIdentifier.SLACK
            provider = "slack"

        parser = MockParser(self.request, self.response_handler)

        response = parser.get_response_from_webhookpayload(cells=self.region_config)
        assert response.status_code == status.HTTP_202_ACCEPTED
        # One mailbox and one drain trigger per cell.
        payloads = WebhookPayload.objects.all()
        assert {(payload.cell_name, payload.mailbox_name) for payload in payloads} == {
            ("us", "slack:us:0"),
            ("eu", "slack:eu:0"),
        }
        assert {call[0][0] for call in mock_trigger.call_args_list} == {
            "slack:us:0",
            "slack:eu:0",
        }

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @patch("sentry.integrations.middleware.hybrid_cloud.parser.maybe_trigger_drain")
    @override_options(
        {
            SHED_INBOUND_KILLSWITCH: [
                {"provider": "other_provider", "integration_id": None},
                {"provider": "test_provider", "integration_id": "98765"},
            ]
        }
    )
    def test_shed_inbound_ignores_unmatched_targets(self, mock_trigger: MagicMock) -> None:
        parser = ExampleRequestParser(self.request, self.response_handler)

        response = parser.get_response_from_webhookpayload(
            cells=self.region_config, integration_id=12345
        )

        assert response.status_code == status.HTTP_202_ACCEPTED
        assert WebhookPayload.objects.count() == 2
        assert mock_trigger.call_count == 2

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @patch("sentry.integrations.middleware.hybrid_cloud.parser.maybe_trigger_drain")
    @patch("sentry.integrations.middleware.hybrid_cloud.parser.metrics.incr")
    @override_options({SHED_INBOUND_KILLSWITCH: [{"provider": "test_provider"}]})
    def test_shed_inbound_by_provider(self, mock_incr: MagicMock, mock_trigger: MagicMock) -> None:
        parser = ExampleRequestParser(self.request, self.response_handler)

        response = parser.get_response_from_webhookpayload(
            cells=self.region_config, integration_id=12345
        )

        assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS
        assert response["Retry-After"] == "60"
        assert not WebhookPayload.objects.exists()
        assert not mock_trigger.called
        mock_incr.assert_any_call(
            "hybridcloud.webhookpayload.shed",
            tags={"provider": "test_provider"},
            sample_rate=1.0,
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @patch("sentry.integrations.middleware.hybrid_cloud.parser.maybe_trigger_drain")
    @override_options({SHED_INBOUND_KILLSWITCH: [{"provider": "test_provider"}]})
    def test_shed_inbound_by_provider_without_integration_id(self, mock_trigger: MagicMock) -> None:
        parser = ExampleRequestParser(self.request, self.response_handler)

        response = parser.get_response_from_webhookpayload(cells=self.region_config)

        assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS
        assert not WebhookPayload.objects.exists()
        assert not mock_trigger.called

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @patch("sentry.integrations.middleware.hybrid_cloud.parser.maybe_trigger_drain")
    @override_options(
        {SHED_INBOUND_KILLSWITCH: [{"provider": "test_provider", "integration_id": "12345"}]}
    )
    def test_shed_inbound_by_integration(self, mock_trigger: MagicMock) -> None:
        parser = ExampleRequestParser(self.request, self.response_handler)

        shed_response = parser.get_response_from_webhookpayload(
            cells=self.region_config, integration_id=12345
        )

        assert shed_response.status_code == status.HTTP_429_TOO_MANY_REQUESTS
        assert not WebhookPayload.objects.exists()
        assert not mock_trigger.called

        # A sibling integration on the same provider is untouched.
        passed_response = parser.get_response_from_webhookpayload(
            cells=self.region_config, integration_id=54321
        )

        assert passed_response.status_code == status.HTTP_202_ACCEPTED
        assert WebhookPayload.objects.count() == 2
        assert mock_trigger.call_count == 2

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_options({SHED_INBOUND_KILLSWITCH: [{"unknown_field": "test_provider"}]})
    def test_shed_inbound_ignores_unknown_condition_fields(self) -> None:
        parser = ExampleRequestParser(self.request, self.response_handler)

        response = parser.get_response_from_webhookpayload(
            cells=self.region_config, integration_id=12345
        )

        assert response.status_code == status.HTTP_202_ACCEPTED
        assert WebhookPayload.objects.count() == 2

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @patch("sentry.integrations.middleware.hybrid_cloud.parser.metrics.incr")
    @override_options({SHED_INBOUND_KILLSWITCH: [{}, {"integration_id": "12345"}]})
    def test_shed_inbound_ignores_conditions_without_a_provider(self, mock_incr: MagicMock) -> None:
        """A provider-less condition is an every-provider wildcard, which is more reach
        than this valve should have. It is dropped, and counted so it is not silent."""
        parser = ExampleRequestParser(self.request, self.response_handler)

        response = parser.get_response_from_webhookpayload(
            cells=self.region_config, integration_id=12345
        )

        assert response.status_code == status.HTTP_202_ACCEPTED
        assert WebhookPayload.objects.count() == 2
        mock_incr.assert_any_call("hybridcloud.webhookpayload.shed_condition_ignored")

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
