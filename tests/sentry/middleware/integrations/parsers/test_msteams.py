from copy import deepcopy
from unittest import mock
from unittest.mock import MagicMock

from django.http import HttpResponse
from django.test import RequestFactory, override_settings
from django.urls import reverse

from sentry.integrations.msteams.utils import ACTION_TYPE
from sentry.middleware.integrations.classifications import IntegrationClassification
from sentry.middleware.integrations.parsers.msteams import MsTeamsRequestParser
from sentry.models.integrations.integration import Integration
from sentry.models.outbox import ControlOutbox, WebhookProviderIdentifier
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import assert_webhook_outboxes
from sentry.testutils.silo import control_silo_test
from sentry.types.region import Region, RegionCategory
from tests.sentry.integrations.msteams.test_helpers import (
    EXAMPLE_MENTIONED,
    EXAMPLE_PERSONAL_MEMBER_ADDED,
    EXAMPLE_TEAM_MEMBER_ADDED,
    EXAMPLE_TEAM_MEMBER_REMOVED,
    EXAMPLE_UNLINK_COMMAND,
    GENERIC_EVENT,
    TOKEN,
)


@control_silo_test
class MsTeamsRequestParserTest(TestCase):
    get_response = MagicMock(return_value=HttpResponse(content=b"no-error", status=200))
    factory = RequestFactory()
    path = f"{IntegrationClassification.integration_prefix}msteams/webhook/"
    region = Region("us", 1, "https://us.testserver", RegionCategory.MULTI_TENANT)

    def setUp(self):
        super().setUp()

    def generate_card_response(self, integration_id: int):
        return {
            "type": "message",
            "from": {"id": "user_id"},
            "channelData": {
                "tenant": {"id": "f5ffd8cf-a1aa-4242-adad-86509faa3be5"},
            },
            "conversation": {"conversationType": "channel", "id": "conversation_id"},
            "value": {
                "payload": {
                    "groupId": "groupId",
                    "eventId": "eventId",
                    "actionType": ACTION_TYPE.ASSIGN,
                    "rules": [],
                    "integrationId": integration_id,
                },
                "assignInput": "me",
            },
            "replyToId": "replyToId",
        }

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_routing_properly(self):
        # No regions identified
        request = self.factory.post(
            self.path,
            data=GENERIC_EVENT,
            HTTP_AUTHORIZATION=f"Bearer {TOKEN}",
            content_type="application/json",
        )
        parser = MsTeamsRequestParser(request=request, response_handler=self.get_response)

        with mock.patch.object(
            parser, "get_response_from_control_silo"
        ) as get_response_from_control_silo, mock.patch.object(
            parser, "get_regions_from_organizations", return_value=[]
        ):
            parser.get_response()
            assert get_response_from_control_silo.called

        # Regions found
        request = self.factory.post(
            self.path,
            data=self.generate_card_response(123),
            HTTP_AUTHORIZATION=f"Bearer {TOKEN}",
            content_type="application/json",
        )
        parser = MsTeamsRequestParser(request=request, response_handler=self.get_response)

        with mock.patch.object(
            parser, "get_response_from_outbox_creation"
        ) as get_response_from_outbox_creation, mock.patch.object(
            parser, "get_regions_from_organizations", return_value=[self.region]
        ):
            parser.get_response()
            assert get_response_from_outbox_creation.called

        # Non-webhook urls
        requests = [
            self.factory.get(
                reverse("sentry-integration-msteams-configure"),
            ),
            self.factory.get(
                reverse(
                    "sentry-integration-msteams-link-identity",
                    kwargs={"signed_params": "something"},
                ),
            ),
            self.factory.get(
                reverse(
                    "sentry-integration-msteams-unlink-identity",
                    kwargs={"signed_params": "something"},
                ),
            ),
        ]
        for request in requests:
            parser = MsTeamsRequestParser(request=request, response_handler=self.get_response)

            with mock.patch.object(
                parser, "get_response_from_outbox_creation"
            ) as get_response_from_outbox_creation, mock.patch.object(
                parser, "get_response_from_control_silo"
            ) as get_response_from_control_silo:
                parser.get_response()
                assert get_response_from_control_silo.called
                assert not get_response_from_outbox_creation.called

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_webhook_outbox_creation(self):
        request = self.factory.post(
            self.path,
            data=self.generate_card_response(123),
            HTTP_AUTHORIZATION=f"Bearer {TOKEN}",
            content_type="application/json",
        )
        parser = MsTeamsRequestParser(request=request, response_handler=self.get_response)

        # ControlOutbox creation
        assert ControlOutbox.objects.count() == 0
        with mock.patch.object(
            parser, "get_regions_from_organizations", return_value=[self.region]
        ):
            parser.get_response()
            assert_webhook_outboxes(
                factory_request=request,
                webhook_identifier=WebhookProviderIdentifier.MSTEAMS,
                region_names=[self.region.name],
            )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_get_integration_from_request(self):
        team_id = "19:8d46058cda57449380517cc374727f2a@thread.tacv2"
        expected_integration = Integration.objects.create(external_id=team_id, provider="msteams")

        CARD_ACTION_RESPONSE = self.generate_card_response(expected_integration.id)

        region_silo_payloads = [
            # Integration inferred from channelData.team.id
            EXAMPLE_TEAM_MEMBER_REMOVED,
            EXAMPLE_TEAM_MEMBER_ADDED,
            EXAMPLE_MENTIONED,
            # Integration inferred from adaptive card action response
            CARD_ACTION_RESPONSE,
        ]

        for payload in region_silo_payloads:
            request = self.factory.post(
                self.path,
                data=payload,
                HTTP_AUTHORIZATION=f"Bearer {TOKEN}",
                content_type="application/json",
            )
            parser = MsTeamsRequestParser(request=request, response_handler=self.get_response)
            integration = parser.get_integration_from_request()
            assert integration == expected_integration

        help_command = deepcopy(EXAMPLE_UNLINK_COMMAND)
        help_command["text"] = "Help"
        control_silo_payloads = [GENERIC_EVENT, help_command, EXAMPLE_PERSONAL_MEMBER_ADDED]
        for payload in control_silo_payloads:
            request = self.factory.post(
                self.path,
                data=payload,
                HTTP_AUTHORIZATION=f"Bearer {TOKEN}",
                content_type="application/json",
            )
            parser = MsTeamsRequestParser(request=request, response_handler=self.get_response)
            integration = parser.get_integration_from_request()
            assert integration is None

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_handle_control_silo_payloads(self):
        help_command = deepcopy(EXAMPLE_UNLINK_COMMAND)
        help_command["text"] = "Help"
        control_silo_payloads = [GENERIC_EVENT, help_command, EXAMPLE_PERSONAL_MEMBER_ADDED]

        for payload in control_silo_payloads:
            request = self.factory.post(
                self.path,
                json=payload,
                HTTP_AUTHORIZATION=f"Bearer {TOKEN}",
            )
            parser = MsTeamsRequestParser(request=request, response_handler=self.get_response)

            with mock.patch.object(
                parser, "get_response_from_control_silo"
            ) as get_response_from_control_silo:
                parser.get_response()
                assert get_response_from_control_silo.called
