import base64
import re
from datetime import datetime, timedelta
from unittest import mock

import pytest
import responses
from django.core import mail
from django.test import override_settings
from requests import Request
from responses import matchers

from sentry.constants import ObjectStatus
from sentry.integrations.github.client import GitHubAppsClient
from sentry.integrations.github.integration import GitHubIntegration
from sentry.integrations.notify_disable import notify_disable
from sentry.integrations.request_buffer import IntegrationRequestBuffer
from sentry.models.integrations.integration import Integration
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiError
from sentry.shared_integrations.response.base import BaseApiResponse
from sentry.silo.base import SiloMode
from sentry.silo.util import PROXY_BASE_PATH, PROXY_OI_HEADER, PROXY_SIGNATURE_HEADER
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.utils.cache import cache

GITHUB_CODEOWNERS = {
    "filepath": "CODEOWNERS",
    "html_url": "https://github.com/org/reponame/CODEOWNERS",
    "raw": "docs/*    @NisanthanNanthakumar   @getsentry/ecosystem\n* @NisanthanNanthakumar\n",
}


class GitHubAppsClientTest(TestCase):
    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    def setUp(self, get_jwt):
        integration = self.create_integration(
            organization=self.organization,
            provider="github",
            name="Github Test Org",
            external_id="1",
            metadata={"access_token": None, "expires_at": None},
        )
        self.repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="Test-Organization/foo",
            url="https://github.com/Test-Organization/foo",
            provider="integrations:github",
            external_id=123,
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
        with mock.patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1"):
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
    def test_get_rate_limit_non_existant_resouce(self):
        with pytest.raises(AssertionError):
            self.github_client.get_rate_limit("foo")

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
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

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_check_no_file(self, get_jwt):
        path = "src/santry/integrations/github/client.py"
        version = "master"
        url = f"https://api.github.com/repos/{self.repo.name}/contents/{path}?ref={version}"

        responses.add(method=responses.HEAD, url=url, status=404)

        with pytest.raises(ApiError):
            self.github_client.check_file(self.repo, path, version)
        assert responses.calls[1].response.status_code == 404

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_get_stacktrace_link(self, get_jwt):
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

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
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
        assert len(responses.calls) == 5
        assert responses.calls[1].response.status_code == 200

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_get_with_pagination_only_one_page(self, get_jwt):
        url = f"https://api.github.com/repos/{self.repo.name}/assignees?per_page={self.github_client.page_size}"

        # No link in the headers because there are no more pages
        responses.add(method=responses.GET, url=url, json={}, headers={})
        self.github_client.get_with_pagination(f"/repos/{self.repo.name}/assignees")
        # One call is for getting the token for the installation
        assert len(responses.calls) == 2
        assert responses.calls[1].response.status_code == 200

    @mock.patch(
        "sentry.integrations.github.integration.GitHubIntegration.check_file",
        return_value=GITHUB_CODEOWNERS["html_url"],
    )
    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_get_codeowner_file(self, mock_jwt, mock_check_file):
        self.config = self.create_code_mapping(
            repo=self.repo,
            project=self.project,
        )

        responses.add(
            method=responses.GET,
            url=f"https://api.github.com/repos/{self.repo.name}/contents/CODEOWNERS?ref=master",
            json={"content": base64.b64encode(GITHUB_CODEOWNERS["raw"].encode()).decode("ascii")},
        )
        result = self.install.get_codeowner_file(
            self.config.repository, ref=self.config.default_branch
        )

        assert result == GITHUB_CODEOWNERS

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_get_blame_for_file(self, get_jwt):
        path = "src/sentry/integrations/github/client.py"
        ref = "master"
        query = f"""query {{
            repository(name: "foo", owner: "Test-Organization") {{
                ref(qualifiedName: "{ref}") {{
                    target {{
                        ... on Commit {{
                            blame(path: "{path}") {{
                                ranges {{
                                        commit {{
                                            oid
                                            author {{
                                                name
                                                email
                                            }}
                                            message
                                            committedDate
                                        }}
                                    startingLine
                                    endingLine
                                    age
                                }}
                            }}
                        }}
                    }}
                }}
            }}
        }}"""
        responses.add(
            method=responses.POST,
            url="https://api.github.com/graphql",
            json={"query": query, "data": {"repository": {"ref": {"target": {}}}}},
            content_type="application/json",
        )
        resp = self.github_client.get_blame_for_file(self.repo, path, ref, 1)
        assert (
            responses.calls[1].request.body
            == b'{"query": "query {\\n            repository(name: \\"foo\\", owner: \\"Test-Organization\\") {\\n                ref(qualifiedName: \\"master\\") {\\n                    target {\\n                        ... on Commit {\\n                            blame(path: \\"src/sentry/integrations/github/client.py\\") {\\n                                ranges {\\n                                        commit {\\n                                            oid\\n                                            author {\\n                                                name\\n                                                email\\n                                            }\\n                                            message\\n                                            committedDate\\n                                        }\\n                                    startingLine\\n                                    endingLine\\n                                    age\\n                                }\\n                            }\\n                        }\\n                    }\\n                }\\n            }\\n        }"}'
        )

        assert resp == []

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_get_blame_for_file_graphql_errors(self, get_jwt):
        responses.add(
            method=responses.POST,
            url="https://api.github.com/graphql",
            json={"errors": [{"message": "something"}, {"message": "went wrong"}]},
            content_type="application/json",
        )
        with pytest.raises(ApiError) as excinfo:
            self.github_client.get_blame_for_file(self.repo, "foo.py", "main", 1)
        (msg,) = excinfo.value.args
        assert msg == "something, went wrong"

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_get_blame_for_file_graphql_no_branch(self, get_jwt):
        responses.add(
            method=responses.POST,
            url="https://api.github.com/graphql",
            json={},
            content_type="application/json",
        )
        with pytest.raises(ApiError) as excinfo:
            self.github_client.get_blame_for_file(self.repo, "foo.py", "main", 1)
        (msg,) = excinfo.value.args
        assert msg == "Branch does not exist in GitHub."

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
        with mock.patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1"):
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
        with mock.patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1"):
            files = self.github_client.get_cached_repo_files(self.repo.name, "master")
            assert files == ["src/foo.py"]

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
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
            repo=self.repo.name, comment_id="1", data={"body": "world"}
        )
        assert responses.calls[2].response.status_code == 200
        assert responses.calls[2].request.body == b'{"body": "world"}'

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
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


