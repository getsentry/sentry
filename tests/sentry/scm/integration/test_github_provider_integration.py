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
        self.provider = map_integration_to_provider(
            self.organization.id, self.integration, self.repository
        )

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

        comments = self.provider.get_issue_comments("1347")

        assert len(comments) == 1
        assert comments[0]["data"]["id"] == "1"
        assert comments[0]["data"]["body"] == "Me too"
        assert comments[0]["data"]["author"] is not None
        assert comments[0]["data"]["author"]["id"] == "1"
        assert comments[0]["data"]["author"]["username"] == "octocat"

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

        self.provider.create_issue_comment("1", "hello")

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

        result = self.provider.get_pull_request("1347")

        pr = result["data"]
        assert pr["head"]["sha"] == "6dcb09b5b57875f334f61aebed695e2e4193db5e"

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_get_pull_request_comments(self, mock_get_jwt):
        responses.add(
            method=responses.GET,
            url="https://api.github.com/rate_limit",
            json={
                "resources": {
                    "graphql": {"limit": 5000, "remaining": 4999, "reset": 9999999999, "used": 1}
                }
            },
        )
        responses.add(
            method=responses.POST,
            url="https://api.github.com/graphql",
            json={
                "data": {
                    "repository": {
                        "pullRequest": {
                            "comments": {
                                "nodes": [
                                    {
                                        "id": "IC_10",
                                        "body": "Great stuff!",
                                        "isMinimized": False,
                                        "author": {
                                            "login": "octocat",
                                            "databaseId": 1,
                                            "__typename": "User",
                                        },
                                    }
                                ],
                                "pageInfo": {"hasNextPage": False, "endCursor": None},
                            },
                            "reviewThreads": {
                                "nodes": [],
                                "pageInfo": {"hasNextPage": False, "endCursor": None},
                            },
                        }
                    }
                }
            },
        )

        result = self.provider.get_pull_request_comments("1")

        assert len(result) == 1
        assert result[0]["data"]["id"] == "IC_10"
        assert result[0]["data"]["body"] == "Great stuff!"
        assert result[0]["data"]["author"] is not None
        assert result[0]["data"]["author"]["id"] == "1"
        assert result[0]["data"]["author"]["username"] == "octocat"
        assert result[0]["type"] == "github"

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_get_issue_comment_reactions(self, mock_get_jwt):
        responses.add(
            method=responses.GET,
            url=f"https://api.github.com/repos/{REPO_NAME}/issues/comments/42/reactions?per_page=100",
            json=[
                {
                    "id": 1,
                    "user": {
                        "login": "octocat",
                        "id": 1,
                    },
                    "content": "+1",
                },
                {
                    "id": 2,
                    "user": {
                        "login": "hubot",
                        "id": 2,
                    },
                    "content": "eyes",
                },
            ],
            headers={},
        )

        reactions = self.provider.get_issue_comment_reactions("42")

        assert len(reactions) == 2
        assert reactions[0]["data"]["id"] == "1"
        assert reactions[0]["data"]["content"] == "+1"
        assert reactions[0]["data"]["author"] is not None
        assert reactions[0]["data"]["author"]["username"] == "octocat"
        assert reactions[1]["data"]["id"] == "2"
        assert reactions[1]["data"]["content"] == "eyes"

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_create_issue_comment_reaction(self, mock_get_jwt):
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

        self.provider.create_issue_comment_reaction("42", "heart")

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

        reactions = self.provider.get_issue_reactions("42")

        assert len(reactions) == 2
        assert reactions[0]["data"]["id"] == "1"
        assert reactions[0]["data"]["content"] == "heart"
        assert reactions[0]["data"]["author"] is not None
        assert reactions[0]["data"]["author"]["id"] == "1"
        assert reactions[0]["data"]["author"]["username"] == "octocat"
        assert reactions[1]["data"]["id"] == "2"
        assert reactions[1]["data"]["content"] == "+1"
        assert reactions[1]["data"]["author"] is not None
        assert reactions[1]["data"]["author"]["id"] == "2"
        assert reactions[1]["data"]["author"]["username"] == "hubot"

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

        self.provider.create_issue_reaction("42", "rocket")

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
            self.provider.get_issue_comments("42")

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_api_500_error_raises_scm_provider_exception(self, mock_get_jwt):
        responses.add(
            method=responses.GET,
            url=f"https://api.github.com/repos/{REPO_NAME}/issues/42/comments",
            status=500,
            json={"message": "Internal Server Error"},
        )

        with pytest.raises(SCMProviderException):
            self.provider.get_issue_comments("42")

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_api_403_error_raises_scm_provider_exception(self, mock_get_jwt):
        responses.add(
            method=responses.GET,
            url=f"https://api.github.com/repos/{REPO_NAME}/pulls/1",
            status=403,
            json={"message": "Forbidden"},
        )

        with pytest.raises(SCMProviderException):
            self.provider.get_pull_request("1")

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_api_422_error_raises_scm_provider_exception(self, mock_get_jwt):
        responses.add(
            method=responses.POST,
            url=f"https://api.github.com/repos/{REPO_NAME}/pulls",
            status=422,
            json={"message": "Validation Failed", "errors": [{"message": "head already exists"}]},
        )

        with pytest.raises(SCMProviderException):
            self.provider.create_pull_request(
                title="Test", body="body", head="feature", base="main"
            )

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_get_commit(self, mock_get_jwt):
        sha = "abc123def456"
        responses.add(
            method=responses.GET,
            url=f"https://api.github.com/repos/{REPO_NAME}/commits/{sha}",
            json={
                "sha": sha,
                "commit": {
                    "message": "Fix bug",
                    "author": {
                        "name": "Test User",
                        "email": "test@example.com",
                        "date": "2026-02-04T10:00:00Z",
                    },
                },
                "files": [
                    {
                        "filename": "src/main.py",
                        "status": "modified",
                        "patch": "@@ -1 +1 @@\n-old\n+new",
                    }
                ],
            },
        )

        result = self.provider.get_commit(sha)

        commit = result["data"]
        assert commit["sha"] == sha
        assert commit["message"] == "Fix bug"
        assert commit["author"] is not None
        assert commit["author"]["name"] == "Test User"
        assert len(commit["files"]) == 1
        assert commit["files"][0]["filename"] == "src/main.py"
        assert commit["files"][0]["status"] == "modified"

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_get_branch(self, mock_get_jwt):
        responses.add(
            method=responses.GET,
            url=f"https://api.github.com/repos/{REPO_NAME}/branches/main",
            json={
                "name": "main",
                "commit": {"sha": "abc123def456"},
            },
        )

        result = self.provider.get_branch("main")

        ref = result["data"]
        assert ref["sha"] == "abc123def456"

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_get_pull_request_files(self, mock_get_jwt):
        responses.add(
            method=responses.GET,
            url=f"https://api.github.com/repos/{REPO_NAME}/pulls/1/files",
            json=[
                {
                    "filename": "src/main.py",
                    "status": "modified",
                    "patch": "@@ -1 +1 @@",
                    "changes": 2,
                    "sha": "abc123",
                },
                {
                    "filename": "src/new_file.py",
                    "status": "added",
                    "patch": "@@ -0,0 +1 @@\n+new",
                    "changes": 1,
                    "sha": "def456",
                },
            ],
        )

        result = self.provider.get_pull_request_files("1")

        assert len(result) == 2
        assert result[0]["data"]["filename"] == "src/main.py"
        assert result[0]["data"]["status"] == "modified"
        assert result[1]["data"]["filename"] == "src/new_file.py"
        assert result[1]["data"]["status"] == "added"

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_create_pull_request(self, mock_get_jwt):
        responses.add(
            method=responses.POST,
            url=f"https://api.github.com/repos/{REPO_NAME}/pulls",
            status=201,
            json={
                "id": 1,
                "number": 42,
                "title": "New Feature",
                "body": "Description",
                "state": "open",
                "merged": False,
                "url": f"https://api.github.com/repos/{REPO_NAME}/pulls/42",
                "html_url": f"https://github.com/{REPO_NAME}/pull/42",
                "head": {"ref": "feature", "sha": "abc123"},
                "base": {"ref": "main", "sha": "def456"},
            },
        )

        result = self.provider.create_pull_request(
            title="New Feature", body="Description", head="feature", base="main"
        )

        pr = result["data"]
        assert pr["number"] == 42
        assert pr["title"] == "New Feature"
        assert pr["state"] == "open"
        assert pr["head"]["ref"] == "feature"

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_get_pull_request_comments_with_databaseid(self, mock_get_jwt):
        """Verify GraphQL author databaseId is used as the author id."""
        responses.add(
            method=responses.GET,
            url="https://api.github.com/rate_limit",
            json={
                "resources": {
                    "graphql": {"limit": 5000, "remaining": 4999, "reset": 9999999999, "used": 1}
                }
            },
        )
        responses.add(
            method=responses.POST,
            url="https://api.github.com/graphql",
            json={
                "data": {
                    "repository": {
                        "pullRequest": {
                            "comments": {
                                "nodes": [
                                    {
                                        "id": "IC_10",
                                        "body": "Great stuff!",
                                        "isMinimized": False,
                                        "author": {
                                            "login": "octocat",
                                            "databaseId": 42,
                                            "__typename": "User",
                                        },
                                    }
                                ],
                                "pageInfo": {"hasNextPage": False, "endCursor": None},
                            },
                            "reviewThreads": {
                                "nodes": [],
                                "pageInfo": {"hasNextPage": False, "endCursor": None},
                            },
                        }
                    }
                }
            },
        )

        result = self.provider.get_pull_request_comments("1")

        assert len(result) == 1
        author = result[0]["data"]["author"]
        assert author is not None
        assert author["id"] == "42"
        assert author["username"] == "octocat"

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_delete_issue_comment(self, mock_get_jwt):
        responses.add(
            method=responses.DELETE,
            url=f"https://api.github.com/repos/{REPO_NAME}/issues/comments/123",
            status=204,
        )

        self.provider.delete_issue_comment("123")

        assert len(responses.calls) == 1

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_delete_issue_comment_reaction(self, mock_get_jwt):
        responses.add(
            method=responses.DELETE,
            url=f"https://api.github.com/repos/{REPO_NAME}/issues/comments/42/reactions/1",
            status=204,
        )

        self.provider.delete_issue_comment_reaction("42", "1")

        assert len(responses.calls) == 1

    def test_repository_conversion_preserves_fields(self):
        assert self.repository["name"] == REPO_NAME
        assert self.repository["organization_id"] == self.organization.id
        assert self.repository["integration_id"] == self.integration.id
        assert self.repository["status"] == ObjectStatus.ACTIVE
