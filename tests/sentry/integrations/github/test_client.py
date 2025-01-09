import re
from dataclasses import asdict
from datetime import UTC, datetime, timedelta
from unittest import mock

import orjson
import pytest
import responses
from django.core import mail
from django.test import override_settings
from django.utils import timezone
from requests import Request
from responses import matchers

from sentry.constants import ObjectStatus
from sentry.integrations.github.blame import create_blame_query, generate_file_path_mapping
from sentry.integrations.github.client import GitHubApiClient
from sentry.integrations.github.integration import GitHubIntegration
from sentry.integrations.notify_disable import notify_disable
from sentry.integrations.request_buffer import IntegrationRequestBuffer
from sentry.integrations.source_code_management.commit_context import (
    CommitInfo,
    FileBlameInfo,
    SourceLineInfo,
)
from sentry.integrations.types import EventLifecycleOutcome
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiError, ApiRateLimitedError
from sentry.shared_integrations.response.base import BaseApiResponse
from sentry.silo.base import SiloMode
from sentry.silo.util import PROXY_BASE_PATH, PROXY_OI_HEADER, PROXY_SIGNATURE_HEADER
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.integrations import get_installation_of_type
from sentry.testutils.silo import control_silo_test
from sentry.utils.cache import cache
from tests.sentry.integrations.test_helpers import add_control_silo_proxy_response

GITHUB_CODEOWNERS = {
    "filepath": "CODEOWNERS",
    "html_url": "https://github.com/org/reponame/CODEOWNERS",
    "raw": "docs/*    @NisanthanNanthakumar   @getsentry/ecosystem\n* @NisanthanNanthakumar\n",
}