control_address = "http://controlserver"
secret = "hush-hush-im-invisible"


@override_settings(
    SENTRY_SUBNET_SECRET=secret,
    SENTRY_CONTROL_ADDRESS=control_address,
)
class GithubProxyClientTest(TestCase):
    jwt = "my_cool_jwt"
    access_token = "access_token"

    def setUp(self):
        self.integration = self.create_integration(
            id=1,
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
        self.repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="Test-Organization/foo",
            url="https://github.com/Test-Organization/foo",
            provider="integrations:github",
            external_id=123,
            integration_id=self.integration.id,
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
            assert mock_jwt.called
            assert mock_refresh_token.called
            assert token == self.access_token == self.integration.metadata["access_token"]

            # If the access token isn't expired, don't refresh it with an API call
            mock_refresh_token.reset_mock()
            mock_jwt.reset_mock()
            token = self.gh_client._get_token(prepared_request=access_token_request)
            assert not mock_refresh_token.called
            assert not mock_jwt.called
            assert token == self.access_token == self.integration.metadata["access_token"]

            # Meta, app-installation requests should use jwts
            token = self.gh_client._get_token(prepared_request=jwt_request)
            assert mock_jwt.called
            assert not mock_refresh_token.called
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
        class GithubProxyTestClient(GitHubAppsClient):
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

        responses.add(
            method=responses.GET,
            # Use regex to create responses both from proxy and GitHub
            url=re.compile(r"\S+repos/test-repo/issues$"),
            json={"ok": True},
            status=200,
        )

        with override_settings(SILO_MODE=SiloMode.MONOLITH):
            client = GithubProxyTestClient(integration=self.integration)
            client.get_issues("test-repo")
            request = responses.calls[0].request

            assert "/repos/test-repo/issues" in request.url
            assert client.base_url in request.url
            client.assert_proxy_request(request, is_proxy=False)

        responses.calls.reset()
        with override_settings(SILO_MODE=SiloMode.CONTROL):
            client = GithubProxyTestClient(integration=self.integration)
            client.get_issues("test-repo")
            request = responses.calls[0].request

            assert "/repos/test-repo/issues" in request.url
            assert client.base_url in request.url
            client.assert_proxy_request(request, is_proxy=False)

        responses.calls.reset()
        with override_settings(SILO_MODE=SiloMode.REGION):
            client = GithubProxyTestClient(integration=self.integration)
            client.get_issues("test-repo")
            request = responses.calls[0].request

            assert "/repos/test-repo/issues" in request.url
            assert client.base_url not in request.url
            client.assert_proxy_request(request, is_proxy=True)

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

        self.gh_client.integration = None
        with pytest.raises(Exception):
            self.gh_client.get_blame_for_file(self.repo, "foo.py", "main", 1)

        buffer = IntegrationRequestBuffer(self.gh_client._get_redis_key())
        integration = Integration.objects.get(id=self.integration.id)
        assert integration.status == ObjectStatus.DISABLED
        assert [len(item) == 0 for item in buffer._get_broken_range_from_buffer()]
        assert len(buffer._get_all_from_buffer()) == 0

    @responses.activate
    def test_disable_email(self):
        with self.tasks():
            notify_disable(
                self.organization, self.integration.provider, self.gh_client._get_redis_key()
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

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=ApiError)
    @responses.activate
    def test_fatal_integration(self, get_jwt):
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

        self.gh_client.integration = None
        with pytest.raises(Exception):
            self.gh_client.get_blame_for_file(self.repo, "foo.py", "main", 1)
        integration = Integration.objects.get(id=self.integration.id)
        assert integration.status == ObjectStatus.DISABLED

    @responses.activate
    def test_error_integration(self):
        """
        recieve two errors and errors are recorded, integration is not broken yet so no disable
        """
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
        self.gh_client.integration = None
        with pytest.raises(Exception):
            self.gh_client.get_blame_for_file(self.repo, "foo.py", "main", 1)
        with pytest.raises(Exception):
            self.gh_client.get_blame_for_file(self.repo, "foo.py", "main", 1)
        buffer = IntegrationRequestBuffer(self.gh_client._get_redis_key())
        assert int(buffer._get_all_from_buffer()[0]["error_count"]) == 2
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
        buffer = IntegrationRequestBuffer(self.gh_client._get_redis_key())
        now = datetime.now() - timedelta(hours=1)
        for i in reversed(range(10)):
            with freeze_time(now - timedelta(days=i)):
                buffer.record_error()
                buffer.record_success()
        self.gh_client.integration = None
        with pytest.raises(Exception):
            self.gh_client.get_blame_for_file(self.repo, "foo.py", "main", 1)
        assert buffer.is_integration_broken() is False
        assert Integration.objects.get(id=self.integration.id).status == ObjectStatus.ACTIVE

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
            json={
                "message": "Not found",
            },
        )
        buffer = IntegrationRequestBuffer(self.gh_client._get_redis_key())
        now = datetime.now() - timedelta(hours=1)
        for i in reversed(range(10)):
            with freeze_time(now - timedelta(days=i)):
                buffer.record_error()
        self.gh_client.integration = None
        assert Integration.objects.get(id=self.integration.id).status == ObjectStatus.ACTIVE
        with pytest.raises(Exception):
            self.gh_client.get_blame_for_file(self.repo, "foo.py", "main", 1)
        assert Integration.objects.get(id=self.integration.id).status == ObjectStatus.DISABLED
