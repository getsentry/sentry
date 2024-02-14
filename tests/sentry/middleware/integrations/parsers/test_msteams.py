from copy import deepcopy

import responses
from django.http import HttpRequest, HttpResponse
from django.test import RequestFactory
from django.urls import reverse

from sentry.integrations.msteams.utils import ACTION_TYPE
from sentry.middleware.integrations.classifications import IntegrationClassification
from sentry.middleware.integrations.parsers.msteams import MsTeamsRequestParser
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.outbox import (
    assert_no_webhook_outboxes,
    assert_no_webhook_payloads,
    assert_webhook_outboxes_with_shard_id,
    assert_webhook_payloads_for_mailbox,
)
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

    def setUp(self):
        super().setUp()
        team_id = "19:8d46058cda57449380517cc374727f2a@thread.tacv2"
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
        self.integration = self.create_integration(
            organization=self.organization, external_id=team_id, provider="msteams"
        )

    def get_response(self, request: HttpRequest) -> HttpResponse:
        return HttpResponse(status=200, content="passthrough")

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

    @responses.activate
    def test_routing_events(self):
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
        assert response.status_code == 200
        assert response.content == b"passthrough"
        assert len(responses.calls) == 0
        assert_no_webhook_outboxes()

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
        assert response.status_code == 202
        assert len(responses.calls) == 0
        assert_webhook_outboxes_with_shard_id(
            factory_request=request,
            expected_shard_id=self.integration.id,
            region_names=["us"],
        )

    @override_options({"hybridcloud.webhookpayload.rollout": 1.0})
    @responses.activate
    def test_routing_webhook_payloads(self):
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
        assert response.status_code == 200
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
        assert response.status_code == 202
        assert len(responses.calls) == 0
        assert_webhook_payloads_for_mailbox(
            request=request,
            mailbox_name=f"msteams:{self.integration.id}",
            region_names=["us"],
        )

    @responses.activate
    def test_routing_control_paths(self):
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
            assert response.status_code == 200
            assert response.content == b"passthrough"
            assert len(responses.calls) == 0
            assert_no_webhook_outboxes()

    def test_get_integration_from_request(self):
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
            response = parser.get_response()
            assert isinstance(response, HttpResponse)
            assert response.status_code == 200
            assert response.content == b"passthrough"
            assert len(responses.calls) == 0
            assert_no_webhook_outboxes()
