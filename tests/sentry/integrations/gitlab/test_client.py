from __future__ import annotations

import base64
from dataclasses import asdict
from datetime import datetime, timezone
from unittest import mock
from urllib.parse import quote

import pytest
import responses

from fixtures.gitlab import GET_COMMIT_RESPONSE, GitLabTestCase
from sentry.auth.exceptions import IdentityNotValid
from sentry.integrations.gitlab.blame import GitLabCommitResponse, GitLabFileBlameResponseItem
from sentry.integrations.gitlab.utils import get_rate_limit_info_from_response
from sentry.integrations.mixins.commit_context import CommitInfo, FileBlameInfo, SourceLineInfo
from sentry.models.identity import Identity
from sentry.shared_integrations.exceptions import ApiError, ApiRateLimitedError
from sentry.testutils.silo import control_silo_test
from sentry.utils import json
from sentry.utils.cache import cache

GITLAB_CODEOWNERS = {
    "filepath": "CODEOWNERS",
    "html_url": "https://gitlab.com/org/reponame/CODEOWNERS",
    "raw": "docs/*    @NisanthanNanthakumar   @getsentry/ecosystem\n* @NisanthanNanthakumar\n",
}


class GitLabClientTest(GitLabTestCase):
    def setUp(self):
        super().setUp()
        self.gitlab_client = self.installation.get_client()
        self.gitlab_client.base_url = "https://example.gitlab.com/"
        self.request_data = {"id": "user_id"}
        self.request_url = "https://example.gitlab.com/api/v4/user"
        self.refresh_url = "https://example.gitlab.com/oauth/token"
        self.refresh_response = {
            "access_token": "123432sfh29uhs29347",
            "token_type": "bearer",
            "refresh_token": "29f43sdfsk22fsj929",
            "created_at": 1536798907,
            "scope": "api",
        }
        self.repo = self.create_repo(name="Test-Org/foo", external_id=123)
        self.original_identity_data = dict(self.gitlab_client.identity.data)
        self.gitlab_id = 123


