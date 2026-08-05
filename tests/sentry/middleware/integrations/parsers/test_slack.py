from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch
from urllib.parse import urlencode

import orjson
import pytest
import responses
from django.core.cache import cache
from django.db import router, transaction
from django.http import HttpRequest, HttpResponse
from django.test import RequestFactory
from django.urls import reverse
from rest_framework import status

from sentry.hybridcloud.models.outbox import outbox_context
from sentry.hybridcloud.services.organization_mapping.service import organization_mapping_service
from sentry.integrations.middleware.hybrid_cloud.parser import create_async_request_payload
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.slack.message_builder.routing import encode_action_id
from sentry.integrations.slack.message_builder.types import SlackAction
from sentry.integrations.slack.utils.auth import _encode_data
from sentry.integrations.slack.views import SALT
from sentry.middleware.integrations.parsers.slack import SlackRequestParser
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.outbox import assert_no_webhook_payloads
from sentry.testutils.silo import assume_test_silo_mode_of, control_silo_test, create_test_cells
from sentry.utils import json
from sentry.utils.signing import sign


@control_silo_test(cells=create_test_cells("us"))
class SlackRequestParserTest(TestCase):
    factory = RequestFactory()
    timestamp = "123123123"

    def setUp(self) -> None:
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
        self.integration = self.create_integration(
            organization=self.organization, external_id="TXXXXXXX1", provider="slack"
        )
        org_mapping = organization_mapping_service.get(organization_id=self.organization.id)
        assert org_mapping is not None
        self.org_mapping = org_mapping
        patcher = patch(
            "sentry.integrations.slack.requests.base.SlackRequest._check_signing_secret",
            return_value=True,
        )
        patcher.start()
        self.addCleanup(patcher.stop)
        cache.clear()

    def get_response(self, request: HttpRequest) -> HttpResponse:
        return HttpResponse(status=200, content="passthrough")

    def _make_parser_with_seer_event(self, event_type: str = "app_mention", event_id: str = "E1"):
        data = {
            "type": "event_callback",
            "team_id": self.integration.external_id,
            "api_app_id": "AXXXXXXXX1",
            "event_id": event_id,
            "event": {
                "type": event_type,
                "channel": "C1234567890",
                "user": "U1234567890",
                "text": "hello",
                "ts": "1234567890.123456",
                "thread_ts": "1234567890.000001",
            },
        }
        request = self.factory.post(
            reverse("sentry-integration-slack-event"),
            data=orjson.dumps(data),
            content_type="application/json",
        )
        return SlackRequestParser(request, self.get_response)

    @responses.activate
    @patch(
        "slack_sdk.signature.SignatureVerifier.is_valid",
        return_value=True,
    )
    def test_webhook(self, mock_verify: MagicMock) -> None:
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
            status=status.HTTP_201_CREATED,
            body=b"region_response",
        )
        response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_201_CREATED
        assert response.content == b"region_response"
        assert len(responses.calls) == 1
        assert_no_webhook_payloads()

        # ...even if it returns an error
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/slack/commands/",
            status=401,
            body=b"error_response",
        )
        response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert response.content == b"error_response"
        assert len(responses.calls) == 2
        assert_no_webhook_payloads()

    @responses.activate
    def test_django_view(self) -> None:
        # Retrieve the correct integration
        path = reverse(
            "sentry-integration-slack-link-identity",
            kwargs={"signed_params": sign(salt=SALT, integration_id=self.integration.id)},
        )
        request = self.factory.post(path)
        parser = SlackRequestParser(request, self.get_response)
        parser_integration = parser.get_integration_from_request()
        if not parser_integration:
            raise AssertionError("Parser could not identify an integration")
        assert parser_integration.id == self.integration.id

        # Passes through to control silo
        response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_200_OK
        assert response.content == b"passthrough"
        assert len(responses.calls) == 0
        assert_no_webhook_payloads()

    @patch("sentry.middleware.integrations.parsers.slack.convert_to_async_slack_response")
    def test_triggers_async_response(self, mock_slack_task: MagicMock) -> None:
        response_url = "https://hooks.slack.com/commands/TXXXXXXX1/1234567890123/something"
        data = {
            "payload": json.dumps(
                {"team_id": self.integration.external_id, "response_url": response_url}
            )
        }
        request = self.factory.post(reverse("sentry-integration-slack-action"), data=data)
        parser = SlackRequestParser(request, self.get_response)
        response = parser.get_response()
        mock_slack_task.apply_async.assert_called_once_with(
            kwargs={
                "cell_names": ["us"],
                "payload": create_async_request_payload(request),
                "response_url": response_url,
            }
        )
        assert response.status_code == status.HTTP_200_OK

    @patch("sentry.middleware.integrations.parsers.slack.convert_to_async_slack_response")
    def test_skips_async_response_if_org_integration_missing(self, mock_slack_task):
        response_url = "https://hooks.slack.com/commands/TXXXXXXX1/1234567890123/something"
        data = {
            "payload": json.dumps(
                {"team_id": self.integration.external_id, "response_url": response_url}
            )
        }
        with (
            assume_test_silo_mode_of(OrganizationIntegration),
            outbox_context(transaction.atomic(using=router.db_for_write(OrganizationIntegration))),
        ):
            OrganizationIntegration.objects.filter(organization_id=self.organization.id).delete()
        request = self.factory.post(reverse("sentry-integration-slack-action"), data=data)
        parser = SlackRequestParser(request, self.get_response)
        response = parser.get_response()
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert mock_slack_task.apply_async.call_count == 0

    def test_async_request_payload(self) -> None:
        data = {
            "payload": json.dumps(
                {
                    "team_id": self.integration.external_id,
                    "response_url": "https://hooks.slack.com/commands/TXXXXX1/12345678/something",
                }
            )
        }
        request = self.factory.post(reverse("sentry-integration-slack-action"), data=data)
        result = create_async_request_payload(request)

        assert "method" in result
        assert result["method"] == request.method
        assert "path" in result
        assert result["path"] == request.get_full_path()
        assert "uri" in result
        assert result["uri"] == request.build_absolute_uri()
        assert "headers" in result
        assert isinstance(result["headers"], dict)
        assert "body" in result
        assert result["body"] == request.body.decode("utf8")

    def test_targeting_all_orgs(self) -> None:
        # Install the integration on two organizations
        other_organization = self.create_organization()
        self.integration.add_organization(other_organization)

        # Case 1: Without passing an organization, we expect to filter to both.
        for cmd in ["link team", "unlink team"]:
            data = urlencode(
                {
                    "text": cmd,
                    "team_id": self.integration.external_id,
                }
            ).encode("utf-8")
            request = self.factory.post(
                reverse("sentry-integration-slack-commands"),
                data=data,
                content_type="application/x-www-form-urlencoded",
            )
            parser = SlackRequestParser(request, self.get_response)
            parser.get_integration_from_request()
            organizations = parser.get_organizations_from_integration(self.integration)
            organization_ids = {org.id for org in organizations}
            assert len(organization_ids) == 2
            assert self.organization.id in organization_ids
            assert other_organization.id in organization_ids

    def test_targeting_specific_org(self) -> None:
        # Install the integration on two organizations
        other_organization = self.create_organization()
        self.integration.add_organization(other_organization)

        # When the organization slug is provided, filter to just that one.
        for cmd in ["link team", "unlink team"]:
            data = urlencode(
                {
                    "text": f"{cmd} {other_organization.slug}",
                    "team_id": self.integration.external_id,
                }
            ).encode("utf-8")
            request = self.factory.post(
                reverse("sentry-integration-slack-commands"),
                data=data,
                content_type="application/x-www-form-urlencoded",
            )
            parser = SlackRequestParser(request, self.get_response)
            parser.get_integration_from_request()
            organizations = parser.get_organizations_from_integration(self.integration)

            assert len(organizations) == 1
            assert organizations[0].id == other_organization.id

    def test_targeting_irrelevant_org(self) -> None:
        # Install the integration on two organizations
        other_organization = self.create_organization()
        self.integration.add_organization(other_organization)
        # And add another, maybe the user belongs to it, maybe not
        irrelevant_organization = self.create_organization()

        # Case 3: If the organization slug is irrelevant, ignore it and return all orgs
        for cmd in ["link team", "unlink team"]:
            data = urlencode(
                {
                    "text": f"{cmd} {irrelevant_organization.slug}",
                    "team_id": self.integration.external_id,
                }
            ).encode("utf-8")
            request = self.factory.post(
                reverse("sentry-integration-slack-commands"),
                data=data,
                content_type="application/x-www-form-urlencoded",
            )
            parser = SlackRequestParser(request, self.get_response)
            parser.get_integration_from_request()
            organizations = parser.get_organizations_from_integration(self.integration)
            organization_ids = {org.id for org in organizations}
            assert len(organization_ids) == 2
            assert irrelevant_organization.id not in organization_ids

    def test_targeting_issue_actions(self) -> None:
        # Install the integration on two organizations
        other_organization = self.create_organization()
        self.integration.add_organization(other_organization)

        # Case 1:With the default actions (non-encoded), we shouldn't filter the organization
        data = urlencode(
            {
                "payload": json.dumps(
                    {
                        "actions": [{"action_id": SlackAction.RESOLVE_DIALOG}],
                        "team_id": self.integration.external_id,
                    }
                ),
            }
        ).encode("utf-8")
        request = self.factory.post(
            reverse("sentry-integration-slack-action"),
            data=data,
            content_type="application/x-www-form-urlencoded",
        )
        parser = SlackRequestParser(request, self.get_response)
        parser.get_integration_from_request()
        organizations = parser.get_organizations_from_integration(self.integration)
        organization_ids = {org.id for org in organizations}
        assert len(organization_ids) == 2
        assert self.organization.id in organization_ids
        assert other_organization.id in organization_ids

        # Case 2: With the encoded action, we should filter to a single organization
        project = self.create_project(organization=other_organization)
        encoded_action = encode_action_id(
            action=SlackAction.RESOLVE_DIALOG,
            organization_id=other_organization.id,
            project_id=project.id,
        )
        data = urlencode(
            {
                "payload": json.dumps(
                    {
                        "actions": [{"action_id": encoded_action}],
                        "team_id": self.integration.external_id,
                    }
                ),
            }
        ).encode("utf-8")
        request = self.factory.post(
            reverse("sentry-integration-slack-action"),
            data=data,
            content_type="application/x-www-form-urlencoded",
        )
        parser = SlackRequestParser(request, self.get_response)
        parser.get_integration_from_request()
        organizations = parser.get_organizations_from_integration(self.integration)
        organization_ids = {org.id for org in organizations}
        assert len(organization_ids) == 1
        assert other_organization.id in organization_ids

        # Case 3: If we see an irrelevant organization, we should ignore it
        irrelevant_organization = self.create_organization()
        project = self.create_project(organization=irrelevant_organization)
        encoded_action = encode_action_id(
            action=SlackAction.RESOLVE_DIALOG,
            organization_id=irrelevant_organization.id,
            project_id=project.id,
        )
        data = urlencode(
            {
                "payload": json.dumps(
                    {
                        "actions": [{"action_id": encoded_action}],
                        "team_id": self.integration.external_id,
                    }
                ),
            }
        ).encode("utf-8")
        request = self.factory.post(
            reverse("sentry-integration-slack-action"),
            data=data,
            content_type="application/x-www-form-urlencoded",
        )
        parser = SlackRequestParser(request, self.get_response)
        parser.get_integration_from_request()
        organizations = parser.get_organizations_from_integration(self.integration)
        organization_ids = {org.id for org in organizations}
        assert len(organization_ids) == 2
        assert self.organization.id in organization_ids
        assert other_organization.id in organization_ids

    def _make_link_identity_action_data(
        self, slack_user_id: str = "U1234567890", response_url: str = ""
    ) -> dict:
        return {
            "payload": json.dumps(
                {
                    "team": {"id": self.integration.external_id},
                    "user": {"id": slack_user_id},
                    "actions": [{"action_id": "link_identity", "type": "button"}],
                    "response_url": response_url,
                    "type": "block_actions",
                }
            )
        }

    @patch("sentry.middleware.integrations.parsers.slack.convert_to_async_slack_response")
    def test_link_identity_handled_on_control_silo(self, mock_slack_task: MagicMock) -> None:
        response_url = "https://hooks.slack.com/actions/TXXXXXXX1/1234567890123/something"
        slack_user_id = "U1234567890"
        data = self._make_link_identity_action_data(
            slack_user_id=slack_user_id, response_url=response_url
        )
        request = self.factory.post(reverse("sentry-integration-slack-action"), data=data)
        parser = SlackRequestParser(request, self.get_response)
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_200_OK
        assert response.content == b"passthrough"
        mock_slack_task.apply_async.assert_not_called()

    @patch("sentry.middleware.integrations.parsers.slack.route_slack_seer_event.apply_async")
    def test_seer_event_acks_200_and_enqueues_routing_task(self, mock_apply):
        parser = self._make_parser_with_seer_event(event_type="app_mention")
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_200_OK
        mock_apply.assert_called_once()
        kwargs = mock_apply.call_args.kwargs["kwargs"]
        assert kwargs["integration_id"] == self.integration.id
        assert kwargs["slack_user_id"] == "U1234567890"
        assert kwargs["channel_id"] == "C1234567890"
        assert kwargs["thread_ts"] == "1234567890.000001"
        assert kwargs["message_ts"] == "1234567890.123456"
        assert kwargs["event_type"] == "app_mention"
        assert kwargs["message_text"] == "hello"
        assert kwargs["payload"]["method"] == "POST"
        assert kwargs["payload"]["path"].startswith("/extensions/slack/event")

    @override_options({"slack.dedupe-seer-webhook-events": True})
    @patch("sentry.middleware.integrations.parsers.slack.route_slack_seer_event.apply_async")
    def test_seer_event_dedupes_by_event_id(self, mock_apply):
        event_id = "EvDEDUP1"

        first = self._make_parser_with_seer_event(
            event_type="app_mention", event_id=event_id
        ).get_response()
        second = self._make_parser_with_seer_event(
            event_type="app_mention", event_id=event_id
        ).get_response()

        assert isinstance(first, HttpResponse)
        assert isinstance(second, HttpResponse)
        assert first.status_code == status.HTTP_200_OK
        assert second.status_code == status.HTTP_200_OK
        mock_apply.assert_called_once()

    @override_options({"slack.dedupe-seer-webhook-events": True})
    @patch("sentry.middleware.integrations.parsers.slack.route_slack_seer_event.apply_async")
    def test_seer_event_releases_claim_on_schedule_failure(self, mock_apply):
        # Claim must not stick if apply_async fails — otherwise Slack retries
        # ACK as duplicates and Seer never runs for the TTL window.
        event_id = "EvSCHEDFAIL"
        mock_apply.side_effect = RuntimeError("broker down")

        with pytest.raises(RuntimeError, match="broker down"):
            self._make_parser_with_seer_event(
                event_type="app_mention", event_id=event_id
            ).get_response()

        mock_apply.side_effect = None
        response = self._make_parser_with_seer_event(
            event_type="app_mention", event_id=event_id
        ).get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_200_OK
        assert mock_apply.call_count == 2

    @override_options({"slack.dedupe-seer-webhook-events": False})
    @patch("sentry.middleware.integrations.parsers.slack.route_slack_seer_event.apply_async")
    def test_seer_event_dedupe_disabled_schedules_duplicates(self, mock_apply):
        event_id = "EvDEDUP_OFF"

        self._make_parser_with_seer_event(
            event_type="app_mention", event_id=event_id
        ).get_response()
        self._make_parser_with_seer_event(
            event_type="app_mention", event_id=event_id
        ).get_response()

        assert mock_apply.call_count == 2

    @override_options({"slack.dedupe-seer-webhook-events": True})
    @patch("sentry.middleware.integrations.parsers.slack.route_slack_seer_event.apply_async")
    def test_seer_event_different_event_ids_are_not_deduped(self, mock_apply):
        self._make_parser_with_seer_event(event_type="app_mention", event_id="EvA").get_response()
        self._make_parser_with_seer_event(event_type="app_mention", event_id="EvB").get_response()

        assert mock_apply.call_count == 2

    @override_options({"slack.dedupe-seer-webhook-events": True})
    @patch("sentry.middleware.integrations.parsers.slack.logger")
    @patch("sentry.middleware.integrations.parsers.slack.route_slack_seer_event.apply_async")
    def test_seer_event_missing_event_id_logs_and_schedules(
        self, mock_apply: MagicMock, mock_logger: MagicMock
    ) -> None:
        self._make_parser_with_seer_event(event_type="app_mention", event_id="").get_response()

        mock_apply.assert_called_once()
        mock_logger.info.assert_any_call(
            "slack.control.seer_event.missing_event_id",
            extra={
                "integration_id": self.integration.id,
                "event_type": "app_mention",
                "event_id": "",
            },
        )

    @responses.activate
    @patch("sentry.middleware.integrations.parsers.slack.route_slack_seer_event.apply_async")
    def test_non_seer_event_not_routed_through_task(self, mock_apply):
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/slack/event/",
            status=status.HTTP_200_OK,
            body=b"",
        )
        parser = self._make_parser_with_seer_event(event_type="link_shared")
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        mock_apply.assert_not_called()

    @staticmethod
    def _response_time_calls(mock_timing: MagicMock) -> list[tuple[float, dict[str, Any]]]:
        """Return (elapsed, tags) for each response time timing.

        `metrics` is a shared module, so filter out timings from unrelated code.
        """
        return [
            (call.args[1], call.kwargs["tags"])
            for call in mock_timing.call_args_list
            if call.args and call.args[0] == "hybrid_cloud.integration_control.slack.response_time"
        ]

    @patch("sentry.middleware.integrations.parsers.slack.metrics.timing")
    @patch("sentry.middleware.integrations.parsers.slack.time.time")
    @patch("sentry.middleware.integrations.parsers.slack.route_slack_seer_event.apply_async")
    def test_records_response_time_from_slack_timestamp(
        self, mock_apply: MagicMock, mock_time: MagicMock, mock_timing: MagicMock
    ) -> None:
        sent_at = 1700000000
        mock_time.return_value = sent_at + 2.5

        parser = self._make_parser_with_seer_event(event_type="app_mention")
        parser.request.META["HTTP_X_SLACK_REQUEST_TIMESTAMP"] = str(sent_at)
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        ((elapsed, tags),) = self._response_time_calls(mock_timing)
        assert elapsed == 2.5
        assert tags == {
            "provider": "slack",
            "url_name": "sentry-integration-slack-event",
            "status_code": status.HTTP_200_OK,
            "event_type": "app_mention",
        }

    @patch("sentry.middleware.integrations.parsers.slack.metrics.timing")
    @patch("sentry.middleware.integrations.parsers.slack.route_slack_seer_event.apply_async")
    def test_skips_response_time_without_slack_timestamp(
        self, mock_apply: MagicMock, mock_timing: MagicMock
    ) -> None:
        parser = self._make_parser_with_seer_event(event_type="app_mention")
        assert "HTTP_X_SLACK_REQUEST_TIMESTAMP" not in parser.request.META
        parser.get_response()

        assert self._response_time_calls(mock_timing) == []

    @responses.activate
    @patch("sentry.middleware.integrations.parsers.slack.metrics.timing")
    @patch("sentry.middleware.integrations.parsers.slack.time.time")
    def test_records_response_time_event_type_other(
        self, mock_time: MagicMock, mock_timing: MagicMock
    ) -> None:
        """Slack controls the event type, so unrecognized values collapse to "other"."""
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/slack/event/",
            status=status.HTTP_200_OK,
            body=b"",
        )
        sent_at = 1700000000
        mock_time.return_value = sent_at + 1.0

        parser = self._make_parser_with_seer_event(event_type="channel_archive")
        parser.request.META["HTTP_X_SLACK_REQUEST_TIMESTAMP"] = str(sent_at)
        parser.get_response()

        ((_, tags),) = self._response_time_calls(mock_timing)
        assert tags["event_type"] == "other"

    @patch("sentry.middleware.integrations.parsers.slack.metrics.timing")
    @patch("sentry.middleware.integrations.parsers.slack.time.time")
    def test_records_response_time_for_action_request(
        self, mock_time: MagicMock, mock_timing: MagicMock
    ) -> None:
        """SlackActionRequest defines its own `type`, which is not an event type."""
        sent_at = 1700000000
        mock_time.return_value = sent_at + 1.0

        data = self._make_link_identity_action_data(
            slack_user_id="U1234567890",
            response_url="https://hooks.slack.com/actions/TXXXXXXX1/1234567890123/something",
        )
        request = self.factory.post(
            reverse("sentry-integration-slack-action"),
            data=data,
            HTTP_X_SLACK_REQUEST_TIMESTAMP=str(sent_at),
        )
        parser = SlackRequestParser(request, self.get_response)
        parser.get_response()

        ((_, tags),) = self._response_time_calls(mock_timing)
        assert tags["url_name"] == "sentry-integration-slack-action"
        assert tags["event_type"] == "other"

    @patch("sentry.middleware.integrations.parsers.slack.metrics.timing")
    @patch("sentry.middleware.integrations.parsers.slack.time.time")
    @patch("sentry.middleware.integrations.parsers.slack.route_slack_seer_event.apply_async")
    def test_records_negative_response_time_on_clock_skew(
        self, mock_apply: MagicMock, mock_time: MagicMock, mock_timing: MagicMock
    ) -> None:
        """Clock skew between Slack and us is recorded as-is rather than dropped."""
        sent_at = 1700000000
        mock_time.return_value = sent_at - 5

        parser = self._make_parser_with_seer_event(event_type="app_mention")
        parser.request.META["HTTP_X_SLACK_REQUEST_TIMESTAMP"] = str(sent_at)
        parser.get_response()

        ((elapsed, _),) = self._response_time_calls(mock_timing)
        assert elapsed == -5

    @patch("sentry.middleware.integrations.parsers.slack.metrics.timing")
    @patch("sentry.middleware.integrations.parsers.slack.time.time")
    def test_records_response_time_on_exception(
        self, mock_time: MagicMock, mock_timing: MagicMock
    ) -> None:
        sent_at = 1700000000
        mock_time.return_value = sent_at + 1.0

        parser = self._make_parser_with_seer_event(event_type="app_mention")
        parser.request.META["HTTP_X_SLACK_REQUEST_TIMESTAMP"] = str(sent_at)
        with patch.object(parser, "_get_response", side_effect=ValueError("boom")):
            with pytest.raises(ValueError):
                parser.get_response()

        ((elapsed, tags),) = self._response_time_calls(mock_timing)
        assert elapsed == 1.0
        assert tags["status_code"] == "error"
