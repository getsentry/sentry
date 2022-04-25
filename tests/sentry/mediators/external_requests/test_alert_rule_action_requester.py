import responses

from sentry.mediators.external_requests import AlertRuleActionRequester
from sentry.mediators.external_requests.alert_rule_action_requester import DEFAULT_SUCCESS_MESSAGE
from sentry.testutils import TestCase
from sentry.utils import json
from sentry.utils.sentryappwebhookrequests import SentryAppWebhookRequestsBuffer


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
        self.fields = [
            {"name": "title", "value": "An Alert"},
            {"name": "description", "value": "threshold reached"},
            {"name": "assignee_id", "value": "user-1"},
        ]

    @responses.activate
    def test_makes_successful_request(self):

        responses.add(
            method=responses.POST,
            url="https://example.com/sentry/alert-rule",
            status=200,
        )

        result = AlertRuleActionRequester.run(
            install=self.install,
            uri="/sentry/alert-rule",
            fields=self.fields,
        )
        assert result["success"]
        assert result["message"] == f"foo: {DEFAULT_SUCCESS_MESSAGE}"
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
        assert requests[0]["response_code"] == 200
        assert requests[0]["event_type"] == "alert_rule_action.requested"

    @responses.activate
    def test_makes_failed_request(self):

        responses.add(
            method=responses.POST,
            url="https://example.com/sentry/alert-rule",
            status=401,
            json={"message": "Channel not found!"},
        )

        result = AlertRuleActionRequester.run(
            install=self.install,
            uri="/sentry/alert-rule",
            fields=self.fields,
        )
        assert not result["success"]
        assert result["message"] == "foo: Channel not found!"
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
    def test_makes_failed_request_returning_only_status(self):

        responses.add(
            method=responses.POST,
            url="https://example.com/sentry/alert-rule",
            status=401,
        )

        result = AlertRuleActionRequester.run(
            install=self.install,
            uri="/sentry/alert-rule",
            fields=self.fields,
        )
        assert not result["success"]
        assert result["message"] == "foo: Something went wrong!"
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