class GitHubApiClientTest(TestCase):
    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    def setUp(self, get_jwt):
        ten_days = timezone.now() + timedelta(days=10)
        self.integration = self.create_integration(
            organization=self.organization,
            provider="github",
            name="Github Test Org",
            external_id="1",
            metadata={
                "access_token": "12345token",
                "expires_at": ten_days.strftime("%Y-%m-%dT%H:%M:%S"),
            },
        )
        self.repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="Test-Organization/foo",
            url="https://github.com/Test-Organization/foo",
            provider="integrations:github",
            external_id=123,
            integration_id=self.integration.id,
        )
        self.install = get_installation_of_type(
            GitHubIntegration, self.integration, self.organization.id
        )
        self.github_client = self.install.get_client()

    @responses.activate
    def test_get_rate_limit(self):
        responses.add(
            method=responses.GET,
            url="https://api.github.com/rate_limit",
            json={
                "resources": {
                    "core": {"limit": 5000, "remaining": 4999, "reset": 1372700873, "used": 1},
                    "search": {"limit": 30, "remaining": 18, "reset": 1372697452, "used": 12},
                    "graphql": {"limit": 5000, "remaining": 4993, "reset": 1372700389, "used": 7},
                },
            },
        )
        with mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1"):
            gh_rate_limit = self.github_client.get_rate_limit()
            assert gh_rate_limit.limit == 5000
            assert gh_rate_limit.remaining == 4999
            assert gh_rate_limit.used == 1
            assert gh_rate_limit.next_window() == "17:47:53"

            gh_rate_limit = self.github_client.get_rate_limit("search")
            assert gh_rate_limit.limit == 30
            assert gh_rate_limit.remaining == 18
            assert gh_rate_limit.used == 12
            assert gh_rate_limit.next_window() == "16:50:52"

            gh_rate_limit = self.github_client.get_rate_limit("graphql")
            assert gh_rate_limit.limit == 5000
            assert gh_rate_limit.remaining == 4993
            assert gh_rate_limit.used == 7
            assert gh_rate_limit.next_window() == "17:39:49"

    @responses.activate
    def test_get_rate_limit_non_existent_resource(self):
        with pytest.raises(AssertionError):
            self.github_client.get_rate_limit("foo")

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_check_file(self, get_jwt):
        path = "src/sentry/integrations/github/client.py"
        version = "master"
        url = f"https://api.github.com/repos/{self.repo.name}/contents/{path}?ref={version}"

        responses.add(
            method=responses.HEAD,
            url=url,
            json={"text": 200},
        )

        resp = self.github_client.check_file(self.repo, path, version)
        assert isinstance(resp, BaseApiResponse)
        assert resp.status_code == 200

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_check_no_file(self, get_jwt):
        path = "src/santry/integrations/github/client.py"
        version = "master"
        url = f"https://api.github.com/repos/{self.repo.name}/contents/{path}?ref={version}"

        responses.add(method=responses.HEAD, url=url, status=404)

        with pytest.raises(ApiError):
            self.github_client.check_file(self.repo, path, version)
        assert responses.calls[0].response.status_code == 404

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @responses.activate
    def test_get_stacktrace_link(self, mock_record, get_jwt):
        path = "/src/sentry/integrations/github/client.py"
        version = "master"
        url = "https://api.github.com/repos/{}/contents/{}?ref={}".format(
            self.repo.name, path.lstrip("/"), version
        )

        responses.add(
            method=responses.HEAD,
            url=url,
            json={"text": 200},
        )

        source_url = self.install.get_stacktrace_link(self.repo, path, "master", version)
        assert (
            source_url
            == "https://github.com/Test-Organization/foo/blob/master/src/sentry/integrations/github/client.py"
        )
        assert (
            len(mock_record.mock_calls) == 4
        )  # get_stacktrace_link calls check_file, which also has metrics
        start1, start2, halt1, halt2 = mock_record.mock_calls
        assert start1.args[0] == EventLifecycleOutcome.STARTED
        assert start2.args[0] == EventLifecycleOutcome.STARTED  # check_file
        assert halt1.args[0] == EventLifecycleOutcome.SUCCESS  # check_file
        assert halt2.args[0] == EventLifecycleOutcome.SUCCESS

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_get_with_pagination(self, get_jwt):
        url = f"https://api.github.com/repos/{self.repo.name}/assignees?per_page={self.github_client.page_size}"

        responses.add(
            method=responses.GET,
            url=url,
            json={"text": 200},
            headers={"link": f'<{url}&page=2>; rel="next", <{url}&page=4>; rel="last"'},
        )
        # For simplicity, we're skipping the `first` and `prev` links from the following responses
        responses.add(
            method=responses.GET,
            url=f"{url}&page=2",
            json={"text": 200},
            headers={"link": f'<{url}&page=3>; rel="next", <{url}&page=4>; rel="last"'},
        )
        responses.add(
            method=responses.GET,
            url=f"{url}&page=3",
            json={"text": 200},
            headers={"link": f'<{url}&page=4>; rel="next", <{url}&page=4>; rel="last"'},
        )
        responses.add(
            method=responses.GET,
            url=f"{url}&page=4",
            json={"text": 200},
            # To help understanding, the last page only contains the `first` and `prev` links
            # The code only cares about the `next` value which is not included here
            headers={"link": f'<{url}&page=1>; rel="first", <{url}&page=3>; rel="prev"'},
        )
        self.github_client.get_with_pagination(f"/repos/{self.repo.name}/assignees")
        assert len(responses.calls) == 4
        assert responses.calls[0].response.status_code == 200

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_get_with_pagination_only_one_page(self, get_jwt):
        url = f"https://api.github.com/repos/{self.repo.name}/assignees?per_page={self.github_client.page_size}"

        # No link in the headers because there are no more pages
        responses.add(method=responses.GET, url=url, json={}, headers={})
        self.github_client.get_with_pagination(f"/repos/{self.repo.name}/assignees")
        assert len(responses.calls) == 1
        assert responses.calls[0].response.status_code == 200

    @mock.patch(
        "sentry.integrations.github.integration.GitHubIntegration.check_file",
        return_value=GITHUB_CODEOWNERS["html_url"],
    )
    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @responses.activate
    def test_get_codeowner_file(self, mock_record, mock_jwt, mock_check_file):
        self.config = self.create_code_mapping(
            repo=self.repo,
            project=self.project,
        )

        responses.add(
            method=responses.GET,
            url=f"https://api.github.com/repos/{self.repo.name}/contents/CODEOWNERS?ref=master",
            body="docs/*    @NisanthanNanthakumar   @getsentry/ecosystem\n* @NisanthanNanthakumar\n",
        )
        result = self.install.get_codeowner_file(
            self.config.repository, ref=self.config.default_branch
        )
        assert (
            responses.calls[0].request.headers["Content-Type"] == "application/raw; charset=utf-8"
        )
        assert result == GITHUB_CODEOWNERS
        assert (
            len(mock_record.mock_calls) == 2
        )  # check_file is mocked in this test, so there will be no metrics logged for it
        assert mock_record.mock_calls[0].args[0] == EventLifecycleOutcome.STARTED
        assert mock_record.mock_calls[1].args[0] == EventLifecycleOutcome.SUCCESS

    @responses.activate
    def test_get_cached_repo_files_caching_functionality(self):
        """Fetch files for repo. Test caching logic."""
        responses.add(
            method=responses.GET,
            url=f"https://api.github.com/repos/{self.repo.name}/git/trees/master?recursive=1",
            status=200,
            json={"tree": [{"path": "src/foo.py", "type": "blob"}], "truncated": False},
        )
        repo_key = f"github:repo:{self.repo.name}:source-code"
        assert cache.get(repo_key) is None
        with mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1"):
            files = self.github_client.get_cached_repo_files(self.repo.name, "master")
            assert cache.get(repo_key) == files
            # Calling a second time should work
            files = self.github_client.get_cached_repo_files(self.repo.name, "master")
            assert cache.get(repo_key) == files
            # Calling again after the cache has been cleared should still work
            cache.delete(repo_key)
            files = self.github_client.get_cached_repo_files(self.repo.name, "master")
            assert cache.get(repo_key) == files

    @responses.activate
    def test_get_cached_repo_files_with_all_files(self):
        """Fetch files for repo. All files rather than just source code files"""
        responses.add(
            method=responses.GET,
            url=f"https://api.github.com/repos/{self.repo.name}/git/trees/master?recursive=1",
            status=200,
            json={
                "tree": [
                    {"type": "blob", "path": "src/foo.py"},
                    {"type": "blob", "path": "README"},
                ]
            },
        )
        repo_key = f"github:repo:{self.repo.name}:all"
        assert cache.get(repo_key) is None
        with mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1"):
            files = self.github_client.get_cached_repo_files(self.repo.name, "master")
            assert files == ["src/foo.py"]

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_update_comment(self, get_jwt):
        responses.add(
            method=responses.POST,
            url=f"https://api.github.com/repos/{self.repo.name}/issues/1/comments",
            status=201,
            json={
                "id": 1,
                "node_id": "MDEyOklzc3VlQ29tbWVudDE=",
                "url": f"https://api.github.com/repos/{self.repo.name}/issues/comments/1",
                "html_url": f"https://github.com/{self.repo.name}/issues/1#issuecomment-1",
                "body": "hello",
                "created_at": "2023-05-23T17:00:00Z",
                "updated_at": "2023-05-23T17:00:00Z",
                "issue_url": f"https://api.github.com/repos/{self.repo.name}/issues/1",
                "author_association": "COLLABORATOR",
            },
        )
        self.github_client.create_comment(repo=self.repo.name, issue_id="1", data={"body": "hello"})

        responses.add(
            method=responses.PATCH,
            url=f"https://api.github.com/repos/{self.repo.name}/issues/comments/1",
            json={
                "id": 1,
                "node_id": "MDEyOklzc3VlQ29tbWVudDE=",
                "url": f"https://api.github.com/repos/{self.repo.name}/issues/comments/1",
                "html_url": f"https://github.com/{self.repo.name}/issues/1#issuecomment-1",
                "body": "world",
                "created_at": "2011-04-14T16:00:49Z",
                "updated_at": "2011-04-14T16:00:49Z",
                "issue_url": f"https://api.github.com/repos/{self.repo.name}/issues/1",
                "author_association": "COLLABORATOR",
            },
        )

        self.github_client.update_comment(
            repo=self.repo.name, issue_id="1", comment_id="1", data={"body": "world"}
        )
        assert responses.calls[1].response.status_code == 200
        assert responses.calls[1].request.body == b'{"body": "world"}'

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_get_comment_reactions(self, get_jwt):
        comment_reactions = {
            "reactions": {
                "url": "abcdef",
                "hooray": 1,
                "+1": 2,
                "-1": 0,
            }
        }
        responses.add(
            responses.GET,
            f"https://api.github.com/repos/{self.repo.name}/issues/comments/2",
            json=comment_reactions,
        )

        reactions = self.github_client.get_comment_reactions(repo=self.repo.name, comment_id="2")
        stored_reactions = comment_reactions["reactions"]
        del stored_reactions["url"]
        assert reactions == stored_reactions

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_get_merge_commit_sha_from_commit(self, get_jwt):
        merge_commit_sha = "jkl123"
        pull_requests = [{"merge_commit_sha": merge_commit_sha, "state": "closed"}]
        commit_sha = "asdf"
        responses.add(
            responses.GET,
            f"https://api.github.com/repos/{self.repo.name}/commits/{commit_sha}/pulls",
            json=pull_requests,
        )

        sha = self.github_client.get_merge_commit_sha_from_commit(
            repo=self.repo.name, sha=commit_sha
        )
        assert sha == merge_commit_sha

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_get_merge_commit_sha_from_commit_open_pr(self, get_jwt):
        merge_commit_sha = "jkl123"
        pull_requests = [{"merge_commit_sha": merge_commit_sha, "state": "open"}]
        commit_sha = "asdf"
        responses.add(
            responses.GET,
            f"https://api.github.com/repos/{self.repo.name}/commits/{commit_sha}/pulls",
            json=pull_requests,
        )

        sha = self.github_client.get_merge_commit_sha_from_commit(
            repo=self.repo.name, sha=commit_sha
        )
        assert sha is None

    @responses.activate
    def test_disable_email(self):
        with self.tasks():
            notify_disable(
                self.organization, self.integration.provider, self.github_client._get_redis_key()
            )
        assert len(mail.outbox) == 1
        msg = mail.outbox[0]
        assert msg.subject == "Action required: re-authenticate or fix your Github integration"
        assert (
            self.organization.absolute_url(
                f"/settings/{self.organization.slug}/integrations/{self.integration.provider}"
            )
            in msg.body
        )
        assert (
            self.organization.absolute_url(
                f"/settings/{self.organization.slug}/integrations/{self.integration.provider}/?referrer=disabled-integration"
            )
            in msg.body
        )


