from __future__ import absolute_import

import responses

from sentry.utils.compat.mock import patch
from exam import fixture
from django.test import RequestFactory

from sentry.integrations.github_enterprise.integration import GitHubEnterpriseIntegration
from sentry.models import Integration, ExternalIssue
from sentry.testutils import TestCase
from sentry.utils import json


class GitHubEnterpriseIssueBasicTest(TestCase):
    @fixture
    def request(self):
        return RequestFactory()

    def setUp(self):
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
        self.model = Integration.objects.create(
            provider="github_enterprise",
            external_id="github_external_id",
            name="getsentry",
            metadata={
                "domain_name": "35.232.149.196/getsentry",
                "installation_id": "installation_id",
                "installation": {"id": 2, "private_key": "private_key", "verify_ssl": True},
            },
        )
        self.model.add_organization(self.organization, self.user)
        self.integration = GitHubEnterpriseIntegration(self.model, self.organization.id)

    @responses.activate
    @patch("sentry.integrations.github_enterprise.client.get_jwt", return_value="jwt_token_1")
    def test_get_allowed_assignees(self, mock_get_jwt):
        responses.add(
            responses.POST,
            "https://35.232.149.196/api/v3/app/installations/installation_id/access_tokens",
            json={"token": "token_1", "expires_at": "2018-10-11T22:14:10Z"},
        )

        responses.add(
            responses.GET,
            "https://35.232.149.196/api/v3/repos/getsentry/sentry/assignees",
            json=[{"login": "MeredithAnya"}],
        )

        repo = "getsentry/sentry"
        assert self.integration.get_allowed_assignees(repo) == (
            ("", "Unassigned"),
            ("MeredithAnya", "MeredithAnya"),
        )

        request = responses.calls[0].request
        assert request.headers["Authorization"] == "Bearer jwt_token_1"

        request = responses.calls[1].request
        assert request.headers["Authorization"] == "token token_1"

    @responses.activate
    @patch("sentry.integrations.github_enterprise.client.get_jwt", return_value="jwt_token_1")
    def test_create_issue(self, mock_get_jwt):
        responses.add(
            responses.POST,
            "https://35.232.149.196/api/v3/app/installations/installation_id/access_tokens",
            json={"token": "token_1", "expires_at": "2018-10-11T22:14:10Z"},
        )

        responses.add(
            responses.POST,
            "https://35.232.149.196/api/v3/repos/getsentry/sentry/issues",
            json={
                "number": 321,
                "title": "hello",
                "body": "This is the description",
                "html_url": "https://35.232.149.196/getsentry/sentry/issues/231",
            },
        )

        form_data = {
            "repo": "getsentry/sentry",
            "title": "hello",
            "description": "This is the description",
        }

        assert self.integration.create_issue(form_data) == {
            "key": 321,
            "description": "This is the description",
            "title": "hello",
            "url": "https://35.232.149.196/getsentry/sentry/issues/231",
            "repo": "getsentry/sentry",
        }
        request = responses.calls[0].request
        assert request.headers["Authorization"] == "Bearer jwt_token_1"

        request = responses.calls[1].request
        assert request.headers["Authorization"] == "token token_1"
        payload = json.loads(request.body)
        assert payload == {"body": "This is the description", "assignee": None, "title": "hello"}

    @responses.activate
    @patch("sentry.integrations.github_enterprise.client.get_jwt", return_value="jwt_token_1")
    def test_get_repo_issues(self, mock_get_jwt):
        responses.add(
            responses.POST,
            "https://35.232.149.196/api/v3/app/installations/installation_id/access_tokens",
            json={"token": "token_1", "expires_at": "2018-10-11T22:14:10Z"},
        )

        responses.add(
            responses.GET,
            "https://35.232.149.196/api/v3/repos/getsentry/sentry/issues",
            json=[{"number": 321, "title": "hello", "body": "This is the description"}],
        )
        repo = "getsentry/sentry"
        assert self.integration.get_repo_issues(repo) == ((321, "#321 hello"),)

        request = responses.calls[0].request
        assert request.headers["Authorization"] == "Bearer jwt_token_1"

        request = responses.calls[1].request
        assert request.headers["Authorization"] == "token token_1"

    @responses.activate
    @patch("sentry.integrations.github_enterprise.client.get_jwt", return_value="jwt_token_1")
    def test_link_issue(self, mock_get_jwt):
        issue_id = 321
        responses.add(
            responses.POST,
            "https://35.232.149.196/api/v3/app/installations/installation_id/access_tokens",
            json={"token": "token_1", "expires_at": "2018-10-11T22:14:10Z"},
        )

        responses.add(
            responses.GET,
            "https://35.232.149.196/api/v3/repos/getsentry/sentry/issues/321",
            json={
                "number": issue_id,
                "title": "hello",
                "body": "This is the description",
                "html_url": "https://35.232.149.196/getsentry/sentry/issues/231",
            },
        )

        data = {"repo": "getsentry/sentry", "externalIssue": issue_id, "comment": "hello"}

        assert self.integration.get_issue(issue_id, data=data) == {
            "key": issue_id,
            "description": "This is the description",
            "title": "hello",
            "url": "https://35.232.149.196/getsentry/sentry/issues/231",
            "repo": "getsentry/sentry",
        }
        request = responses.calls[0].request
        assert request.headers["Authorization"] == "Bearer jwt_token_1"

        request = responses.calls[1].request
        assert request.headers["Authorization"] == "token token_1"

    @responses.activate
    @patch("sentry.integrations.github_enterprise.client.get_jwt", return_value="jwt_token_1")
    def after_link_issue(self, mock_get_jwt):
        responses.add(
            responses.POST,
            "https://35.232.149.196/api/v3/installations/installation_id/access_tokens",
            json={"token": "token_1", "expires_at": "2018-10-11T22:14:10Z"},
        )

        responses.add(
            responses.POST,
            "https://35.232.149.196/api/v3/repos/getsentry/sentry/issues/321/comments",
            json={"body": "hello"},
        )

        data = {"comment": "hello"}
        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id, integration_id=self.model.id, key="hello#321"
        )

        self.integration.after_link_issue(external_issue, data=data)

        request = responses.calls[0].request
        assert request.headers["Authorization"] == "Bearer jwt_token_1"

        request = responses.calls[1].request
        assert request.headers["Authorization"] == "token token_1"
        payload = json.loads(request.body)
        assert payload == {"body": "hello"}
