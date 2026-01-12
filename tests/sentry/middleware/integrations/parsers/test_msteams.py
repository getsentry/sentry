from copy import deepcopy
from typing import Any

import responses
from django.http import HttpRequest, HttpResponse
from django.test import RequestFactory
from django.urls import reverse
from rest_framework import status

from sentry.integrations.msteams.utils import ACTION_TYPE
from sentry.middleware.integrations.classifications import IntegrationClassification
from sentry.middleware.integrations.parsers.msteams import MsTeamsRequestParser
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import assert_no_webhook_payloads, assert_webhook_payloads_for_mailbox
from sentry.testutils.silo import control_silo_test, create_test_regions
from tests.sentry.integrations.msteams.test_helpers import (
    EXAMPLE_MENTIONED,
    EXAMPLE_PERSONAL_MEMBER_ADDED,
    EXAMPLE_TEAM_MEMBER_ADDED,
    EXAMPLE_TEAM_MEMBER_REMOVED,
    EXAMPLE_UNLINK_COMMAND,
    GENERIC_EVENT,
    TOKEN,
)


@control_silo_test(regions=create_test_regions("us"))
class MsTeamsRequestParserTest(TestCase):
    factory = RequestFactory()
    path = f"{IntegrationClassification.integration_prefix}msteams/webhook/"

    def setUp(self) -> None:
        super().setUp()
        team_id = "19:8d46058cda57449380517cc374727f2a@thread.tacv2"
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
        self.integration = self.create_integration(
            organization=self.organization, external_id=team_id, provider="msteams"
        )

    def get_response(self, request: HttpRequest) -> HttpResponse:
        return HttpResponse(status=200, content="passthrough")

    def generate_card_response(self, integration_id: int) -> dict[str, Any]:
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

    @responses.activate
    def test_routing_events(self) -> None:
        # No regions identified
        request = self.factory.post(
            self.path,
            data=GENERIC_EVENT,
            HTTP_AUTHORIZATION=f"Bearer {TOKEN}",
            content_type="application/json",
        )
        parser = MsTeamsRequestParser(request=request, response_handler=self.get_response)

        response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_200_OK
        assert response.content == b"passthrough"
        assert len(responses.calls) == 0
        assert_no_webhook_payloads()

        # Regions found
        request = self.factory.post(
            self.path,
            data=self.generate_card_response(self.integration.id),
            HTTP_AUTHORIZATION=f"Bearer {TOKEN}",
            content_type="application/json",
        )
        parser = MsTeamsRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert len(responses.calls) == 0
        assert_webhook_payloads_for_mailbox(
            request=request,
            mailbox_name=f"msteams:{self.integration.id}",
            region_names=["us"],
        )

    def test_routing_events_no_org_integration(self) -> None:
        integration = self.create_provider_integration(
            provider="msteams",
            external_id="blah",
        )
        request = self.factory.post(
            self.path,
            data=self.generate_card_response(integration.id),
            HTTP_AUTHORIZATION=f"Bearer {TOKEN}",
            content_type="application/json",
        )
        parser = MsTeamsRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert len(responses.calls) == 0
        assert_no_webhook_payloads()

    @responses.activate
    def test_routing_control_paths(self) -> None:
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
            response = parser.get_response()
            assert isinstance(response, HttpResponse)
            assert response.status_code == status.HTTP_200_OK
            assert response.content == b"passthrough"
            assert len(responses.calls) == 0
            assert_no_webhook_payloads()

    def test_get_integration_from_request(self) -> None:
        CARD_ACTION_RESPONSE = self.generate_card_response(self.integration.id)

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
            assert integration == self.integration

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

    def test_handle_control_silo_payloads(self) -> None:
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
            response = parser.get_response()
            assert isinstance(response, HttpResponse)
            assert response.status_code == status.HTTP_200_OK
            assert response.content == b"passthrough"
            assert len(responses.calls) == 0
            assert_no_webhook_payloads()

    def test_request_data_with_empty_body(self) -> None:
        """Test that request_data property handles empty request bodies gracefully."""
        # Create a GET request with an empty body
        request = self.factory.get(reverse("sentry-integration-msteams-configure"))
        parser = MsTeamsRequestParser(request=request, response_handler=self.get_response)

        # Accessing request_data should not raise an error for empty body
        request_data = parser.request_data
        assert request_data == {}

    def test_request_data_with_valid_json(self) -> None:
        """Test that request_data property correctly parses valid JSON."""
        request = self.factory.post(
            self.path,
            data={"key": "value"},
            content_type="application/json",
        )
        parser = MsTeamsRequestParser(request=request, response_handler=self.get_response)

        request_data = parser.request_data
        assert request_data == {"key": "value"}

    def test_request_data_with_invalid_json(self) -> None:
        """Test that request_data property handles invalid JSON gracefully."""
        # Create a request with invalid JSON
        request = self.factory.post(
            self.path,
            data="invalid json",
            content_type="application/json",
        )
        parser = MsTeamsRequestParser(request=request, response_handler=self.get_response)

        # Should return empty dict and not raise an error
        request_data = parser.request_data
        assert request_data == {}