@control_silo_test
class GithubProxyClientTest(TestCase):
    jwt = "my_cool_jwt"
    access_token = "access_token"

    def setUp(self):
        self.integration = self.create_integration(
            organization=self.organization,
            provider="github",
            name="github-test",
            external_id="github:1",
            metadata={"access_token": None, "expires_at": None},
            status=ObjectStatus.ACTIVE,
        )
        self.installation = self.integration.get_installation(organization_id=self.organization.id)
        self.gh_client = self.installation.get_client()
        self.installation_id = self.gh_client._get_installation_id()
        self.expires_at = (datetime.today() + timedelta(weeks=2)).isoformat()[:19] + "Z"
        responses.add(
            method=responses.POST,
            url=f"https://api.github.com/app/installations/{self.installation_id}/access_tokens",
            json={"token": self.access_token, "expires_at": self.expires_at},
            match=[matchers.header_matcher({"Authorization": f"Bearer {self.jwt}"})],
            status=200,
        )
        project = self.create_project(organization=self.organization)
        self.repo = self.create_repo(
            project=project,
            name="Test-Organization/foo",
            provider="integrations:github",
            integration_id=self.integration.id,
            url="https://github.com/Test-Organization/foo",
        )

    @responses.activate
    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=jwt)
    def test__refresh_access_token(self, mock_jwt):
        assert self.integration.metadata == {"access_token": None, "expires_at": None}

        self.gh_client._refresh_access_token()
        assert mock_jwt.called

        self.integration.refresh_from_db()
        assert self.integration.metadata == {
            "access_token": self.access_token,
            "expires_at": self.expires_at.rstrip("Z"),
        }

    @responses.activate
    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=jwt)
    def test__get_token(self, mock_jwt):
        access_token_request = Request(
            url=f"{self.gh_client.base_url}/repos/test-repo/issues"
        ).prepare()
        jwt_request = Request(
            url=f"{self.gh_client.base_url}/app/installations/{self.installation_id}"
        ).prepare()

        with mock.patch(
            "sentry.integrations.github.client.GithubProxyClient._refresh_access_token",
            wraps=self.gh_client._refresh_access_token,
        ) as mock_refresh_token:
            # Regular API requests should use access tokens
            token = self.gh_client._get_token(prepared_request=access_token_request)
            self.integration.refresh_from_db()
            assert mock_jwt.call_count == 1
            assert mock_refresh_token.call_count == 1
            assert token == self.access_token == self.integration.metadata["access_token"]

            # If the access token isn't expired, don't refresh it with an API call
            mock_refresh_token.reset_mock()
            mock_jwt.reset_mock()
            token = self.gh_client._get_token(prepared_request=access_token_request)
            assert mock_refresh_token.call_count == 0
            assert mock_jwt.call_count == 0
            assert token == self.access_token == self.integration.metadata["access_token"]

            # Meta, app-installation requests should use jwts
            token = self.gh_client._get_token(prepared_request=jwt_request)
            assert mock_jwt.call_count == 1
            assert mock_refresh_token.call_count == 0
            assert token == self.jwt

    @responses.activate
    @mock.patch("sentry.integrations.github.client.GithubProxyClient._get_token", return_value=None)
    def test_authorize_request_invalid(self, mock_get_invalid_token):
        request = Request(url=f"{self.gh_client.base_url}/repos/test-repo/issues").prepare()

        self.gh_client.integration = None
        self.gh_client.authorize_request(prepared_request=request)
        assert "Authorization" not in request.headers

        self.gh_client.integration = self.integration
        self.gh_client.authorize_request(prepared_request=request)
        assert mock_get_invalid_token.called
        assert "Authorization" not in request.headers

    @responses.activate
    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=jwt)
    def test_authorize_request_valid(self, mock_jwt):
        access_token_request = Request(
            url=f"{self.gh_client.base_url}/repos/test-repo/issues"
        ).prepare()
        jwt_request = Request(
            url=f"{self.gh_client.base_url}/app/installations/{self.installation_id}"
        ).prepare()

        # First request should refresh the token and add headers
        self.gh_client.authorize_request(prepared_request=access_token_request)
        assert mock_jwt.called
        assert access_token_request.headers["Accept"] == "application/vnd.github+json"
        assert self.access_token in access_token_request.headers["Authorization"]

        mock_jwt.reset_mock()
        access_token_request.headers.clear()

        # Following requests should just add headers
        self.gh_client.authorize_request(prepared_request=access_token_request)
        assert not mock_jwt.called
        assert access_token_request.headers["Accept"] == "application/vnd.github+json"
        assert self.access_token in access_token_request.headers["Authorization"]

        # JWT-authorized requests should be identified by request path
        self.gh_client.authorize_request(prepared_request=jwt_request)
        assert mock_jwt.called
        assert jwt_request.headers["Accept"] == "application/vnd.github+json"
        assert jwt_request.headers["Authorization"] == f"Bearer {self.jwt}"

    @responses.activate
    @mock.patch(
        "sentry.integrations.github.client.GithubProxyClient._get_token", return_value=access_token
    )
    def test_integration_proxy_is_active(self, mock_get_token):
        class GithubProxyTestClient(GitHubApiClient):
            _use_proxy_url_for_tests = True

            def assert_proxy_request(self, request, is_proxy=True):
                assert (PROXY_BASE_PATH in request.url) == is_proxy
                assert (PROXY_OI_HEADER in request.headers) == is_proxy
                assert (PROXY_SIGNATURE_HEADER in request.headers) == is_proxy
                # The following GitHub headers don't appear in proxied requests
                assert ("Authorization" in request.headers) != is_proxy
                assert ("Accept" in request.headers) != is_proxy
                if is_proxy:
                    assert request.headers[PROXY_OI_HEADER] is not None

        expected_proxy_path = "repos/test-repo/issues/123"
        control_proxy_responses = add_control_silo_proxy_response(
            method=responses.GET,
            path=expected_proxy_path,
            json={"ok": True},
            status=200,
        )

        github_responses = responses.add(
            method=responses.GET,
            url=re.compile(rf"\S+{expected_proxy_path}$"),
            json={"ok": True},
            status=200,
        )

        with override_settings(SILO_MODE=SiloMode.MONOLITH):
            client = GithubProxyTestClient(integration=self.integration)
            client.get_issue("test-repo", "123")
            request = responses.calls[0].request

            assert github_responses.call_count == 1
            assert "/repos/test-repo/issues" in request.url
            assert client.base_url in request.url
            client.assert_proxy_request(request, is_proxy=False)

        responses.calls.reset()
        with override_settings(SILO_MODE=SiloMode.CONTROL):
            client = GithubProxyTestClient(integration=self.integration)
            client.get_issue("test-repo", "123")
            request = responses.calls[0].request

            assert github_responses.call_count == 2
            assert "/repos/test-repo/issues" in request.url
            assert client.base_url in request.url
            client.assert_proxy_request(request, is_proxy=False)

        responses.calls.reset()
        assert control_proxy_responses.call_count == 0
        with override_settings(SILO_MODE=SiloMode.REGION):
            client = GithubProxyTestClient(integration=self.integration)
            client.get_issue("test-repo", "123")
            request = responses.calls[0].request

            assert control_proxy_responses.call_count == 1
            assert client.base_url not in request.url
            client.assert_proxy_request(request, is_proxy=True)


