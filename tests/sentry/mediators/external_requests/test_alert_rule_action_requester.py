import responses

from sentry.mediators.external_requests import AlertRuleActionRequester
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
            name="foo", organization=self.org, webhook_url="https://example.com", scopes=()
        )

        self.install = self.create_sentry_app_installation(
            slug="foo", organization=self.org, user=self.user
        )

    @responses.activate
    def test_makes_request(self):
        fields = {"title": "An Alert", "description": "threshold reached", "assignee": "user-1"}

        responses.add(
            method=responses.POST,
            url="https://example.com/alert-rule",
            status=200,
            content_type="application/json",
        )

        result = AlertRuleActionRequester.run(
            install=self.install,
            uri="/alert-rule",
            fields=fields,
        )
        assert not result

        request = responses.calls[0].request
        assert request.headers["Sentry-App-Signature"]
        data = {
            "fields": {
                "title": "An Alert",
                "description": "threshold reached",
                "assignee": "user-1",
            },
            "installationId": self.install.uuid,
        }
        payload = json.loads(request.body)
        assert payload == data

        buffer = SentryAppWebhookRequestsBuffer(self.sentry_app)
        requests = buffer.get_requests()

        assert len(requests) == 1
        assert requests[0]["response_code"] == 200
        assert requests[0]["event_type"] == "alert_rule_action.requested"
