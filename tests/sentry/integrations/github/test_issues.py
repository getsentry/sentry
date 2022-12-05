from unittest.mock import patch

import responses
from django.test import RequestFactory
from exam import fixture

from sentry.event_manager import EventManager
from sentry.integrations.github.integration import GitHubIntegration
from sentry.integrations.github.issues import GitHubIssueBasic
from sentry.models import ExternalIssue, Integration
from sentry.testutils import TestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test
from sentry.types.issues import GroupType
from sentry.utils import json
from sentry.utils.samples import load_data


@region_silo_test
class GitHubIssueBasicTest(TestCase):
    @fixture
    def request(self):
        return RequestFactory()

    def setUp(self):
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
        self.model = Integration.objects.create(
            provider="github", external_id="github_external_id", name="getsentry"
        )
        self.model.add_organization(self.organization, self.user)
        self.integration = GitHubIntegration(self.model, self.organization.id)
        self.min_ago = iso_format(before_now(minutes=1))

    @responses.activate
    @patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    def test_get_allowed_assignees(self, mock_get_jwt):
        responses.add(
            responses.POST,
            "https://api.github.com/app/installations/github_external_id/access_tokens",
            json={"token": "token_1", "expires_at": "2018-10-11T22:14:10Z"},
        )

        responses.add(
            responses.GET,
            "https://api.github.com/repos/getsentry/sentry/assignees",
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
    @patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    def test_create_issue(self, mock_get_jwt):
        responses.add(
            responses.POST,
            "https://api.github.com/app/installations/github_external_id/access_tokens",
            json={"token": "token_1", "expires_at": "2018-10-11T22:14:10Z"},
        )

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
        request = responses.calls[0].request
        assert request.headers["Authorization"] == "Bearer jwt_token_1"

        request = responses.calls[1].request
        assert request.headers["Authorization"] == "token token_1"
        payload = json.loads(request.body)
        assert payload == {"body": "This is the description", "assignee": None, "title": "hello"}

    def test_performance_issues_description(self):
        """Test that a GitHub issue created from a performance issue has span evidence data in its description"""
        event_data = load_data(
            "transaction-n-plus-one",
            timestamp=before_now(minutes=10),
            fingerprint=[f"{GroupType.PERFORMANCE_N_PLUS_ONE.value}-group1"],
        )
        perf_event_manager = EventManager(event_data)
        perf_event_manager.normalize()
        with override_options(
            {
                "performance.issues.all.problem-creation": 1.0,
                "performance.issues.all.problem-detection": 1.0,
                "performance.issues.n_plus_one_db.problem-creation": 1.0,
            }
        ), self.feature(
            [
                "organizations:performance-issues-ingest",
                "projects:performance-suspect-spans-ingestion",
            ]
        ):
            event = perf_event_manager.save(self.project.id)
        event = event.for_group(event.groups[0])

        description = GitHubIssueBasic().get_group_description(event.group, event)
        assert "db - SELECT `books_author`.`id`, `books_author" in description
        title = GitHubIssueBasic().get_group_title(event.group, event)
        assert (
            title
            == 'N+1 Query: SELECT "books_author"."id", "books_author"."name" FROM "books_author" WHERE "books_author"."id" = %s LIMIT 21'
        )

    def test_error_issues_description(self):
        """Test that a GitHub issue created from an error issue has message  data in its description"""
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "oh no",
                "timestamp": iso_format(before_now(minutes=1)),
            },
            project_id=self.project.id,
        )

        description = GitHubIssueBasic().get_group_description(event.group, event)
        assert "oh no" in description

    @responses.activate
    @patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    def test_get_repo_issues(self, mock_get_jwt):
        responses.add(
            responses.POST,
            "https://api.github.com/app/installations/github_external_id/access_tokens",
            json={"token": "token_1", "expires_at": "2018-10-11T22:14:10Z"},
        )

        responses.add(
            responses.GET,
            "https://api.github.com/repos/getsentry/sentry/issues",
            json=[{"number": 321, "title": "hello", "body": "This is the description"}],
        )
        repo = "getsentry/sentry"
        assert self.integration.get_repo_issues(repo) == ((321, "#321 hello"),)

        request = responses.calls[0].request
        assert request.headers["Authorization"] == "Bearer jwt_token_1"

        request = responses.calls[1].request
        assert request.headers["Authorization"] == "token token_1"

    @responses.activate
    @patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    def test_link_issue(self, mock_get_jwt):
        issue_id = 321
        responses.add(
            responses.POST,
            "https://api.github.com/app/installations/github_external_id/access_tokens",
            json={"token": "token_1", "expires_at": "2018-10-11T22:14:10Z"},
        )

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
        request = responses.calls[0].request
        assert request.headers["Authorization"] == "Bearer jwt_token_1"

        request = responses.calls[1].request
        assert request.headers["Authorization"] == "token token_1"

    @responses.activate
    @patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    def test_repo_dropdown_choices(self, mock_get_jwt):
        event = self.store_event(
            data={"event_id": "a" * 32, "timestamp": self.min_ago}, project_id=self.project.id
        )

        responses.add(
            responses.POST,
            "https://api.github.com/app/installations/github_external_id/access_tokens",
            json={"token": "token_1", "expires_at": "2018-10-11T22:14:10Z"},
        )

        responses.add(
            responses.GET,
            "https://api.github.com/repos/getsentry/sentry/assignees",
            json=[{"login": "MeredithAnya"}],
        )

        responses.add(
            responses.GET,
            "https://api.github.com/installation/repositories",
            json={
                "repositories": [
                    {"full_name": "getsentry/sentry", "name": "sentry"},
                    {"full_name": "getsentry/other", "name": "other", "archived": True},
                ]
            },
        )

        resp = self.integration.get_create_issue_config(group=event.group, user=self.user)
        assert resp[0]["choices"] == [("getsentry/sentry", "sentry")]

        responses.add(
            responses.GET,
            "https://api.github.com/repos/getsentry/hello/assignees",
            json=[{"login": "MeredithAnya"}],
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
    @patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    def after_link_issue(self, mock_get_jwt):
        responses.add(
            responses.POST,
            "https://api.github.com/app/installations/github_external_id/access_tokens",
            json={"token": "token_1", "expires_at": "2018-10-11T22:14:10Z"},
        )

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
        assert request.headers["Authorization"] == "token token_1"
        payload = json.loads(request.body)
        assert payload == {"body": "hello"}

    @responses.activate
    @patch(
        "sentry.integrations.github.client.GitHubClientMixin.get_token", return_value="jwt_token_1"
    )
    def test_default_repo_link_fields(self, mock_get_jwt):
        responses.add(
            responses.GET,
            "https://api.github.com/installation/repositories",
            json={"repositories": [{"name": "sentry", "full_name": "getsentry/sentry"}]},
        )
        event = self.store_event(
            data={"event_id": "a" * 32, "timestamp": self.min_ago}, project_id=self.project.id
        )
        group = event.group

        org_integration = self.integration.org_integration
        org_integration.config = {
            "project_issue_defaults": {str(group.project_id): {"repo": "getsentry/sentry"}}
        }
        org_integration.save()
        fields = self.integration.get_link_issue_config(group)
        for field in fields:
            if field["name"] == "repo":
                repo_field = field
                break
        assert repo_field["default"] == "getsentry/sentry"

    @responses.activate
    @patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    def test_default_repo_create_fields(self, mock_get_jwt):
        responses.add(
            responses.GET,
            "https://api.github.com/installation/repositories",
            json={"repositories": [{"name": "sentry", "full_name": "getsentry/sentry"}]},
        )
        responses.add(
            responses.GET,
            "https://api.github.com/repos/getsentry/sentry/assignees",
            json=[{"login": "MeredithAnya"}],
        )
        responses.add(
            responses.POST,
            "https://api.github.com/app/installations/github_external_id/access_tokens",
            json={"token": "token_1", "expires_at": "2018-10-11T22:14:10Z"},
        )
        event = self.store_event(
            data={"event_id": "a" * 32, "timestamp": self.min_ago}, project_id=self.project.id
        )
        group = event.group
        org_integration = self.integration.org_integration
        org_integration.config = {
            "project_issue_defaults": {str(group.project_id): {"repo": "getsentry/sentry"}}
        }
        org_integration.save()
        fields = self.integration.get_create_issue_config(group, self.user)
        for field in fields:
            if field["name"] == "repo":
                repo_field = field
                break
        assert repo_field["default"] == "getsentry/sentry"

    @responses.activate
    @patch(
        "sentry.integrations.github.client.GitHubClientMixin.get_token", return_value="jwt_token_1"
    )
    def test_default_repo_link_fields_no_repos(self, mock_get_jwt):
        responses.add(
            responses.GET,
            "https://api.github.com/installation/repositories",
            json={"repositories": []},
        )
        event = self.store_event(
            data={"event_id": "a" * 32, "timestamp": self.min_ago}, project_id=self.project.id
        )
        fields = self.integration.get_link_issue_config(event.group)
        repo_field = [field for field in fields if field["name"] == "repo"][0]
        assert repo_field["default"] == ""
        assert repo_field["choices"] == []

    @responses.activate
    @patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    def test_default_repo_create_fields_no_repos(self, mock_get_jwt):
        responses.add(
            responses.GET,
            "https://api.github.com/installation/repositories",
            json={"repositories": []},
        )
        responses.add(
            responses.POST,
            "https://api.github.com/app/installations/github_external_id/access_tokens",
            json={"token": "token_1", "expires_at": "2018-10-11T22:14:10Z"},
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
