from __future__ import absolute_import

import responses

from sentry.coreapi import APIError
from sentry.mediators.external_requests import IssueLinkRequester
from sentry.testutils import TestCase
from sentry.utils import json
from sentry.utils.sentryappwebhookrequests import SentryAppWebhookRequestsBuffer


class TestIssueLinkRequester(TestCase):
    def setUp(self):
        super(TestIssueLinkRequester, self).setUp()

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
        fields = {"title": "An Issue", "description": "a bug was found", "assignee": "user-1"}

        responses.add(
            method=responses.POST,
            url="https://example.com/link-issue",
            json={
                "project": "ProjectName",
                "webUrl": "https://example.com/project/issue-id",
                "identifier": "issue-1",
            },
            status=200,
            content_type="application/json",
        )

        result = IssueLinkRequester.run(
            install=self.install,
            project=self.project,
            group=self.group,
            uri="/link-issue",
            fields=fields,
            user=self.user,
            action="create",
        )
        assert result == {
            "project": "ProjectName",
            "webUrl": "https://example.com/project/issue-id",
            "identifier": "issue-1",
        }

        request = responses.calls[0].request
        assert request.headers["Sentry-App-Signature"]
        data = {
            "fields": {"title": "An Issue", "description": "a bug was found", "assignee": "user-1"},
            "issueId": self.group.id,
            "installationId": self.install.uuid,
            "webUrl": self.group.get_absolute_url(),
            "project": {"id": self.project.id, "slug": self.project.slug},
            "actor": {"type": "user", "id": self.user.id, "name": self.user.name},
        }
        payload = json.loads(request.body)
        assert payload == data

        buffer = SentryAppWebhookRequestsBuffer(self.sentry_app)
        requests = buffer.get_requests()

        assert len(requests) == 1
        assert requests[0]["response_code"] == 200
        assert requests[0]["event_type"] == "external_issue.created"

    @responses.activate
    def test_invalid_response_format(self):
        # missing 'identifier'
        invalid_format = {
            "project": "ProjectName",
            "webUrl": "https://example.com/project/issue-id",
        }
        responses.add(
            method=responses.POST,
            url="https://example.com/link-issue",
            json=invalid_format,
            status=200,
            content_type="application/json",
        )
        with self.assertRaises(APIError):
            IssueLinkRequester.run(
                install=self.install,
                project=self.project,
                group=self.group,
                uri="/link-issue",
                fields={},
                user=self.user,
                action="create",
            )

    @responses.activate
    def test_500_response(self):
        responses.add(
            method=responses.POST,
            url="https://example.com/link-issue",
            body="Something failed",
            status=500,
        )

        with self.assertRaises(APIError):
            IssueLinkRequester.run(
                install=self.install,
                project=self.project,
                group=self.group,
                uri="/link-issue",
                fields={},
                user=self.user,
                action="create",
            )

        buffer = SentryAppWebhookRequestsBuffer(self.sentry_app)
        requests = buffer.get_requests()
        assert len(requests) == 1
        assert requests[0]["response_code"] == 500
        assert requests[0]["event_type"] == "external_issue.created"
