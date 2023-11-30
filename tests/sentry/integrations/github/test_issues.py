from functools import cached_property
from unittest.mock import patch

import responses
from django.test import RequestFactory
from pytest import fixture

from sentry.integrations.github import client
from sentry.integrations.github.integration import GitHubIntegration
from sentry.integrations.github.issues import GitHubIssueBasic
from sentry.models.integrations.external_issue import ExternalIssue
from sentry.models.integrations.integration import Integration
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.silo import SiloMode
from sentry.silo.util import PROXY_BASE_URL_HEADER, PROXY_OI_HEADER, PROXY_SIGNATURE_HEADER
from sentry.testutils.cases import IntegratedApiTestCase, PerformanceIssueTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.helpers.notifications import TEST_ISSUE_OCCURRENCE
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test
from sentry.testutils.skips import requires_snuba
from sentry.utils import json

pytestmark = [requires_snuba]


@region_silo_test
class GitHubIssueBasicTest(TestCase, PerformanceIssueTestCase, IntegratedApiTestCase):
    @cached_property
    def request(self):
        return RequestFactory()

    def setUp(self):
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.model = Integration.objects.create(
                provider="github", external_id="github_external_id", name="getsentry"
            )
            self.model.add_organization(self.organization, self.user)
        self.integration = GitHubIntegration(self.model, self.organization.id)
        self.min_ago = iso_format(before_now(minutes=1))
        self.repo = "getsentry/sentry"

    @fixture(autouse=True)
    def stub_get_jwt(self):
        with patch.object(client, "get_jwt", return_value="jwt_token_1"):
            yield

    def _check_proxying(self) -> None:
        assert len(responses.calls) == 1
        request = responses.calls[0].request
        assert request.headers[PROXY_OI_HEADER] == str(self.integration.org_integration.id)
        assert request.headers[PROXY_BASE_URL_HEADER] == "https://api.github.com"
        assert PROXY_SIGNATURE_HEADER in request.headers

    @responses.activate
    def test_get_allowed_assignees(self):
        responses.add(
            responses.GET,
            "https://api.github.com/repos/getsentry/sentry/assignees",
            json=[{"login": "MeredithAnya"}],
        )

        assert self.integration.get_allowed_assignees(self.repo) == (
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
    def test_get_repo_labels(self):
        responses.add(
            responses.POST,
            "https://api.github.com/app/installations/github_external_id/access_tokens",
            json={"token": "token_1", "expires_at": "2018-10-11T22:14:10Z"},
        )
        responses.add(
            responses.GET,
            "https://api.github.com/repos/getsentry/sentry/labels",
            json=[
                {"name": "bug"},
                {"name": "enhancement"},
                {"name": "duplicate"},
                {"name": "1"},
                {"name": "10"},
                {"name": "2"},
            ],
        )

        repo = "getsentry/sentry"

        # results should be sorted alphabetically
        assert self.integration.get_repo_labels(repo) == (
            ("1", "1"),
            ("2", "2"),
            ("10", "10"),
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
    def test_create_issue(self):
        responses.add(
            responses.POST,
            "https://api.github.com/repos/getsentry/sentry/issues",
            json={
                "number": 321,
                "title": "hello",
                "body": "This is the description",
                "html_url": "https://github.com/getsentry/sentry/issues/231",
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
            "url": "https://github.com/getsentry/sentry/issues/231",
            "repo": "getsentry/sentry",
        }

        if self.should_call_api_without_proxying():
            assert len(responses.calls) == 2

            request = responses.calls[0].request
            assert request.headers["Authorization"] == "Bearer jwt_token_1"

            request = responses.calls[1].request
            assert request.headers["Authorization"] == "Bearer token_1"
            payload = json.loads(request.body)
            assert payload == {
                "body": "This is the description",
                "assignee": None,
                "title": "hello",
                "labels": None,
            }
        else:
            self._check_proxying()

    def test_performance_issues_content(self):
        """Test that a GitHub issue created from a performance issue has the expected title and description"""
        event = self.create_performance_issue()
        description = GitHubIssueBasic().get_group_description(event.group, event)
        assert "db - SELECT `books_author`.`id`, `books_author" in description
        title = GitHubIssueBasic().get_group_title(event.group, event)
        assert title == "N+1 Query"

    def test_generic_issues_content(self):
        """Test that a GitHub issue created from a generic issue has the expected title and description"""

        occurrence = TEST_ISSUE_OCCURRENCE
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "oh no",
                "timestamp": iso_format(before_now(minutes=1)),
            },
            project_id=self.project.id,
        )
        group_event = event.for_group(event.groups[0])
        group_event.occurrence = occurrence

        description = GitHubIssueBasic().get_group_description(group_event.group, group_event)
        assert group_event.occurrence.evidence_display[0].value in description
        assert group_event.occurrence.evidence_display[1].value in description
        assert group_event.occurrence.evidence_display[2].value in description
        title = GitHubIssueBasic().get_group_title(group_event.group, group_event)
        assert title == group_event.occurrence.issue_title

    def test_error_issues_content(self):
        """Test that a GitHub issue created from an error issue has the expected title and descriptionn"""
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "oh no",
                "timestamp": iso_format(before_now(minutes=1)),
            },
            project_id=self.project.id,
        )
        assert event.group is not None

        description = GitHubIssueBasic().get_group_description(event.group, event)
        assert "oh no" in description
        title = GitHubIssueBasic().get_group_title(event.group, event)
        assert title == event.title

    @responses.activate
    def test_get_repo_issues(self):
        responses.add(
            responses.GET,
            "https://api.github.com/repos/getsentry/sentry/issues",
            json=[{"number": 321, "title": "hello", "body": "This is the description"}],
        )
        assert self.integration.get_repo_issues(self.repo) == ((321, "#321 hello"),)

        if self.should_call_api_without_proxying():
            assert len(responses.calls) == 2

            request = responses.calls[0].request
            assert request.headers["Authorization"] == "Bearer jwt_token_1"

            request = responses.calls[1].request
            assert request.headers["Authorization"] == "Bearer token_1"
        else:
            self._check_proxying()

    @responses.activate
    def test_link_issue(self):
        issue_id = 321

        responses.add(
            responses.GET,
            "https://api.github.com/repos/getsentry/sentry/issues/321",
            json={
                "number": issue_id,
                "title": "hello",
                "body": "This is the description",
                "html_url": "https://github.com/getsentry/sentry/issues/231",
            },
        )

        data = {"repo": "getsentry/sentry", "externalIssue": issue_id, "comment": "hello"}

        assert self.integration.get_issue(issue_id, data=data) == {
            "key": issue_id,
            "description": "This is the description",
            "title": "hello",
            "url": "https://github.com/getsentry/sentry/issues/231",
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
    def test_repo_dropdown_choices(self):
        event = self.store_event(
            data={"event_id": "a" * 32, "timestamp": self.min_ago}, project_id=self.project.id
        )

        responses.add(
            responses.GET,
            "https://api.github.com/repos/getsentry/sentry/assignees",
            json=[{"login": "MeredithAnya"}],
        )
        responses.add(
            responses.GET,
            "https://api.github.com/repos/getsentry/sentry/labels",
            json=[{"name": "bug"}, {"name": "enhancement"}],
        )

        responses.add(
            responses.GET,
            "https://api.github.com/installation/repositories",
            json={
                "total_count": 2,
                "repositories": [
                    {"full_name": "getsentry/sentry", "name": "sentry"},
                    {"full_name": "getsentry/other", "name": "other", "archived": True},
                ],
            },
        )

        resp = self.integration.get_create_issue_config(group=event.group, user=self.user)
        assert resp[0]["choices"] == [("getsentry/sentry", "sentry")]

        responses.add(
            responses.GET,
            "https://api.github.com/repos/getsentry/hello/assignees",
            json=[{"login": "MeredithAnya"}],
        )
        responses.add(
            responses.GET,
            "https://api.github.com/repos/getsentry/hello/labels",
            json=[{"name": "bug"}, {"name": "enhancement"}],
        )

        # create an issue
        data = {"params": {"repo": "getsentry/hello"}}
        resp = self.integration.get_create_issue_config(group=event.group, user=self.user, **data)
        assert resp[0]["choices"] == [
            ("getsentry/hello", "hello"),
            ("getsentry/sentry", "sentry"),
        ]
        # link an issue
        data = {"params": {"repo": "getsentry/hello"}}
        resp = self.integration.get_link_issue_config(group=event.group, **data)
        assert resp[0]["choices"] == [
            ("getsentry/hello", "hello"),
            ("getsentry/sentry", "sentry"),
        ]

    @responses.activate
    def after_link_issue(self):
        responses.add(
            responses.POST,
            "https://api.github.com/repos/getsentry/sentry/issues/321/comments",
            json={"body": "hello"},
        )

        data = {"comment": "hello"}
        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id, integration_id=self.model.id, key="hello#321"
        )

        self.integration.after_link_issue(external_issue, data=data)

        request = responses.calls[0].request
        assert request.headers["Authorization"] == b"Bearer jwt_token_1"

        request = responses.calls[1].request
        assert request.headers["Authorization"] == "Bearer token_1"
        payload = json.loads(request.body)
        assert payload == {"body": "hello"}

    @responses.activate
    def test_default_repo_link_fields(self):
        responses.add(
            responses.GET,
            "https://api.github.com/installation/repositories",
            json={
                "total_count": 1,
                "repositories": [{"name": "sentry", "full_name": "getsentry/sentry"}],
            },
        )
        event = self.store_event(
            data={"event_id": "a" * 32, "timestamp": self.min_ago}, project_id=self.project.id
        )
        assert event.group is not None
        group = event.group
        integration_service.update_organization_integration(
            org_integration_id=self.integration.org_integration.id,
            config={
                "project_issue_defaults": {str(group.project_id): {"repo": "getsentry/sentry"}}
            },
        )
        fields = self.integration.get_link_issue_config(group)
        for field in fields:
            if field["name"] == "repo":
                repo_field = field
                break
        assert repo_field["default"] == "getsentry/sentry"

    @responses.activate
    def test_default_repo_create_fields(self):
        responses.add(
            responses.GET,
            "https://api.github.com/installation/repositories",
            json={
                "total_count": 1,
                "repositories": [{"name": "sentry", "full_name": "getsentry/sentry"}],
            },
        )
        responses.add(
            responses.GET,
            "https://api.github.com/repos/getsentry/sentry/assignees",
            json=[{"login": "MeredithAnya"}],
        )
        responses.add(
            responses.GET,
            "https://api.github.com/repos/getsentry/sentry/labels",
            json=[{"name": "bug"}, {"name": "enhancement"}],
        )
        event = self.store_event(
            data={"event_id": "a" * 32, "timestamp": self.min_ago}, project_id=self.project.id
        )
        assert event.group is not None
        group = event.group
        integration_service.update_organization_integration(
            org_integration_id=self.integration.org_integration.id,
            config={
                "project_issue_defaults": {str(group.project_id): {"repo": "getsentry/sentry"}}
            },
        )
        fields = self.integration.get_create_issue_config(group, self.user)
        for field in fields:
            if field["name"] == "repo":
                repo_field = field
                break
        assert repo_field["default"] == "getsentry/sentry"

    @responses.activate
    def test_default_repo_link_fields_no_repos(self):
        responses.add(
            responses.GET,
            "https://api.github.com/installation/repositories",
            json={"total_count": 0, "repositories": []},
        )
        event = self.store_event(
            data={"event_id": "a" * 32, "timestamp": self.min_ago}, project_id=self.project.id
        )
        fields = self.integration.get_link_issue_config(event.group)
        repo_field = [field for field in fields if field["name"] == "repo"][0]
        assert repo_field["default"] == ""
        assert repo_field["choices"] == []

    @responses.activate
    def test_default_repo_create_fields_no_repos(self):
        responses.add(
            responses.GET,
            "https://api.github.com/installation/repositories",
            json={"total_count": 0, "repositories": []},
        )
        event = self.store_event(
            data={"event_id": "a" * 32, "timestamp": self.min_ago}, project_id=self.project.id
        )
        fields = self.integration.get_create_issue_config(event.group, self.user)
        repo_field = [field for field in fields if field["name"] == "repo"][0]
        assignee_field = [field for field in fields if field["name"] == "assignee"][0]

        assert repo_field["default"] == ""
        assert repo_field["choices"] == []
        assert assignee_field["default"] == ""
        assert assignee_field["choices"] == []