@control_silo_test
class GitlabRefreshAuthTest(GitLabClientTest):
    get_user_should_succeed = True

    def setUp(self):
        super().setUp()

    def tearDown(self):
        responses.reset()

    def make_users_request(self):
        return self.gitlab_client.get_user()

    def add_refresh_auth(self, success=True):
        responses.add(
            responses.POST,
            self.refresh_url,
            status=200 if success else 401,
            json=self.refresh_response if success else {},
        )

    def add_get_user_response(self, success):
        responses.add(
            responses.GET,
            self.request_url,
            json=self.request_data if success else {},
            status=200 if success else 401,
        )

    def assert_response_call(self, call, url, status):
        assert call.request.url == url
        assert call.response.status_code == status

    def assert_data(self, data, expected_data):
        assert data["access_token"] == expected_data["access_token"]
        assert data["refresh_token"] == expected_data["refresh_token"]
        assert data["created_at"] == expected_data["created_at"]

    def assert_request_failed_refresh(self):
        responses_calls = responses.calls
        assert len(responses_calls) == 2

        self.assert_response_call(responses_calls[0], self.request_url, 401)
        self.assert_response_call(responses_calls[1], self.refresh_url, 401)

    def assert_request_with_refresh(self):
        responses_calls = responses.calls
        assert len(responses_calls) == 3

        self.assert_response_call(responses_calls[0], self.request_url, 401)
        self.assert_response_call(responses_calls[1], self.refresh_url, 200)
        self.assert_response_call(responses_calls[2], self.request_url, 200)

        assert json.loads(responses_calls[2].response.text) == self.request_data

    def assert_identity_was_refreshed(self):
        data = self.gitlab_client.identity.data
        self.assert_data(data, self.refresh_response)

        data = Identity.objects.get(id=self.gitlab_client.identity.id).data
        self.assert_data(data, self.refresh_response)

    def assert_identity_was_not_refreshed(self):
        data = self.gitlab_client.identity.data
        self.assert_data(data, self.original_identity_data)

        data = Identity.objects.get(id=self.gitlab_client.identity.id).data
        self.assert_data(data, self.original_identity_data)

    @responses.activate
    def test_refresh_auth_flow(self):
        # Fail first then succeed
        self.add_get_user_response(success=False)
        self.add_get_user_response(success=True)

        self.add_refresh_auth(success=True)

        resp = self.make_users_request()
        self.assert_request_with_refresh()
        assert resp == self.request_data
        self.assert_identity_was_refreshed()

    @responses.activate
    def test_refresh_auth_fails_gracefully(self):
        self.add_get_user_response(success=False)
        self.add_refresh_auth(success=False)

        with pytest.raises(IdentityNotValid):
            self.make_users_request()

        self.assert_request_failed_refresh()
        self.assert_identity_was_not_refreshed()

    @responses.activate
    def test_no_refresh_when_api_call_successful(self):
        self.add_get_user_response(success=True)
        resp = self.make_users_request()

        assert len(responses.calls) == 1
        call = responses.calls[0]
        self.assert_response_call(call, self.request_url, 200)
        assert resp == self.request_data
        self.assert_identity_was_not_refreshed()

    @responses.activate
    def test_check_file(self):
        path = "src/file.py"
        ref = "537f2e94fbc489b2564ca3d6a5f0bd9afa38c3c3"
        responses.add(
            responses.HEAD,
            f"https://example.gitlab.com/api/v4/projects/{self.gitlab_id}/repository/files/src%2Ffile.py?ref={ref}",
            json={"text": 200},
        )

        resp = self.gitlab_client.check_file(self.repo, path, ref)
        assert responses.calls[0].response.status_code == 200
        assert resp.status_code == 200

    @responses.activate
    def test_check_no_file(self):
        path = "src/file.py"
        ref = "537f2e94fbc489b2564ca3d6a5f0bd9afa38c3c3"
        responses.add(
            responses.HEAD,
            f"https://example.gitlab.com/api/v4/projects/{self.gitlab_id}/repository/files/src%2Ffile.py?ref={ref}",
            status=404,
        )
        with pytest.raises(ApiError):
            self.gitlab_client.check_file(self.repo, path, ref)
        assert responses.calls[0].response.status_code == 404

    @responses.activate
    def test_get_stacktrace_link(self):
        path = "/src/file.py"
        ref = "537f2e94fbc489b2564ca3d6a5f0bd9afa38c3c3"
        responses.add(
            responses.HEAD,
            f"https://example.gitlab.com/api/v4/projects/{self.gitlab_id}/repository/files/src%2Ffile.py?ref={ref}",
            json={"text": 200},
        )

        source_url = self.installation.get_stacktrace_link(self.repo, path, "master", ref)
        assert (
            source_url
            == "https://example.gitlab.com/example-repo/blob/537f2e94fbc489b2564ca3d6a5f0bd9afa38c3c3/src/file.py"
        )

    @mock.patch(
        "sentry.integrations.gitlab.integration.GitlabIntegration.check_file",
        return_value=GITLAB_CODEOWNERS["html_url"],
    )
    @responses.activate
    def test_get_codeowner_file(self, mock_check_file):
        self.config = self.create_code_mapping(
            repo=self.repo,
            project=self.project,
        )
        responses.add(
            method=responses.GET,
            url=f"https://example.gitlab.com/api/v4/projects/{self.gitlab_id}/repository/files/CODEOWNERS?ref=master",
            json={"content": base64.b64encode(GITLAB_CODEOWNERS["raw"].encode()).decode("ascii")},
        )
        result = self.installation.get_codeowner_file(
            self.config.repository, ref=self.config.default_branch
        )

        assert result == GITLAB_CODEOWNERS

    @responses.activate
    def test_get_commit(self):
        commit = "a" * 40
        responses.add(
            method=responses.GET,
            url=f"https://example.gitlab.com/api/v4/projects/{self.gitlab_id}/repository/commits/{commit}",
            json=json.loads(GET_COMMIT_RESPONSE),
        )

        resp = self.gitlab_client.get_commit(self.gitlab_id, commit)
        assert resp == json.loads(GET_COMMIT_RESPONSE)

    @responses.activate
    def test_get_rate_limit_info_from_response(self):
        """
        When rate limit headers present, parse them and return a GitLabRateLimitInfo object
        """
        responses.add(
            responses.GET,
            self.request_url,
            json={},
            status=200,
            adding_headers={
                "RateLimit-Limit": "1000",
                "RateLimit-Remaining": "999",
                "RateLimit-Reset": "1372700873",
                "RateLimit-Observed": "1",
            },
        )
        resp = self.gitlab_client.get_user()

        rate_limit_info = get_rate_limit_info_from_response(resp)

        assert rate_limit_info

        assert rate_limit_info.limit == 1000
        assert rate_limit_info.remaining == 999
        assert rate_limit_info.used == 1
        assert rate_limit_info.reset == 1372700873
        assert rate_limit_info.next_window() == "17:47:53"

    @responses.activate
    def test_get_rate_limit_info_from_response_invalid(self):
        """
        When rate limit headers are not present, handle gracefully and return None
        """
        responses.add(
            responses.GET,
            self.request_url,
            json={},
            status=200,
        )
        resp = self.gitlab_client.get_user()

        rate_limit_info = get_rate_limit_info_from_response(resp)

        assert not rate_limit_info