class GitHubClientFileBlameBase(TestCase):
    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    def setUp(self, get_jwt):
        integration = self.create_integration(
            organization=self.organization,
            provider="github",
            name="Github Test Org",
            external_id="1",
            metadata={"access_token": None, "expires_at": None},
        )
        self.repo_1 = Repository.objects.create(
            organization_id=self.organization.id,
            name="Test-Organization/foo",
            url="https://github.com/Test-Organization/foo",
            provider="integrations:github",
            external_id=123,
            integration_id=integration.id,
        )
        self.repo_2 = Repository.objects.create(
            organization_id=self.organization.id,
            name="Test-Organization/bar",
            url="https://github.com/Test-Organization/bar",
            provider="integrations:github",
            external_id=456,
            integration_id=integration.id,
        )
        self.repo_3 = Repository.objects.create(
            organization_id=self.organization.id,
            name="Test-Organization/other",
            url="https://github.com/Test-Organization/other",
            provider="integrations:github",
            external_id=789,
            integration_id=integration.id,
        )
        install = integration.get_installation(organization_id=self.organization.id)
        assert isinstance(install, GitHubIntegration)
        self.install = install
        self.github_client = self.install.get_client()
        responses.add(
            method=responses.POST,
            url="https://api.github.com/app/installations/1/access_tokens",
            body='{"token": "12345token", "expires_at": "2030-01-01T00:00:00Z"}',
            status=200,
            content_type="application/json",
        )
        responses.add(
            method=responses.GET,
            url="https://api.github.com/rate_limit",
            body=orjson.dumps(
                {
                    "resources": {
                        "graphql": {
                            "limit": 5000,
                            "used": 1,
                            "remaining": 4999,
                            "reset": 1613064000,
                        }
                    }
                }
            ).decode(),
            status=200,
            content_type="application/json",
        )


