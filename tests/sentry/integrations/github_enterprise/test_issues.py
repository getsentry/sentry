from functools import cached_property
from typing import cast
from unittest.mock import patch

import orjson
import responses
from django.test import RequestFactory

from sentry.integrations.github_enterprise.integration import GitHubEnterpriseIntegration
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.silo.base import SiloMode
from sentry.silo.util import PROXY_BASE_URL_HEADER, PROXY_OI_HEADER, PROXY_SIGNATURE_HEADER
from sentry.testutils.cases import IntegratedApiTestCase, TestCase
from sentry.testutils.silo import assume_test_silo_mode


class GitHubEnterpriseIssueBasicTest(TestCase, IntegratedApiTestCase):
    @cached_property
    def request(self):
        return RequestFactory()

    _IP_ADDRESS = "35.232.149.196"

    def setUp(self):
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.model = self.create_provider_integration(
                provider="github_enterprise",
                external_id="github_external_id",
                name="getsentry",
                metadata={
                    "domain_name": f"{self._IP_ADDRESS}/getsentry",
                    "installation_id": "installation_id",
                    "installation": {"id": 2, "private_key": "private_key", "verify_ssl": True},
                },
            )
            self.model.add_organization(self.organization, self.user)
        install = self.model.get_installation(self.organization.id)
        self.install = cast(GitHubEnterpriseIntegration, install)

    def _check_proxying(self) -> None:
        assert len(responses.calls) == 1
        request = responses.calls[0].request
        assert self.install.org_integration is not None
        assert request.headers[PROXY_OI_HEADER] == str(self.install.org_integration.id)
        assert request.headers[PROXY_BASE_URL_HEADER] == f"https://{self._IP_ADDRESS}"
        assert PROXY_SIGNATURE_HEADER in request.headers

    @responses.activate
    @patch("sentry.integrations.github_enterprise.client.get_jwt", return_value="jwt_token_1")
    def test_get_allowed_assignees(self, mock_get_jwt):
        responses.add(
            responses.POST,
            f"https://{self._IP_ADDRESS}/api/v3/app/installations/installation_id/access_tokens",
            json={"token": "token_1", "expires_at": "2018-10-11T22:14:10Z"},
        )

        responses.add(
            responses.GET,
            f"https://{self._IP_ADDRESS}/api/v3/repos/getsentry/sentry/assignees",
            json=[{"login": "MeredithAnya"}],
        )

        repo = "getsentry/sentry"
        assert self.install.get_allowed_assignees(repo) == (
            ("", "Unassigned"),
            ("MeredithAnya", "MeredithAnya"),
        )

        if self.should_call_api_without_proxying():
            assert len(responses.calls) == 2

            request = responses.calls[0].request
            assert request.headers["Authorization"] == "Bearer jwt_token_1"

            request = responses.calls[1].request
            assert request.headers["Authorization"] == "Bearer token_1"
        else:
            self._check_proxying()

    @responses.activate
    @patch("sentry.integrations.github_enterprise.client.get_jwt", return_value="jwt_token_1")
    def test_get_repo_labels(self, mock_get_jwt):
        responses.add(
            responses.POST,
            f"https://{self._IP_ADDRESS}/api/v3/app/installations/installation_id/access_tokens",
            json={"token": "token_1", "expires_at": "2018-10-11T22:14:10Z"},
        )

        responses.add(
            responses.GET,
            f"https://{self._IP_ADDRESS}/api/v3/repos/getsentry/sentry/labels",
            json=[{"name": "bug"}, {"name": "enhancement"}, {"name": "duplicate"}],
        )

        repo = "getsentry/sentry"
        # results should be sorted alphabetically
        assert self.install.get_repo_labels(repo) == (
            ("bug", "bug"),
            ("duplicate", "duplicate"),
            ("enhancement", "enhancement"),
        )

        if self.should_call_api_without_proxying():
            assert len(responses.calls) == 2

            request = responses.calls[0].request
            assert request.headers["Authorization"] == "Bearer jwt_token_1"

            request = responses.calls[1].request
            assert request.headers["Authorization"] == "Bearer token_1"
        else:
            self._check_proxying()

    @responses.activate
    @patch("sentry.integrations.github_enterprise.client.get_jwt", return_value="jwt_token_1")
    def test_create_issue(self, mock_get_jwt):
        responses.add(
            responses.POST,
            f"https://{self._IP_ADDRESS}/api/v3/app/installations/installation_id/access_tokens",
            json={"token": "token_1", "expires_at": "2018-10-11T22:14:10Z"},
        )

        responses.add(
            responses.POST,
            f"https://{self._IP_ADDRESS}/api/v3/repos/getsentry/sentry/issues",
            json={
                "number": 321,
                "title": "hello",
                "body": "This is the description",
                "html_url": f"https://{self._IP_ADDRESS}/getsentry/sentry/issues/231",
            },
        )

        form_data = {
            "repo": "getsentry/sentry",
            "title": "hello",
            "description": "This is the description",
        }

        assert self.install.create_issue(form_data) == {
            "key": 321,
            "description": "This is the description",
            "title": "hello",
            "url": f"https://{self._IP_ADDRESS}/getsentry/sentry/issues/231",
            "repo": "getsentry/sentry",
        }

        if self.should_call_api_without_proxying():
            assert len(responses.calls) == 2

            request = responses.calls[0].request
            assert request.headers["Authorization"] == "Bearer jwt_token_1"

            request = responses.calls[1].request
            assert request.headers["Authorization"] == "Bearer token_1"
            payload = orjson.loads(request.body)
            assert payload == {
                "body": "This is the description",
                "assignee": None,
                "title": "hello",
                "labels": None,
            }
        else:
            self._check_proxying()

    @responses.activate
    @patch("sentry.integrations.github_enterprise.client.get_jwt", return_value="jwt_token_1")
    def test_link_issue(self, mock_get_jwt):
        issue_id = "321"
        responses.add(
            responses.POST,
            f"https://{self._IP_ADDRESS}/api/v3/app/installations/installation_id/access_tokens",
            json={"token": "token_1", "expires_at": "2018-10-11T22:14:10Z"},
        )

        responses.add(
            responses.GET,
            f"https://{self._IP_ADDRESS}/api/v3/repos/getsentry/sentry/issues/321",
            json={
                "number": issue_id,
                "title": "hello",
                "body": "This is the description",
                "html_url": f"https://{self._IP_ADDRESS}/getsentry/sentry/issues/231",
            },
        )

        data = {"repo": "getsentry/sentry", "externalIssue": issue_id, "comment": "hello"}

        assert self.install.get_issue(issue_id, data=data) == {
            "key": issue_id,
            "description": "This is the description",
            "title": "hello",
            "url": f"https://{self._IP_ADDRESS}/getsentry/sentry/issues/231",
            "repo": "getsentry/sentry",
        }

        if self.should_call_api_without_proxying():
            assert len(responses.calls) == 2

            request = responses.calls[0].request
            assert request.headers["Authorization"] == "Bearer jwt_token_1"

            request = responses.calls[1].request
            assert request.headers["Authorization"] == "Bearer token_1"
        else:
            self._check_proxying()

    @responses.activate
    @patch("sentry.integrations.github_enterprise.client.get_jwt", return_value="jwt_token_1")
    def after_link_issue(self, mock_get_jwt):
        responses.add(
            responses.POST,
            f"https://{self._IP_ADDRESS}/api/v3/installations/installation_id/access_tokens",
            json={"token": "token_1", "expires_at": "2018-10-11T22:14:10Z"},
        )

        responses.add(
            responses.POST,
            f"https://{self._IP_ADDRESS}/api/v3/repos/getsentry/sentry/issues/321/comments",
            json={"body": "hello"},
        )

        data = {"comment": "hello"}
        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id, integration_id=self.model.id, key="hello#321"
        )

        self.install.after_link_issue(external_issue, data=data)

        if self.should_call_api_without_proxying():
            assert len(responses.calls) == 2

            request = responses.calls[0].request
            assert request.headers["Authorization"] == "Bearer jwt_token_1"

            request = responses.calls[1].request
            assert request.headers["Authorization"] == "Bearer token_1"
            payload = orjson.loads(request.body)
            assert payload == {"body": "hello"}
        else:
            self._check_proxying()
