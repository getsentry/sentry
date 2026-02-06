from datetime import timedelta
from unittest import mock

import pytest
import responses
from django.utils import timezone

from sentry.constants import ObjectStatus
from sentry.models.repository import Repository as RepositoryModel
from sentry.scm.errors import SCMProviderException
from sentry.scm.helpers import map_integration_to_provider, map_repository_model_to_repository
from sentry.testutils.cases import TestCase

REPO_NAME = "test-org/test-repo"


class TestGitHubProviderIntegration(TestCase):
    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    def setUp(self, mock_get_jwt):
        super().setUp()
        ten_days = timezone.now() + timedelta(days=10)
        self.integration = self.create_integration(
            organization=self.organization,
            provider="github",
            name="Test GitHub",
            external_id="12345",
            metadata={
                "access_token": "12345token",
                "expires_at": ten_days.strftime("%Y-%m-%dT%H:%M:%S"),
            },
        )
        self.repo_model = RepositoryModel.objects.create(
            organization_id=self.organization.id,
            name=REPO_NAME,
            provider="integrations:github",
            external_id="67890",
            integration_id=self.integration.id,
            status=ObjectStatus.ACTIVE,
        )
        self.repository = map_repository_model_to_repository(self.repo_model)
        self.provider = map_integration_to_provider(self.organization.id, self.integration)

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_get_issue_comments(self, mock_get_jwt):
        responses.add(
            method=responses.GET,
            url=f"https://api.github.com/repos/{REPO_NAME}/issues/1347/comments",
            json=[
                {
                    "id": 1,
                    "node_id": "MDEyOklzc3VlQ29tbWVudDE=",
                    "url": f"https://api.github.com/repos/{REPO_NAME}/issues/comments/1",
                    "html_url": f"https://github.com/{REPO_NAME}/issues/1347#issuecomment-1",
                    "body": "Me too",
                    "user": {
                        "login": "octocat",
                        "id": 1,
                        "node_id": "MDQ6VXNlcjE=",
                        "avatar_url": "https://github.com/images/error/octocat_happy.gif",
                        "type": "User",
                        "site_admin": False,
                    },
                    "created_at": "2011-04-14T16:00:49Z",
                    "updated_at": "2011-04-14T16:00:49Z",
                    "issue_url": f"https://api.github.com/repos/{REPO_NAME}/issues/1347",
                    "author_association": "COLLABORATOR",
                },
            ],
        )

        comments = self.provider.get_issue_comments(self.repository, "1347")

        assert len(comments) == 1
        assert comments[0]["comment"]["id"] == "1"
        assert comments[0]["comment"]["body"] == "Me too"
        assert comments[0]["comment"]["author"]["id"] == "1"
        assert comments[0]["comment"]["author"]["username"] == "octocat"

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_create_issue_comment(self, mock_get_jwt):
        responses.add(
            method=responses.POST,
            url=f"https://api.github.com/repos/{REPO_NAME}/issues/1/comments",
            status=201,
            json={
                "id": 1,
                "node_id": "MDEyOklzc3VlQ29tbWVudDE=",
                "url": f"https://api.github.com/repos/{REPO_NAME}/issues/comments/1",
                "html_url": f"https://github.com/{REPO_NAME}/issues/1#issuecomment-1",
                "body": "hello",
                "user": {
                    "login": "octocat",
                    "id": 1,
                    "node_id": "MDQ6VXNlcjE=",
                    "avatar_url": "https://github.com/images/error/octocat_happy.gif",
                    "type": "User",
                    "site_admin": False,
                },
                "created_at": "2023-05-23T17:00:00Z",
                "updated_at": "2023-05-23T17:00:00Z",
                "issue_url": f"https://api.github.com/repos/{REPO_NAME}/issues/1",
                "author_association": "COLLABORATOR",
            },
        )

        self.provider.create_issue_comment(self.repository, "1", "hello")

        assert len(responses.calls) == 1
        assert (
            responses.calls[0].request.url
            == f"https://api.github.com/repos/{REPO_NAME}/issues/1/comments"
        )

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_get_pull_request(self, mock_get_jwt):
        responses.add(
            method=responses.GET,
            url=f"https://api.github.com/repos/{REPO_NAME}/pulls/1347",
            json={
                "id": 1,
                "node_id": "MDExOlB1bGxSZXF1ZXN0MQ==",
                "url": f"https://api.github.com/repos/{REPO_NAME}/pulls/1347",
                "html_url": f"https://github.com/{REPO_NAME}/pull/1347",
                "number": 1347,
                "state": "open",
                "locked": False,
                "title": "Amazing new feature",
                "body": "Please pull these awesome changes in!",
                "user": {
                    "login": "octocat",
                    "id": 1,
                    "node_id": "MDQ6VXNlcjE=",
                    "avatar_url": "https://github.com/images/error/octocat_happy.gif",
                    "type": "User",
                    "site_admin": False,
                },
                "head": {
                    "label": "octocat:new-topic",
                    "ref": "new-topic",
                    "sha": "6dcb09b5b57875f334f61aebed695e2e4193db5e",
                },
                "base": {
                    "label": "octocat:master",
                    "ref": "master",
                    "sha": "6dcb09b5b57875f334f61aebed695e2e4193db5f",
                },
                "merged": False,
                "mergeable": True,
                "mergeable_state": "clean",
                "merged_by": None,
                "comments": 10,
                "review_comments": 0,
                "commits": 3,
                "additions": 100,
                "deletions": 3,
                "changed_files": 5,
            },
        )

        result = self.provider.get_pull_request(self.repository, "1347")

        pr = result["pull_request"]
        assert pr["head"]["sha"] == "6dcb09b5b57875f334f61aebed695e2e4193db5e"

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_get_pull_request_comments(self, mock_get_jwt):
        responses.add(
            method=responses.GET,
            url=f"https://api.github.com/repos/{REPO_NAME}/pulls/1/comments",
            json=[
                {
                    "url": f"https://api.github.com/repos/{REPO_NAME}/pulls/comments/1",
                    "pull_request_review_id": 42,
                    "id": 10,
                    "node_id": "MDI0OlB1bGxSZXF1ZXN0UmV2aWV3Q29tbWVudDEw",
                    "diff_hunk": "@@ -16,33 +16,40 @@ public class Connection : IConnection...",
                    "path": "file1.txt",
                    "commit_id": "6dcb09b5b57875f334f61aebed695e2e4193db5e",
                    "user": {
                        "login": "octocat",
                        "id": 1,
                        "node_id": "MDQ6VXNlcjE=",
                        "avatar_url": "https://github.com/images/error/octocat_happy.gif",
                        "type": "User",
                        "site_admin": False,
                    },
                    "body": "Great stuff!",
                    "created_at": "2011-04-14T16:00:49Z",
                    "updated_at": "2011-04-14T16:00:49Z",
                    "html_url": f"https://github.com/{REPO_NAME}/pull/1#discussion-diff-1",
                    "pull_request_url": f"https://api.github.com/repos/{REPO_NAME}/pulls/1",
                    "author_association": "NONE",
                },
            ],
        )

        comments = self.provider.get_pull_request_comments(self.repository, "1")

        assert len(comments) == 1
        assert comments[0]["comment"]["id"] == "10"
        assert comments[0]["comment"]["body"] == "Great stuff!"
        assert comments[0]["comment"]["author"]["username"] == "octocat"

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_get_comment_reactions(self, mock_get_jwt):
        responses.add(
            method=responses.GET,
            url=f"https://api.github.com/repos/{REPO_NAME}/issues/comments/42",
            json={
                "id": 42,
                "node_id": "MDEyOklzc3VlQ29tbWVudDQy",
                "body": "Test comment",
                "reactions": {
                    "url": f"https://api.github.com/repos/{REPO_NAME}/issues/comments/42/reactions",
                    "+1": 2,
                    "hooray": 1,
                    "eyes": 3,
                },
            },
        )

        reactions = self.provider.get_comment_reactions(self.repository, "42")

        assert reactions["+1"] == 2
        assert reactions["hooray"] == 1
        assert reactions["eyes"] == 3
        assert "url" not in reactions

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_create_comment_reaction(self, mock_get_jwt):
        responses.add(
            method=responses.POST,
            url=f"https://api.github.com/repos/{REPO_NAME}/issues/comments/42/reactions",
            status=201,
            json={
                "id": 1,
                "node_id": "MDg6UmVhY3Rpb24x",
                "user": {
                    "login": "octocat",
                    "id": 1,
                    "node_id": "MDQ6VXNlcjE=",
                    "avatar_url": "https://github.com/images/error/octocat_happy.gif",
                    "type": "User",
                    "site_admin": False,
                },
                "content": "heart",
                "created_at": "2016-05-20T20:09:31Z",
            },
        )

        self.provider.create_comment_reaction(self.repository, "42", "heart")

        assert len(responses.calls) == 1

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_get_issue_reactions(self, mock_get_jwt):
        responses.add(
            method=responses.GET,
            url=f"https://api.github.com/repos/{REPO_NAME}/issues/42/reactions?per_page=100",
            json=[
                {
                    "id": 1,
                    "node_id": "MDg6UmVhY3Rpb24x",
                    "user": {
                        "login": "octocat",
                        "id": 1,
                        "node_id": "MDQ6VXNlcjE=",
                        "avatar_url": "https://github.com/images/error/octocat_happy.gif",
                        "type": "User",
                        "site_admin": False,
                    },
                    "content": "heart",
                    "created_at": "2016-05-20T20:09:31Z",
                },
                {
                    "id": 2,
                    "node_id": "MDg6UmVhY3Rpb24y",
                    "user": {
                        "login": "hubot",
                        "id": 2,
                        "node_id": "MDQ6VXNlcjI=",
                        "avatar_url": "https://github.com/images/error/hubot_happy.gif",
                        "type": "User",
                        "site_admin": False,
                    },
                    "content": "+1",
                    "created_at": "2016-05-20T20:09:31Z",
                },
            ],
            headers={},
        )

        reactions = self.provider.get_issue_reactions(self.repository, "42")

        assert len(reactions) == 2
        assert reactions[0]["id"] == "1"
        assert reactions[0]["content"] == "heart"
        assert reactions[0]["author"]["id"] == "1"
        assert reactions[0]["author"]["username"] == "octocat"
        assert reactions[1]["id"] == "2"
        assert reactions[1]["content"] == "+1"
        assert reactions[1]["author"]["id"] == "2"
        assert reactions[1]["author"]["username"] == "hubot"

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_create_issue_reaction(self, mock_get_jwt):
        responses.add(
            method=responses.POST,
            url=f"https://api.github.com/repos/{REPO_NAME}/issues/42/reactions",
            status=201,
            json={
                "id": 1,
                "node_id": "MDg6UmVhY3Rpb24x",
                "user": {
                    "login": "octocat",
                    "id": 1,
                    "node_id": "MDQ6VXNlcjE=",
                    "avatar_url": "https://github.com/images/error/octocat_happy.gif",
                    "type": "User",
                    "site_admin": False,
                },
                "content": "rocket",
                "created_at": "2016-05-20T20:09:31Z",
            },
        )

        self.provider.create_issue_reaction(self.repository, "42", "rocket")

        assert len(responses.calls) == 1

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_api_error_raises_scm_provider_exception(self, mock_get_jwt):
        responses.add(
            method=responses.GET,
            url=f"https://api.github.com/repos/{REPO_NAME}/issues/42/comments",
            status=404,
            json={
                "message": "Not Found",
                "documentation_url": "https://docs.github.com/rest",
            },
        )

        with pytest.raises(SCMProviderException):
            self.provider.get_issue_comments(self.repository, "42")

    def test_repository_conversion_preserves_fields(self):
        assert self.repository["name"] == REPO_NAME
        assert self.repository["organization_id"] == self.organization.id
        assert self.repository["integration_id"] == self.integration.id
        assert self.repository["status"] == ObjectStatus.ACTIVE