class GitHubClientFileBlameIntegrationDisableTest(TestCase):
    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    def setUp(self, get_jwt):
        ten_days = timezone.now() + timedelta(days=10)
        self.integration = self.create_integration(
            organization=self.organization,
            provider="github",
            name="Github Test Org",
            external_id="1",
            metadata={
                "access_token": "12345token",
                "expires_at": ten_days.strftime("%Y-%m-%dT%H:%M:%S"),
            },
        )
        self.repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="Test-Organization/foo",
            url="https://github.com/Test-Organization/foo",
            provider="integrations:github",
            external_id=123,
            integration_id=self.integration.id,
        )
        install = self.integration.get_installation(organization_id=self.organization.id)
        assert isinstance(install, GitHubIntegration)
        self.install = install
        self.github_client = self.install.get_client()
        self.file = SourceLineInfo(
            path="src/sentry/integrations/github/client_1.py",
            lineno=10,
            ref="master",
            repo=self.repo,
            code_mapping=None,  # type: ignore[arg-type]
        )

    @pytest.mark.skip("Feature is temporarily disabled")
    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=ApiError)
    @responses.activate
    def test_fatal_and_disable_integration(self, get_jwt):
        """
        fatal fast shut off with disable flag on, integration should be broken and disabled
        """
        responses.add(
            responses.POST,
            status=403,
            url="https://api.github.com/graphql",
            json={
                "message": "This installation has been suspended",
                "documentation_url": "https://docs.github.com/rest/reference/apps#create-an-installation-access-token-for-an-app",
            },
        )

        with pytest.raises(Exception):
            self.github_client.get_blame_for_files([self.file], extra={})

        buffer = IntegrationRequestBuffer(self.github_client._get_redis_key())
        self.integration.refresh_from_db()
        assert self.integration.status == ObjectStatus.DISABLED
        assert [len(item) == 0 for item in buffer._get_broken_range_from_buffer()]
        assert len(buffer._get_all_from_buffer()) == 0

    @responses.activate
    def test_error_integration(self):
        """
        recieve two errors and errors are recorded, integration is not broken yet so no disable
        """
        responses.add(
            method=responses.GET,
            url="https://api.github.com/rate_limit",
            body=orjson.dumps(
                {
                    "resources": {
                        "graphql": {
                            "limit": 5000,
                            "used": 1,
                            "remaining": 4999,
                            "reset": 1613064000,
                        }
                    }
                }
            ).decode(),
            status=200,
            content_type="application/json",
        )

        responses.add(
            responses.POST,
            status=404,
            url="https://api.github.com/graphql",
            json={
                "message": "Not found",
            },
        )
        responses.add(
            responses.POST,
            status=404,
            url="https://api.github.com/graphql",
            json={
                "message": "Not found",
            },
        )
        with pytest.raises(Exception):
            self.github_client.get_blame_for_files([self.file], extra={})
        with pytest.raises(Exception):
            self.github_client.get_blame_for_files([self.file], extra={})
        buffer = IntegrationRequestBuffer(self.github_client._get_redis_key())
        assert (
            int(buffer._get_all_from_buffer()[0]["error_count"]) == 2
        )  # 2 from graphql, 2 from rate_limt check
        assert buffer.is_integration_broken() is False

    @responses.activate
    @freeze_time("2022-01-01 03:30:00")
    def test_slow_integration_is_not_broken_or_disabled(self):
        """
        slow test with disable flag on
        put errors and success in buffer for 10 days, assert integration is not broken or disabled
        """

        responses.add(
            responses.POST,
            status=404,
            url="https://api.github.com/graphql",
            json={
                "message": "Not found",
            },
        )
        buffer = IntegrationRequestBuffer(self.github_client._get_redis_key())
        now = datetime.now() - timedelta(hours=1)
        for i in reversed(range(10)):
            with freeze_time(now - timedelta(days=i)):
                buffer.record_error()
                buffer.record_success()
        with pytest.raises(Exception):
            self.github_client.get_blame_for_files([self.file], extra={})
        assert buffer.is_integration_broken() is False
        self.integration.refresh_from_db()
        assert self.integration.status == ObjectStatus.ACTIVE

    @pytest.mark.skip("Feature is temporarily disabled")
    @responses.activate
    @freeze_time("2022-01-01 03:30:00")
    def test_a_slow_integration_is_broken(self):
        """
        slow shut off with disable flag on
        put errors in buffer for 10 days, assert integration is broken and disabled
        """
        responses.add(
            responses.POST,
            status=404,
            url="https://api.github.com/graphql",
            json={"message": "Not found"},
        )
        buffer = IntegrationRequestBuffer(self.github_client._get_redis_key())
        now = datetime.now() - timedelta(hours=1)
        for i in reversed(range(10)):
            with freeze_time(now - timedelta(days=i)):
                buffer.record_error()
        assert self.integration.status == ObjectStatus.ACTIVE
        with pytest.raises(Exception):
            self.github_client.get_blame_for_files([self.file], extra={})
        self.integration.refresh_from_db()
        assert self.integration.status == ObjectStatus.DISABLED


