import pytest

from sentry.constants import ObjectStatus
from sentry.integrations.github.client import GitHubReaction
from sentry.models.repository import Repository as RepositoryModel
from sentry.scm.errors import SCMProviderException
from sentry.scm.helpers import map_repository_model_to_repository
from sentry.scm.private.providers.github import GitHubProvider
from sentry.testutils.cases import TestCase
from tests.sentry.scm.test_fixtures import (
    FakeGitHubApiClient,
    make_github_comment,
    make_github_pull_request,
    make_github_reaction,
)


class TestGitHubProviderIntegration(TestCase):
    def setUp(self):
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="github",
            name="Test GitHub",
            external_id="12345",
        )
        self.repo_model = RepositoryModel.objects.create(
            organization_id=self.organization.id,
            name="test-org/test-repo",
            provider="integrations:github",
            external_id="67890",
            integration_id=self.integration.id,
            status=ObjectStatus.ACTIVE,
        )
        self.repository = map_repository_model_to_repository(self.repo_model)

        self.github_client = FakeGitHubApiClient()
        self.provider = GitHubProvider(self.github_client)

    def test_get_issue_comments(self):
        self.github_client.issue_comments = [
            make_github_comment(comment_id=101, body="First comment", user_id=1, username="user1"),
            make_github_comment(comment_id=102, body="Second comment", user_id=2, username="user2"),
        ]

        comments = self.provider.get_issue_comments(self.repository, "42")

        assert len(comments) == 2
        assert comments[0]["id"] == "101"
        assert comments[0]["body"] == "First comment"
        assert comments[1]["id"] == "102"
        assert ("get_issue_comments", ("test-org/test-repo", "42"), {}) in self.github_client.calls

    def test_create_issue_comment(self):
        self.provider.create_issue_comment(self.repository, "42", "Test comment body")

        assert (
            "create_comment",
            ("test-org/test-repo", "42", {"body": "Test comment body"}),
            {},
        ) in self.github_client.calls

    def test_get_pull_request(self):
        self.github_client.pull_request_data = make_github_pull_request(
            pr_id=42,
            title="Fix bug",
            body="This fixes the bug",
            head_sha="abc123",
            base_sha="def456",
            head_ref="fix-branch",
            base_ref="main",
            user_id=99,
            username="developer",
        )

        pr = self.provider.get_pull_request(self.repository, "42")

        assert pr["id"] == "42"
        assert pr["title"] == "Fix bug"
        assert pr["description"] == "This fixes the bug"
        assert pr["head"]["sha"] == "abc123"
        assert pr["base"]["sha"] == "def456"
        assert ("get_pull_request", ("test-org/test-repo", "42"), {}) in self.github_client.calls

    def test_get_pull_request_comments(self):
        self.github_client.pull_request_comments = [
            make_github_comment(comment_id=201, body="PR review comment"),
        ]

        comments = self.provider.get_pull_request_comments(self.repository, "42")

        assert len(comments) == 1
        assert comments[0]["id"] == "201"
        assert comments[0]["body"] == "PR review comment"
        assert (
            "get_pull_request_comments",
            ("test-org/test-repo", "42"),
            {},
        ) in self.github_client.calls

    def test_get_comment_reactions(self):
        self.github_client.comment_reactions = [
            make_github_reaction(reaction_id=1, content="+1"),
            make_github_reaction(reaction_id=2, content="eyes"),
        ]

        reactions = self.provider.get_comment_reactions(self.repository, "101")

        assert len(reactions) == 2
        assert (
            "get_comment_reactions",
            ("test-org/test-repo", "101"),
            {},
        ) in self.github_client.calls

    def test_create_comment_reaction(self):
        self.provider.create_comment_reaction(self.repository, "101", "+1")

        assert (
            "create_comment_reaction",
            ("test-org/test-repo", "101", GitHubReaction.PLUS_ONE),
            {},
        ) in self.github_client.calls

    def test_get_issue_reactions(self):
        self.github_client.issue_reactions = [
            make_github_reaction(reaction_id=1, content="heart"),
            make_github_reaction(reaction_id=2, content="rocket"),
        ]

        reactions = self.provider.get_issue_reactions(self.repository, "42")

        assert len(reactions) == 2
        assert ("get_issue_reactions", ("test-org/test-repo", "42"), {}) in self.github_client.calls

    def test_create_issue_reaction(self):
        self.provider.create_issue_reaction(self.repository, "42", "rocket")

        assert (
            "create_issue_reaction",
            ("test-org/test-repo", "42", GitHubReaction.ROCKET),
            {},
        ) in self.github_client.calls

    def test_api_error_raises_scm_provider_exception(self):
        self.github_client.raise_api_error = True

        provider_methods = [
            ("get_issue_comments", {"issue_id": "42"}),
            ("create_issue_comment", {"issue_id": "42", "body": "test"}),
            ("delete_issue_comment", {"comment_id": "101"}),
            ("get_pull_request", {"pull_request_id": "42"}),
            ("get_pull_request_comments", {"pull_request_id": "42"}),
            ("create_pull_request_comment", {"pull_request_id": "42", "body": "test"}),
            ("delete_pull_request_comment", {"comment_id": "201"}),
            ("get_comment_reactions", {"comment_id": "101"}),
            ("create_comment_reaction", {"comment_id": "101", "reaction": "+1"}),
            ("delete_comment_reaction", {"comment_id": "101", "reaction_id": "999"}),
            ("get_issue_reactions", {"issue_id": "42"}),
            ("create_issue_reaction", {"issue_id": "42", "reaction": "rocket"}),
            ("delete_issue_reaction", {"issue_id": "42", "reaction_id": "999"}),
        ]

        for method_name, kwargs in provider_methods:
            with pytest.raises(SCMProviderException):
                getattr(self.provider, method_name)(self.repository, **kwargs)

    def test_repository_conversion_preserves_fields(self):
        assert self.repository["name"] == "test-org/test-repo"
        assert self.repository["organization_id"] == self.organization.id
        assert self.repository["integration_id"] == self.integration.id
        assert self.repository["status"] == ObjectStatus.ACTIVE