@control_silo_test
class GitLabBlameForFilesTest(GitLabClientTest):
    def setUp(self):
        super().setUp()
        self.cache_key = "integration.gitlab.client:90c877e3983404c2ccf5756f578abd5f"
        self.cache_key2 = "integration.gitlab.client:4d9a6af2411001e36cd3b66f50c1bf78"
        self.cache_key3 = "integration.gitlab.client:9cae8cea1a0f2b48037a956e61b7134c"
        self.file_1 = SourceLineInfo(
            path="src/sentry/integrations/github/client_1.py",
            lineno=10,
            ref="master",
            repo=self.repo,
            code_mapping=None,  # type: ignore
        )
        self.file_2 = SourceLineInfo(
            path="src/sentry/integrations/github/client_1.py",
            lineno=15,
            ref="master",
            repo=self.repo,
            code_mapping=None,  # type: ignore
        )
        self.file_3 = SourceLineInfo(
            path="src/sentry/integrations/github/client_2.py",
            lineno=20,
            ref="master",
            repo=self.repo,
            code_mapping=None,  # type: ignore
        )
        self.file_4 = SourceLineInfo(
            path="src/sentry/integrations/github/client_3.py",
            lineno=20,
            ref="master",
            repo=self.repo,
            code_mapping=None,  # type: ignore
        )
        self.blame_1 = FileBlameInfo(
            **asdict(self.file_1),
            commit=CommitInfo(
                commitId="1",
                commitMessage="test message",
                committedDate=datetime(2023, 1, 1, 0, 0, 0, tzinfo=timezone.utc),
                commitAuthorEmail="marvin@place.com",
                commitAuthorName="Marvin",
            ),
        )
        self.blame_2 = FileBlameInfo(
            **asdict(self.file_2),
            commit=CommitInfo(
                commitId="2",
                commitMessage="test message",
                committedDate=datetime(2023, 1, 1, 0, 0, 0, tzinfo=timezone.utc),
                commitAuthorEmail="marvin@place.com",
                commitAuthorName="Marvin",
            ),
        )
        self.blame_3 = FileBlameInfo(
            **asdict(self.file_3),
            commit=CommitInfo(
                commitId="3",
                commitMessage="test message",
                committedDate=datetime(2023, 1, 1, 0, 0, 0, tzinfo=timezone.utc),
                commitAuthorEmail="marvin@place.com",
                commitAuthorName="Marvin",
            ),
        )

    def set_up_success_responses(self):
        responses.add(
            responses.GET,
            url=self.make_blame_request(self.file_1),
            json=self.make_blame_response(id="1"),
            status=200,
        )
        responses.add(
            responses.GET,
            url=self.make_blame_request(self.file_2),
            json=self.make_blame_response(id="2"),
            status=200,
        )
        responses.add(
            responses.GET,
            url=self.make_blame_request(self.file_3),
            json=self.make_blame_response(id="3"),
            status=200,
        )

    def make_blame_request(self, file: SourceLineInfo) -> str:
        return f"https://example.gitlab.com/api/v4/projects/{self.gitlab_id}/repository/files/{quote(file.path.strip('/'), safe='')}/blame?ref={file.ref}&range[start]={file.lineno}&range[end]={file.lineno}"

    def make_blame_response(self, **kwargs) -> list[GitLabFileBlameResponseItem]:
        return [
            GitLabFileBlameResponseItem(
                lines=[],
                commit=GitLabCommitResponse(
                    id=kwargs.get("id", "1"),
                    message=kwargs.get("message", "test message"),
                    committed_date=kwargs.get("committed_date", "2023-01-01T00:00:00.000Z"),
                    author_name=kwargs.get("author_name", "Marvin"),
                    author_email=kwargs.get("author_email", "marvin@place.com"),
                    committer_email=None,
                    committer_name=None,
                ),
            )
        ]

    @responses.activate
    def test_success_single_file(self):
        self.set_up_success_responses()
        resp = self.gitlab_client.get_blame_for_files(files=[self.file_1], extra={})

        assert resp == [self.blame_1]

    @responses.activate
    def test_success_single_file_cached(self):
        self.set_up_success_responses()
        assert cache.get(self.cache_key) is None
        resp = self.gitlab_client.get_blame_for_files(files=[self.file_1], extra={})
        assert resp == [self.blame_1]
        assert cache.get(self.cache_key) == self.make_blame_response(id="1")

        # Nothing changes if we call it again
        resp = self.gitlab_client.get_blame_for_files(files=[self.file_1], extra={})
        assert cache.get(self.cache_key) == self.make_blame_response(id="1")

        # Calling again after the cache has been cleared should still work
        cache.delete(self.cache_key)
        resp = self.gitlab_client.get_blame_for_files(files=[self.file_1], extra={})
        assert cache.get(self.cache_key) == self.make_blame_response(id="1")

    @responses.activate
    def test_success_multiple_files(self):
        self.set_up_success_responses()
        resp = self.gitlab_client.get_blame_for_files(
            files=[self.file_1, self.file_2, self.file_3], extra={}
        )
        assert resp == [self.blame_1, self.blame_2, self.blame_3]

    @responses.activate
    def test_success_multiple_files_cached(self):
        self.set_up_success_responses()
        assert cache.get(self.cache_key) is None
        resp = self.gitlab_client.get_blame_for_files(
            files=[self.file_1, self.file_2, self.file_3], extra={}
        )

        assert resp == [self.blame_1, self.blame_2, self.blame_3]
        assert cache.get(self.cache_key) == self.make_blame_response(id="1")
        assert cache.get(self.cache_key2) == self.make_blame_response(id="2")
        assert cache.get(self.cache_key3) == self.make_blame_response(id="3")

        # Nothing changes if we call it again
        resp = self.gitlab_client.get_blame_for_files(
            files=[self.file_1, self.file_2, self.file_3], extra={}
        )
        assert cache.get(self.cache_key) == self.make_blame_response(id="1")
        assert cache.get(self.cache_key2) == self.make_blame_response(id="2")
        assert cache.get(self.cache_key3) == self.make_blame_response(id="3")

        # Calling again after the cache has been cleared should still work
        cache.delete(self.cache_key)
        resp = self.gitlab_client.get_blame_for_files(
            files=[self.file_1, self.file_2, self.file_3], extra={}
        )
        assert cache.get(self.cache_key) == self.make_blame_response(id="1")
        assert cache.get(self.cache_key2) == self.make_blame_response(id="2")
        assert cache.get(self.cache_key3) == self.make_blame_response(id="3")

        assert resp != self.gitlab_client.get_blame_for_files(
            files=[self.file_1, self.file_2], extra={}
        )

    @mock.patch(
        "sentry.integrations.gitlab.blame.logger.warning",
    )
    @responses.activate
    def test_failure_404(self, mock_logger_warning):
        responses.add(
            responses.GET, self.make_blame_request(self.file_1), status=404, body="No file found"
        )
        resp = self.gitlab_client.get_blame_for_files(files=[self.file_1], extra={})

        assert resp == []
        mock_logger_warning.assert_called_with(
            "get_blame_for_files.api_error",
            extra={
                "provider": "gitlab",
                "org_integration_id": self.gitlab_client.org_integration_id,
                "code": 404,
                "error_message": "No file found",
                "repo_name": self.repo.name,
                "file_path": self.file_1.path,
                "branch_name": self.file_1.ref,
                "file_lineno": self.file_1.lineno,
            },
        )

    @responses.activate
    def test_failure_response_type(self):
        responses.add(responses.GET, self.make_blame_request(self.file_1), json={}, status=200)

        with pytest.raises(ApiError):
            self.gitlab_client.get_blame_for_files(files=[self.file_1], extra={})

    @mock.patch(
        "sentry.integrations.gitlab.blame.logger.error",
    )
    @responses.activate
    def test_failure_approaching_rate_limit(self, mock_logger_error):
        """
        If there aren't enough requests left to stay above the minimum request
        limit, should raise a ApiRateLimitedError.
        """
        responses.add(
            responses.GET,
            self.make_blame_request(self.file_1),
            adding_headers={
                "RateLimit-Limit": "1000",
                "RateLimit-Remaining": "10",
                "RateLimit-Reset": "1372700873",
                "RateLimit-Observed": "900",
            },
            json=self.make_blame_response(id="1"),
            status=200,
        )

        with pytest.raises(ApiRateLimitedError) as excinfo:
            self.gitlab_client.get_blame_for_files(files=[self.file_1, self.file_2], extra={})

        assert excinfo.value.text == "Approaching GitLab API rate limit"
        mock_logger_error.assert_called_with(
            "get_blame_for_files.rate_limit_too_low",
            extra={
                "provider": "gitlab",
                "org_integration_id": self.gitlab_client.org_integration_id,
                "num_files": 2,
                "remaining_requests": 10,
                "total_requests": 1000,
                "next_window": "17:47:53",
            },
        )

    @mock.patch(
        "sentry.integrations.gitlab.blame.logger.warning",
    )
    @responses.activate
    def test_failure_partial_expected(self, mock_logger_warning):
        """
        Tests that blames are still returned when some succeed
        and others fail.
        """
        # First file doesn't exist, second returns successfully
        responses.add(responses.GET, self.make_blame_request(self.file_1), status=404)
        responses.add(
            responses.GET,
            url=self.make_blame_request(self.file_2),
            json=self.make_blame_response(id="2"),
            status=200,
        )
        resp = self.gitlab_client.get_blame_for_files(files=[self.file_1, self.file_2], extra={})

        # Should return the successful response
        assert resp == [self.blame_2]

        # Should log the unsuccessful one
        mock_logger_warning.assert_called_once()
        mock_logger_warning.assert_called_with(
            "get_blame_for_files.api_error",
            extra={
                "code": 404,
                "error_message": "",
                "provider": "gitlab",
                "org_integration_id": self.gitlab_client.org_integration_id,
                "repo_name": self.repo.name,
                "file_path": self.file_1.path,
                "branch_name": self.file_1.ref,
                "file_lineno": self.file_1.lineno,
            },
        )

    @responses.activate
    def test_failure_partial_fatal(self):
        """
        Tests that the function is aborted when a fatal response is returned
        """
        # First file returns a 500
        responses.add(responses.GET, self.make_blame_request(self.file_1), status=500)

        with pytest.raises(ApiError):
            self.gitlab_client.get_blame_for_files(files=[self.file_1, self.file_2], extra={})

    @responses.activate
    def test_invalid_commits(self):
        """
        Tests that commits lacking required data are thrown out
        """
        responses.add(
            responses.GET,
            url=self.make_blame_request(self.file_1),
            json=self.make_blame_response(id=None),
            status=200,
        )
        responses.add(
            responses.GET,
            url=self.make_blame_request(self.file_2),
            json=self.make_blame_response(committed_date=None),
            status=200,
        )
        responses.add(
            responses.GET,
            url=self.make_blame_request(self.file_3),
            json=self.make_blame_response(committed_date="invalid date format"),
            status=200,
        )
        responses.add(
            responses.GET,
            url=self.make_blame_request(self.file_4),
            json=[{"lines": [], "commit": None}],
            status=200,
        )
        resp = self.gitlab_client.get_blame_for_files(
            files=[self.file_1, self.file_2, self.file_3, self.file_4], extra={}
        )

        assert resp == []