class GitHubClientFileBlameQueryBuilderTest(GitHubClientFileBlameBase):
    """
    Tests that get_blame_for_files builds the correct GraphQL query
    """

    def setUp(self):
        super().setUp()

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_get_blame_for_files_same_repo(self, get_jwt):
        """
        When all files are in the same repo, only one repository object should be
        queried and files blames within the repo should be deduped
        """
        file1 = SourceLineInfo(
            path="src/sentry/integrations/github/client_1.py",
            lineno=10,
            ref="master",
            repo=self.repo_1,
            code_mapping=None,  # type: ignore[arg-type]
        )
        file2 = SourceLineInfo(
            path="src/sentry/integrations/github/client_1.py",
            lineno=15,
            ref="master",
            repo=self.repo_1,
            code_mapping=None,  # type: ignore[arg-type]
        )
        file3 = SourceLineInfo(
            path="src/sentry/integrations/github/client_2.py",
            lineno=20,
            ref="master",
            repo=self.repo_1,
            code_mapping=None,  # type: ignore[arg-type]
        )
        query = """query ($repo_name_0: String!, $repo_owner_0: String!, $ref_0_0: String!, $path_0_0_0: String!, $path_0_0_1: String!) {
    repository0: repository(name: $repo_name_0, owner: $repo_owner_0) {
        ref0: ref(qualifiedName: $ref_0_0) {
            target {
                ... on Commit {
                    blame0: blame(path: $path_0_0_0) {
                        ranges {
                            commit {
                                oid
                                author {
                                    name
                                    email
                                }
                                message
                                committedDate
                            }
                            startingLine
                            endingLine
                            age
                        }
                    }
                    blame1: blame(path: $path_0_0_1) {
                        ranges {
                            commit {
                                oid
                                author {
                                    name
                                    email
                                }
                                message
                                committedDate
                            }
                            startingLine
                            endingLine
                            age
                        }
                    }
                }
            }
        }
    }
}"""
        responses.add(
            method=responses.POST,
            url="https://api.github.com/graphql",
            json={
                "query": query,
                "data": {},
            },
            content_type="application/json",
        )

        self.github_client.get_blame_for_files([file1, file2, file3], extra={})
        assert orjson.loads(responses.calls[1].request.body)["query"] == query
        assert orjson.loads(responses.calls[1].request.body)["variables"] == {
            "repo_name_0": "foo",
            "repo_owner_0": "Test-Organization",
            "ref_0_0": "master",
            "path_0_0_0": "src/sentry/integrations/github/client_1.py",
            "path_0_0_1": "src/sentry/integrations/github/client_2.py",
        }

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_get_blame_for_files_different_repos(self, get_jwt):
        """
        When files are in different repos, multiple repository objects should be
        queried. Files within the same repo and branch should be deduped.
        """
        file1 = SourceLineInfo(
            path="src/sentry/integrations/github/client_1.py",
            lineno=10,
            ref="master",
            repo=self.repo_1,
            code_mapping=None,  # type: ignore[arg-type]
        )
        file2 = SourceLineInfo(
            path="src/sentry/integrations/github/client_2.py",
            lineno=15,
            ref="master",
            repo=self.repo_1,
            code_mapping=None,  # type: ignore[arg-type]
        )
        file3 = SourceLineInfo(
            path="src/getsentry/file.py",
            lineno=20,
            ref="master",
            repo=self.repo_2,
            code_mapping=None,  # type: ignore[arg-type]
        )
        query = """query ($repo_name_0: String!, $repo_owner_0: String!, $ref_0_0: String!, $path_0_0_0: String!, $path_0_0_1: String!, $repo_name_1: String!, $repo_owner_1: String!, $ref_1_0: String!, $path_1_0_0: String!) {
    repository0: repository(name: $repo_name_0, owner: $repo_owner_0) {
        ref0: ref(qualifiedName: $ref_0_0) {
            target {
                ... on Commit {
                    blame0: blame(path: $path_0_0_0) {
                        ranges {
                            commit {
                                oid
                                author {
                                    name
                                    email
                                }
                                message
                                committedDate
                            }
                            startingLine
                            endingLine
                            age
                        }
                    }
                    blame1: blame(path: $path_0_0_1) {
                        ranges {
                            commit {
                                oid
                                author {
                                    name
                                    email
                                }
                                message
                                committedDate
                            }
                            startingLine
                            endingLine
                            age
                        }
                    }
                }
            }
        }
    }
    repository1: repository(name: $repo_name_1, owner: $repo_owner_1) {
        ref0: ref(qualifiedName: $ref_1_0) {
            target {
                ... on Commit {
                    blame0: blame(path: $path_1_0_0) {
                        ranges {
                            commit {
                                oid
                                author {
                                    name
                                    email
                                }
                                message
                                committedDate
                            }
                            startingLine
                            endingLine
                            age
                        }
                    }
                }
            }
        }
    }
}"""
        responses.add(
            method=responses.POST,
            url="https://api.github.com/graphql",
            json={
                "query": query,
                "data": {},
            },
            content_type="application/json",
        )

        self.github_client.get_blame_for_files([file1, file2, file3], extra={})
        assert orjson.loads(responses.calls[1].request.body)["query"] == query
        assert orjson.loads(responses.calls[1].request.body)["variables"] == {
            "repo_name_0": "foo",
            "repo_owner_0": "Test-Organization",
            "ref_0_0": "master",
            "path_0_0_0": "src/sentry/integrations/github/client_1.py",
            "path_0_0_1": "src/sentry/integrations/github/client_2.py",
            "repo_name_1": "bar",
            "repo_owner_1": "Test-Organization",
            "ref_1_0": "master",
            "path_1_0_0": "src/getsentry/file.py",
        }

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_get_blame_for_files_different_refs(self, get_jwt):
        """
        When files are in the same repo but different branches, query multiple
        ref objects. Files should still be deduped.
        """
        file1 = SourceLineInfo(
            path="src/sentry/integrations/github/client.py",
            lineno=10,
            ref="master",
            repo=self.repo_1,
            code_mapping=None,  # type: ignore[arg-type]
        )
        file2 = SourceLineInfo(
            path="src/sentry/integrations/github/client.py",
            lineno=15,
            ref="master",
            repo=self.repo_1,
            code_mapping=None,  # type: ignore[arg-type]
        )
        file3 = SourceLineInfo(
            path="src/sentry/integrations/github/client.py",
            lineno=20,
            ref="staging",
            repo=self.repo_1,
            code_mapping=None,  # type: ignore[arg-type]
        )
        query = """query ($repo_name_0: String!, $repo_owner_0: String!, $ref_0_0: String!, $path_0_0_0: String!, $ref_0_1: String!, $path_0_1_0: String!) {
    repository0: repository(name: $repo_name_0, owner: $repo_owner_0) {
        ref0: ref(qualifiedName: $ref_0_0) {
            target {
                ... on Commit {
                    blame0: blame(path: $path_0_0_0) {
                        ranges {
                            commit {
                                oid
                                author {
                                    name
                                    email
                                }
                                message
                                committedDate
                            }
                            startingLine
                            endingLine
                            age
                        }
                    }
                }
            }
        }
        ref1: ref(qualifiedName: $ref_0_1) {
            target {
                ... on Commit {
                    blame0: blame(path: $path_0_1_0) {
                        ranges {
                            commit {
                                oid
                                author {
                                    name
                                    email
                                }
                                message
                                committedDate
                            }
                            startingLine
                            endingLine
                            age
                        }
                    }
                }
            }
        }
    }
}"""
        responses.add(
            method=responses.POST,
            url="https://api.github.com/graphql",
            json={
                "query": query,
                "data": {},
            },
            content_type="application/json",
        )

        self.github_client.get_blame_for_files([file1, file2, file3], extra={})
        assert orjson.loads(responses.calls[1].request.body)["query"] == query
        assert orjson.loads(responses.calls[1].request.body)["variables"] == {
            "repo_name_0": "foo",
            "repo_owner_0": "Test-Organization",
            "ref_0_0": "master",
            "path_0_0_0": "src/sentry/integrations/github/client.py",
            "ref_0_1": "staging",
            "path_0_1_0": "src/sentry/integrations/github/client.py",
        }

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_trim_file_path_for_query(self, get_jwt):
        """
        When file path has hanging forward slashes, trims them for the request.
        The GitHub GraphQL API will return empty responses otherwise.
        """
        file1 = SourceLineInfo(
            path="/src/sentry/integrations/github/client.py/",
            lineno=10,
            ref="master",
            repo=self.repo_1,
            code_mapping=None,  # type: ignore[arg-type]
        )

        query = """query ($repo_name_0: String!, $repo_owner_0: String!, $ref_0_0: String!, $path_0_0_0: String!) {
    repository0: repository(name: $repo_name_0, owner: $repo_owner_0) {
        ref0: ref(qualifiedName: $ref_0_0) {
            target {
                ... on Commit {
                    blame0: blame(path: $path_0_0_0) {
                        ranges {
                            commit {
                                oid
                                author {
                                    name
                                    email
                                }
                                message
                                committedDate
                            }
                            startingLine
                            endingLine
                            age
                        }
                    }
                }
            }
        }
    }
}"""
        responses.add(
            method=responses.POST,
            url="https://api.github.com/graphql",
            json={
                "query": query,
                "data": {},
            },
            content_type="application/json",
        )

        self.github_client.get_blame_for_files([file1], extra={})
        assert orjson.loads(responses.calls[1].request.body)["query"] == query
        assert orjson.loads(responses.calls[1].request.body)["variables"] == {
            "repo_name_0": "foo",
            "repo_owner_0": "Test-Organization",
            "ref_0_0": "master",
            "path_0_0_0": "src/sentry/integrations/github/client.py",
        }


