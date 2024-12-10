from collections.abc import Mapping

import responses

from sentry.sentry_apps.external_requests.alert_rule_action_requester import (
    DEFAULT_ERROR_MESSAGE,
    DEFAULT_SUCCESS_MESSAGE,
    AlertRuleActionRequester,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils import json
from sentry.utils.sentry_apps import SentryAppWebhookRequestsBuffer


@control_silo_test
class TestAlertRuleActionRequester(TestCase):
    def setUp(self):
        super().setUp()

        self.user = self.create_user(name="foo")
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(slug="boop", organization=self.org)
        self.group = self.create_group(project=self.project)

        self.sentry_app = self.create_sentry_app(
            name="foo",
            organization=self.org,
            schema={
                "elements": [
                    self.create_alert_rule_action_schema(),
                ]
            },
        )

        self.install = self.create_sentry_app_installation(
            slug="foo", organization=self.org, user=self.user
        )
        self.fields: list[Mapping[str, str]] = [
            {"name": "title", "value": "An Alert"},
            {"name": "description", "value": "threshold reached"},
            {"name": "assignee_id", "value": "user-1"},
        ]
        self.error_message = "Channel not found!"
        self.success_message = "Created alert!"

    @responses.activate
    def test_makes_successful_request(self):

        responses.add(
            method=responses.POST,
            url="https://example.com/sentry/alert-rule",
            status=200,
        )

        result = AlertRuleActionRequester(
            install=self.install,
            uri="/sentry/alert-rule",
            fields=self.fields,
        ).run()
        assert result["success"]
        assert result["message"] == f"{self.sentry_app.name}: {DEFAULT_SUCCESS_MESSAGE}"
        request = responses.calls[0].request

        data = {
            "fields": self.fields,
            "installationId": self.install.uuid,
        }
        payload = json.loads(request.body)
        assert payload == data

        assert request.headers["Sentry-App-Signature"] == self.sentry_app.build_signature(
            json.dumps(payload)
        )

        buffer = SentryAppWebhookRequestsBuffer(self.sentry_app)
        requests = buffer.get_requests()

        assert len(requests) == 1
        assert requests[0]["response_code"] == 200
        assert requests[0]["event_type"] == "alert_rule_action.requested"

    @responses.activate
    def test_makes_successful_request_with_message(self):
        responses.add(
            method=responses.POST,
            url="https://example.com/sentry/alert-rule",
            status=200,
            json={"message": self.success_message},
        )

        result = AlertRuleActionRequester(
            install=self.install,
            uri="/sentry/alert-rule",
            fields=self.fields,
        ).run()
        assert result["success"]
        assert result["message"] == f"{self.sentry_app.name}: {self.success_message}"

    @responses.activate
    def test_makes_successful_request_with_malformed_message(self):
        responses.add(
            method=responses.POST,
            url="https://example.com/sentry/alert-rule",
            status=200,
            body=self.success_message.encode(),
        )
        result = AlertRuleActionRequester(
            install=self.install,
            uri="/sentry/alert-rule",
            fields=self.fields,
        ).run()
        assert result["success"]
        assert result["message"] == f"{self.sentry_app.name}: {DEFAULT_SUCCESS_MESSAGE}"

    @responses.activate
    def test_makes_failed_request(self):

        responses.add(
            method=responses.POST,
            url="https://example.com/sentry/alert-rule",
            status=401,
        )

        result = AlertRuleActionRequester(
            install=self.install,
            uri="/sentry/alert-rule",
            fields=self.fields,
        ).run()
        assert not result["success"]
        assert result["message"] == f"{self.sentry_app.name}: {DEFAULT_ERROR_MESSAGE}"
        request = responses.calls[0].request

        data = {
            "fields": [
                {"name": "title", "value": "An Alert"},
                {"name": "description", "value": "threshold reached"},
                {
                    "name": "assignee_id",
                    "value": "user-1",
                },
            ],
            "installationId": self.install.uuid,
        }
        payload = json.loads(request.body)
        assert payload == data

        assert request.headers["Sentry-App-Signature"] == self.sentry_app.build_signature(
            json.dumps(payload)
        )

        buffer = SentryAppWebhookRequestsBuffer(self.sentry_app)
        requests = buffer.get_requests()

        assert len(requests) == 1
        assert requests[0]["response_code"] == 401
        assert requests[0]["event_type"] == "alert_rule_action.requested"

    @responses.activate
    def test_makes_failed_request_with_message(self):
        responses.add(
            method=responses.POST,
            url="https://example.com/sentry/alert-rule",
            status=401,
            json={"message": self.error_message},
        )
        result = AlertRuleActionRequester(
            install=self.install,
            uri="/sentry/alert-rule",
            fields=self.fields,
        ).run()
        assert not result["success"]
        assert result["message"] == f"{self.sentry_app.name}: {self.error_message}"

    @responses.activate
    def test_makes_failed_request_with_malformed_message(self):
        responses.add(
            method=responses.POST,
            url="https://example.com/sentry/alert-rule",
            status=401,
            body=self.error_message.encode(),
        )
        result = AlertRuleActionRequester(
            install=self.install,
            uri="/sentry/alert-rule",
            fields=self.fields,
        ).run()
        assert not result["success"]
        assert result["message"] == f"{self.sentry_app.name}: {DEFAULT_ERROR_MESSAGE}"
