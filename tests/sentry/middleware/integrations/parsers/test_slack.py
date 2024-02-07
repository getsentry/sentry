from __future__ import annotations

import dataclasses
from unittest.mock import patch
from urllib.parse import urlencode

import responses
from django.db import router, transaction
from django.http import HttpRequest, HttpResponse
from django.test import RequestFactory
from django.urls import reverse
from rest_framework import status

from sentry.integrations.slack.utils.auth import _encode_data
from sentry.middleware.integrations.parsers.slack import SlackRequestParser
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.models.outbox import ControlOutbox, outbox_context
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import assert_no_webhook_outboxes
from sentry.testutils.silo import assume_test_silo_mode_of, control_silo_test, create_test_regions
from sentry.utils import json
from sentry.utils.signing import sign


@control_silo_test(regions=create_test_regions("us"))
class SlackRequestParserTest(TestCase):
    factory = RequestFactory()
    timestamp = "123123123"

    def setUp(self):
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
        self.integration = self.create_integration(
            organization=self.organization, external_id="TXXXXXXX1", provider="slack"
        )

    def get_response(self, request: HttpRequest) -> HttpResponse:
        return HttpResponse(status=200, content="passthrough")

    @responses.activate
    def test_webhook(self):
        # Retrieve the correct integration
        data = urlencode({"team_id": self.integration.external_id}).encode("utf-8")
        signature = _encode_data(secret="slack-signing-secret", data=data, timestamp=self.timestamp)
        request = self.factory.post(
            path=reverse("sentry-integration-slack-commands"),
            data=data,
            content_type="application/x-www-form-urlencoded",
            HTTP_X_SLACK_SIGNATURE=signature,
            HTTP_X_SLACK_REQUEST_TIMESTAMP=self.timestamp,
        )
        parser = SlackRequestParser(request, self.get_response)
        integration = parser.get_integration_from_request()
        assert integration == self.integration

        # Returns response from region
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/slack/commands/",
            status=201,
            body=b"region_response",
        )
        response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == 201
        assert response.content == b"region_response"
        assert len(responses.calls) == 1
        assert_no_webhook_outboxes()

        # ...even if it returns an error
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/slack/commands/",
            status=401,
            body=b"error_response",
        )
        response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == 401
        assert response.content == b"error_response"
        assert len(responses.calls) == 2
        assert_no_webhook_outboxes()

    @responses.activate
    def test_django_view(self):
        # Retrieve the correct integration
        path = reverse(
            "sentry-integration-slack-link-identity",
            kwargs={"signed_params": sign(integration_id=self.integration.id)},
        )
        request = self.factory.post(path)
        parser = SlackRequestParser(request, self.get_response)
        parser_integration = parser.get_integration_from_request()
        if not parser_integration:
            raise ValueError("Parser could not identify an integration")
        assert parser_integration.id == self.integration.id

        # Passes through to control silo
        response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == 200
        assert response.content == b"passthrough"
        assert len(responses.calls) == 0
        assert_no_webhook_outboxes()

    @patch(
        "sentry.integrations.slack.requests.base.SlackRequest._check_signing_secret",
        return_value=True,
    )
    @patch("sentry.middleware.integrations.parsers.slack.convert_to_async_slack_response")
    def test_triggers_async_response(self, mock_slack_task, mock_signing_secret):
        response_url = "https://hooks.slack.com/commands/TXXXXXXX1/1234567890123/something"
        data = {
            "payload": json.dumps(
                {"team_id": self.integration.external_id, "response_url": response_url}
            )
        }
        request = self.factory.post(reverse("sentry-integration-slack-action"), data=data)
        parser = SlackRequestParser(request, self.get_response)
        response = parser.get_response()
        webhook_payload = ControlOutbox.get_webhook_payload_from_request(request=request)
        payload = dataclasses.asdict(webhook_payload)
        mock_slack_task.apply_async.assert_called_once_with(
            kwargs={
                "region_names": ["us"],
                "payload": payload,
                "response_url": response_url,
            }
        )
        assert response.status_code == status.HTTP_202_ACCEPTED

    @patch("sentry.middleware.integrations.parsers.slack.convert_to_async_slack_response")
    @patch.object(
        SlackRequestParser,
        "get_regions_from_organizations",
        side_effect=OrganizationIntegration.DoesNotExist(),
    )
    def test_skips_async_response_if_org_integration_missing(
        self, mock_slack_task, mock_get_regions
    ):
        response_url = "https://hooks.slack.com/commands/TXXXXXXX1/1234567890123/something"
        data = {
            "payload": json.dumps(
                {"team_id": self.integration.external_id, "response_url": response_url}
            )
        }
        with assume_test_silo_mode_of(OrganizationIntegration), outbox_context(
            transaction.atomic(using=router.db_for_write(OrganizationIntegration))
        ):
            OrganizationIntegration.objects.filter(organization_id=self.organization.id).delete()
        request = self.factory.post(reverse("sentry-integration-slack-action"), data=data)
        parser = SlackRequestParser(request, self.get_response)
        response = parser.get_response()
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert mock_slack_task.apply_async.call_count == 0