class GitHubClientFileBlameResponseTest(GitHubClientFileBlameBase):
    """
    Tests that get_blame_for_files handles the GraphQL response correctly
    """

    def setUp(self):
        super().setUp()

        self.file1 = SourceLineInfo(
            path="src/sentry/integrations/github/client_1.py",
            lineno=10,
            ref="master",
            repo=self.repo_1,
            code_mapping=None,  # type: ignore[arg-type]
        )
        self.file2 = SourceLineInfo(
            path="src/sentry/integrations/github/client_1.py",
            lineno=20,
            ref="master",
            repo=self.repo_1,
            code_mapping=None,  # type: ignore[arg-type]
        )
        self.file3 = SourceLineInfo(
            path="src/sentry/integrations/github/client_2.py",
            lineno=20,
            ref="master",
            repo=self.repo_1,
            code_mapping=None,  # type: ignore[arg-type]
        )

        self.data = {
            "repository0": {
                "ref0": {
                    "target": {
                        "blame0": {
                            "ranges": [
                                {
                                    "commit": {
                                        "oid": "987",
                                        "author": {
                                            "name": "not this one",
                                            "email": "blah@example.com",
                                        },
                                        "message": "bye",
                                        "committedDate": "2022-01-01T00:00:00Z",
                                    },
                                    "startingLine": 1,
                                    "endingLine": 9,
                                    "age": 0,
                                },
                                {
                                    "commit": {
                                        "oid": "123",
                                        "author": {"name": "foo1", "email": "foo1@example.com"},
                                        "message": "hello",
                                        "committedDate": "2022-01-01T00:00:00Z",
                                    },
                                    "startingLine": 10,
                                    "endingLine": 15,
                                    "age": 0,
                                },
                                {
                                    "commit": {
                                        "oid": "456",
                                        "author": {"name": "foo2", "email": "foo2@example.com"},
                                        "message": "hello",
                                        "committedDate": "2021-01-01T00:00:00Z",
                                    },
                                    "startingLine": 16,
                                    "endingLine": 21,
                                    "age": 0,
                                },
                            ]
                        },
                        "blame1": {
                            "ranges": [
                                {
                                    "commit": {
                                        "oid": "789",
                                        "author": {"name": "foo3", "email": "foo3@example.com"},
                                        "message": "hello",
                                        "committedDate": "2020-01-01T00:00:00Z",
                                    },
                                    "startingLine": 20,
                                    "endingLine": 20,
                                    "age": 0,
                                }
                            ]
                        },
                    }
                }
            }
        }

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_get_blame_for_files_full_response(self, get_jwt):
        """
        Tests that the correct commits are selected from the blame range when a full response is returned.
        """

        responses.add(
            method=responses.POST,
            url="https://api.github.com/graphql",
            json={
                "data": self.data,
            },
            content_type="application/json",
        )

        response = self.github_client.get_blame_for_files(
            [self.file1, self.file2, self.file3], extra={}
        )
        self.assertEqual(
            response,
            [
                FileBlameInfo(
                    **asdict(self.file1),
                    commit=CommitInfo(
                        commitId="123",
                        commitAuthorName="foo1",
                        commitAuthorEmail="foo1@example.com",
                        commitMessage="hello",
                        committedDate=datetime(2022, 1, 1, 0, 0, 0, tzinfo=UTC),
                    ),
                ),
                FileBlameInfo(
                    **asdict(self.file2),
                    commit=CommitInfo(
                        commitId="456",
                        commitAuthorName="foo2",
                        commitAuthorEmail="foo2@example.com",
                        commitMessage="hello",
                        committedDate=datetime(2021, 1, 1, 0, 0, 0, tzinfo=UTC),
                    ),
                ),
                FileBlameInfo(
                    **asdict(self.file3),
                    commit=CommitInfo(
                        commitId="789",
                        commitAuthorName="foo3",
                        commitAuthorEmail="foo3@example.com",
                        commitMessage="hello",
                        committedDate=datetime(2020, 1, 1, 0, 0, 0, tzinfo=UTC),
                    ),
                ),
            ],
        )

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_get_cached_blame_for_files_full_response(self, get_jwt):
        """
        Tests that the cached commits are returned with full response
        """
        responses.add(
            method=responses.POST,
            url="https://api.github.com/graphql",
            json={
                "data": self.data,
            },
            content_type="application/json",
        )

        query, variables = create_blame_query(
            generate_file_path_mapping([self.file1, self.file2, self.file3]), extra={}
        )
        cache_key = self.github_client.get_cache_key(
            "/graphql", orjson.dumps({"query": query, "variables": variables}).decode()
        )
        assert self.github_client.check_cache(cache_key) is None
        response = self.github_client.get_blame_for_files(
            [self.file1, self.file2, self.file3], extra={}
        )

        self.assertEqual(
            response,
            [
                FileBlameInfo(
                    **asdict(self.file1),
                    commit=CommitInfo(
                        commitId="123",
                        commitAuthorName="foo1",
                        commitAuthorEmail="foo1@example.com",
                        commitMessage="hello",
                        committedDate=datetime(2022, 1, 1, 0, 0, 0, tzinfo=UTC),
                    ),
                ),
                FileBlameInfo(
                    **asdict(self.file2),
                    commit=CommitInfo(
                        commitId="456",
                        commitAuthorName="foo2",
                        commitAuthorEmail="foo2@example.com",
                        commitMessage="hello",
                        committedDate=datetime(2021, 1, 1, 0, 0, 0, tzinfo=UTC),
                    ),
                ),
                FileBlameInfo(
                    **asdict(self.file3),
                    commit=CommitInfo(
                        commitId="789",
                        commitAuthorName="foo3",
                        commitAuthorEmail="foo3@example.com",
                        commitMessage="hello",
                        committedDate=datetime(2020, 1, 1, 0, 0, 0, tzinfo=UTC),
                    ),
                ),
            ],
        )
        cached_1 = self.github_client.check_cache(cache_key)
        assert isinstance(cached_1, dict)
        assert cached_1["data"] == self.data
        # Calling a second time should work
        response = self.github_client.get_blame_for_files(
            [self.file1, self.file2, self.file3], extra={}
        )
        cached_2 = self.github_client.check_cache(cache_key)
        assert isinstance(cached_2, dict)
        assert cached_2["data"] == self.data
        # Calling again after the cache has been cleared should still work
        cache.delete(cache_key)
        response = self.github_client.get_blame_for_files(
            [self.file1, self.file2, self.file3], extra={}
        )
        cached_3 = self.github_client.check_cache(cache_key)
        assert isinstance(cached_3, dict)
        assert cached_3["data"] == self.data
        assert (
            self.github_client.get_blame_for_files([self.file1, self.file2], extra={}) != response
        )

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_get_blame_for_files_response_partial_data(self, get_jwt):
        """
        Tests that commits are still returned when some data is missing from the response
        """
        file1 = SourceLineInfo(
            path="src/sentry/integrations/github/client_1.py",
            lineno=10,
            ref="master",
            repo=self.repo_1,
            code_mapping=None,  # type: ignore[arg-type]
        )
        file2 = SourceLineInfo(
            path="src/sentry/integrations/github/client_2.py",
            lineno=15,
            ref="master",
            repo=self.repo_1,
            code_mapping=None,  # type: ignore[arg-type]
        )
        file3 = SourceLineInfo(
            path="src/sentry/integrations/github/client.py",
            lineno=20,
            ref="master",
            repo=self.repo_2,
            code_mapping=None,  # type: ignore[arg-type]
        )
        file4 = SourceLineInfo(
            path="src/sentry/integrations/github/client.py",
            lineno=25,
            ref="master",
            repo=self.repo_3,
            code_mapping=None,  # type: ignore[arg-type]
        )
        data = {
            "repository0": {
                "ref0": {
                    "target": {
                        "blame0": {
                            "ranges": [
                                {
                                    "commit": {
                                        "oid": "123",
                                        "author": None,
                                        "message": None,
                                        "committedDate": "2022-01-01T00:00:00Z",
                                    },
                                    "startingLine": 10,
                                    "endingLine": 15,
                                    "age": 0,
                                }
                            ]
                        },
                        "blame1": {"ranges": []},
                    }
                }
            },
            "repository1": {"ref0": None},
            "repository2": None,
        }

        responses.add(
            method=responses.POST,
            url="https://api.github.com/graphql",
            json={
                "data": data,
            },
            content_type="application/json",
        )

        response = self.github_client.get_blame_for_files([file1, file2, file3, file4], extra={})
        self.assertEqual(
            response,
            [
                FileBlameInfo(
                    **asdict(file1),
                    commit=CommitInfo(
                        commitId="123",
                        commitAuthorName=None,
                        commitAuthorEmail=None,
                        commitMessage=None,
                        committedDate=datetime(2022, 1, 1, 0, 0, 0, tzinfo=UTC),
                    ),
                ),
            ],
        )

    @mock.patch("sentry.integrations.github.client.logger.error")
    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_get_blame_for_files_invalid_commit(self, get_jwt, mock_logger_error):
        """
        Tests commits that have invalid data are skipped and logged
        """
        file1 = SourceLineInfo(
            path="src/sentry/integrations/github/client_1.py",
            lineno=10,
            ref="master",
            repo=self.repo_1,
            code_mapping=None,  # type: ignore[arg-type]
        )
        file2 = SourceLineInfo(
            path="src/sentry/integrations/github/client_2.py",
            lineno=15,
            ref="master",
            repo=self.repo_1,
            code_mapping=None,  # type: ignore[arg-type]
        )
        data = {
            "repository0": {
                "ref0": {
                    "target": {
                        "blame0": {
                            "ranges": [
                                {
                                    "commit": {
                                        "oid": None,
                                        "author": None,
                                        "message": None,
                                        "committedDate": "2022-01-01T00:00:00Z",
                                    },
                                    "startingLine": 10,
                                    "endingLine": 15,
                                    "age": 0,
                                }
                            ]
                        },
                        "blame1": {
                            "ranges": [
                                {
                                    "commit": {
                                        "oid": "123",
                                        "author": None,
                                        "message": None,
                                        "committedDate": None,
                                    },
                                    "startingLine": 10,
                                    "endingLine": 15,
                                    "age": 0,
                                }
                            ]
                        },
                    }
                }
            },
        }

        responses.add(
            method=responses.POST,
            url="https://api.github.com/graphql",
            json={
                "data": data,
            },
            content_type="application/json",
        )

        response = self.github_client.get_blame_for_files([file1, file2], extra={})
        self.assertEqual(response, [])

        mock_logger_error.assert_has_calls(
            [
                mock.call(
                    "get_blame_for_files.extract_commits_from_blame.invalid_commit_response",
                    extra={
                        "provider": "github",
                        "organization_integration_id": self.github_client.org_integration_id,
                        "file_lineno": file1.lineno,
                        "file_path": file1.path,
                        "branch_name": file1.ref,
                        "repo_name": file1.repo.name,
                        "reason": "Missing property oid",
                    },
                ),
                mock.call(
                    "get_blame_for_files.extract_commits_from_blame.invalid_commit_response",
                    extra={
                        "provider": "github",
                        "organization_integration_id": self.github_client.org_integration_id,
                        "file_lineno": file2.lineno,
                        "file_path": file2.path,
                        "branch_name": file2.ref,
                        "repo_name": file2.repo.name,
                        "commit_id": "123",
                        "reason": "Missing property committedDate",
                    },
                ),
            ]
        )


