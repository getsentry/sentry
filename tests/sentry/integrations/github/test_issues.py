import datetime
from functools import cached_property
from typing import cast
from unittest.mock import patch

import orjson
import responses
from django.test import RequestFactory
from django.utils import timezone
from pytest import fixture

from sentry.integrations.github import client
from sentry.integrations.github.integration import GitHubIntegration
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.services.integration import integration_service
from sentry.issues.grouptype import FeedbackGroup
from sentry.silo.util import PROXY_BASE_URL_HEADER, PROXY_OI_HEADER, PROXY_SIGNATURE_HEADER
from sentry.testutils.cases import IntegratedApiTestCase, PerformanceIssueTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.notifications import TEST_ISSUE_OCCURRENCE
from sentry.testutils.silo import all_silo_test
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


@all_silo_test
class GitHubIssueBasicAllSiloTest(TestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
        ten_days = timezone.now() + datetime.timedelta(days=10)
        self.integration = self.create_integration(
            organization=self.organization,
            provider="github",
            external_id="github_external_id",
            name="getsentry",
            metadata={
                "access_token": "some-token",
                "expires_at": ten_days.strftime("%Y-%m-%dT%H:%M:%S"),
            },
        )
        install = self.integration.get_installation(self.organization.id)
        self.install = cast(GitHubIntegration, install)

    @fixture(autouse=True)
    def stub_get_jwt(self):
        with patch.object(client, "get_jwt", return_value="jwt_token_1"):
            yield

    @responses.activate
    def test_get_create_issue_config_without_group(self):
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
        responses.add(
            responses.GET,
            "https://api.github.com/repos/getsentry/sentry/assignees",
            json=[{"login": "leeandher"}],
        )

        responses.add(
            responses.GET,
            "https://api.github.com/repos/getsentry/sentry/labels",
            json=[
                {"name": "bug"},
                {"name": "not-bug"},
            ],
        )

        install = self.install
        config = install.get_create_issue_config(None, self.user, params={})
        [repo_field, assignee_field, label_field] = config
        assert repo_field["name"] == "repo"
        assert repo_field["type"] == "select"
        assert repo_field["label"] == "GitHub Repository"
        assert assignee_field["name"] == "assignee"
        assert assignee_field["type"] == "select"
        assert assignee_field["label"] == "Assignee"
        assert label_field["name"] == "labels"
        assert label_field["type"] == "select"
        assert label_field["label"] == "Labels"


class GitHubIssueBasicTest(TestCase, PerformanceIssueTestCase, IntegratedApiTestCase):
    @cached_property
    def request(self):
        return RequestFactory()

    def setUp(self):
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
        self.integration = self.create_integration(
            organization=self.organization,
            provider="github",
            external_id="github_external_id",
            name="getsentry",
        )
        install = self.integration.get_installation(self.organization.id)
        self.install = cast(GitHubIntegration, install)
        self.min_ago = before_now(minutes=1).isoformat()
        self.repo = "getsentry/sentry"

    @fixture(autouse=True)
    def stub_get_jwt(self):
        with patch.object(client, "get_jwt", return_value="jwt_token_1"):
            yield

    def _check_proxying(self) -> None:
        assert len(responses.calls) == 1
        request = responses.calls[0].request
        assert self.install.org_integration is not None
        assert request.headers[PROXY_OI_HEADER] == str(self.install.org_integration.id)
        assert request.headers[PROXY_BASE_URL_HEADER] == "https://api.github.com"
        assert PROXY_SIGNATURE_HEADER in request.headers

    @responses.activate
    def test_get_allowed_assignees(self):
        responses.add(
            responses.GET,
            "https://api.github.com/repos/getsentry/sentry/assignees",
            json=[{"login": "MeredithAnya"}],
        )

        assert self.install.get_allowed_assignees(self.repo) == (
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
        assert self.install.get_repo_labels(repo) == (
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

        assert self.install.create_issue(form_data) == {
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
            payload = orjson.loads(request.body)
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
        description = self.install.get_group_description(event.group, event)
        assert "db - SELECT `books_author`.`id`, `books_author" in description
        title = self.install.get_group_title(event.group, event)
        assert title == "N+1 Query"

    def test_generic_issues_content(self):
        """Test that a GitHub issue created from a generic issue has the expected title and description"""

        occurrence = TEST_ISSUE_OCCURRENCE
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "oh no",
                "timestamp": before_now(minutes=1).isoformat(),
            },
            project_id=self.project.id,
        )
        group_event = event.for_group(event.groups[0])
        group_event.occurrence = occurrence

        description = self.install.get_group_description(group_event.group, group_event)
        assert group_event.occurrence.evidence_display[0].value in description
        assert group_event.occurrence.evidence_display[1].value in description
        assert group_event.occurrence.evidence_display[2].value in description
        title = self.install.get_group_title(group_event.group, group_event)
        assert title == group_event.occurrence.issue_title

    def test_error_issues_content(self):
        """Test that a GitHub issue created from an error issue has the expected title and descriptionn"""
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "oh no",
                "timestamp": before_now(minutes=1).isoformat(),
            },
            project_id=self.project.id,
        )
        assert event.group is not None

        description = self.install.get_group_description(event.group, event)
        assert "oh no" in description
        title = self.install.get_group_title(event.group, event)
        assert title == event.title

    @responses.activate
    def test_get_repo_issues(self):
        responses.add(
            responses.GET,
            "https://api.github.com/repos/getsentry/sentry/issues",
            json=[{"number": 321, "title": "hello", "body": "This is the description"}],
        )
        assert self.install.get_repo_issues(self.repo) == ((321, "#321 hello"),)

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
        issue_id = "321"

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

        assert self.install.get_issue(issue_id, data=data) == {
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

        resp = self.install.get_create_issue_config(group=event.group, user=self.user)
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
        resp = self.install.get_create_issue_config(group=event.group, user=self.user, **data)
        assert resp[0]["choices"] == [
            ("getsentry/hello", "hello"),
            ("getsentry/sentry", "sentry"),
        ]
        # link an issue
        data = {"params": {"repo": "getsentry/hello"}}
        assert event.group is not None
        resp = self.install.get_link_issue_config(group=event.group, **data)
        assert resp[0]["choices"] == [
            ("getsentry/hello", "hello"),
            ("getsentry/sentry", "sentry"),
        ]

    @responses.activate
    def test_linked_issue_comment(self):
        issue_event = self.store_event(
            data={"event_id": "a" * 32, "timestamp": self.min_ago}, project_id=self.project.id
        )
        feedback_issue = self.create_group(project=self.project, type=FeedbackGroup.type_id)

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

        # link an issue
        data = {"params": {"repo": "getsentry/hello"}}
        assert issue_event.group is not None
        resp = self.install.get_link_issue_config(group=issue_event.group, **data)
        # assert comment wording for linked issue is correct
        assert "Sentry Issue" in resp[2]["default"]

        # link a feedback issue
        resp = self.install.get_link_issue_config(group=feedback_issue, **data)
        # assert comment wording for linked feedback is correct
        assert "Sentry Feedback" in resp[2]["default"]

        # ensure linked comment is a string
        assert isinstance(resp[1]["default"], str)
        assert isinstance(resp[0]["default"], str)

    @responses.activate
    def after_link_issue(self):
        responses.add(
            responses.POST,
            "https://api.github.com/repos/getsentry/sentry/issues/321/comments",
            json={"body": "hello"},
        )

        data = {"comment": "hello"}
        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            key="hello#321",
        )

        self.install.after_link_issue(external_issue, data=data)

        request = responses.calls[0].request
        assert request.headers["Authorization"] == b"Bearer jwt_token_1"

        request = responses.calls[1].request
        assert request.headers["Authorization"] == "Bearer token_1"
        payload = orjson.loads(request.body)
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
        assert self.install.org_integration is not None
        integration_service.update_organization_integration(
            org_integration_id=self.install.org_integration.id,
            config={
                "project_issue_defaults": {str(group.project_id): {"repo": "getsentry/sentry"}}
            },
        )
        fields = self.install.get_link_issue_config(group)
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
        assert self.install.org_integration is not None
        integration_service.update_organization_integration(
            org_integration_id=self.install.org_integration.id,
            config={
                "project_issue_defaults": {str(group.project_id): {"repo": "getsentry/sentry"}}
            },
        )
        fields = self.install.get_create_issue_config(group, self.user)
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
        assert event.group is not None
        fields = self.install.get_link_issue_config(event.group)
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
        fields = self.install.get_create_issue_config(event.group, self.user)
        repo_field = [field for field in fields if field["name"] == "repo"][0]
        assignee_field = [field for field in fields if field["name"] == "assignee"][0]

        assert repo_field["default"] == ""
        assert repo_field["choices"] == []
        assert assignee_field["default"] == ""
        assert assignee_field["choices"] == []