class GitHubClientFileBlameRateLimitTest(GitHubClientFileBlameBase):
    """
    Tests that rate limits are handled correctly
    """

    def setUp(self):
        super().setUp()
        self.file = SourceLineInfo(
            path="src/sentry/integrations/github/client_1.py",
            lineno=10,
            ref="master",
            repo=self.repo_1,
            code_mapping=None,  # type: ignore[arg-type]
        )
        responses.reset()
        responses.add(
            method=responses.POST,
            url="https://api.github.com/app/installations/1/access_tokens",
            body='{"token": "12345token", "expires_at": "2030-01-01T00:00:00Z"}',
            status=200,
            content_type="application/json",
        )
        responses.add(
            method=responses.GET,
            url="https://api.github.com/rate_limit",
            body=orjson.dumps(
                {
                    "resources": {
                        "graphql": {
                            "limit": 5000,
                            "used": 4900,
                            "remaining": 100,
                            "reset": 1613064000,
                        }
                    }
                }
            ).decode(),
            status=200,
            content_type="application/json",
        )

    @mock.patch("sentry.integrations.github.client.logger.error")
    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_rate_limit_exceeded(self, get_jwt, mock_logger_error):
        with pytest.raises(ApiRateLimitedError):
            self.github_client.get_blame_for_files([self.file], extra={})
        mock_logger_error.assert_called_with(
            "sentry.integrations.github.get_blame_for_files.rate_limit",
            extra={
                "provider": "github",
                "specific_resource": "graphql",
                "remaining": 100,
                "next_window": "17:20:00",
                "organization_integration_id": self.github_client.org_integration_id,
            },
        )

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_no_rate_limiting(self, get_jwt):
        """
        Tests that no error is thrown when GitHub isn't enforcing rate limits
        """
        responses.reset()
        responses.add(
            method=responses.POST,
            url="https://api.github.com/app/installations/1/access_tokens",
            body='{"token": "12345token", "expires_at": "2030-01-01T00:00:00Z"}',
            status=200,
            content_type="application/json",
        )
        responses.add(
            method=responses.GET,
            url="https://api.github.com/rate_limit",
            status=404,
        )
        responses.add(
            method=responses.POST,
            url="https://api.github.com/graphql",
            json={
                "data": {},
            },
            content_type="application/json",
        )

        assert self.github_client.get_blame_for_files([self.file], extra={}) == []
