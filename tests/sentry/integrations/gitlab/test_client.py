from __future__ import annotations

from dataclasses import asdict
from datetime import datetime, timedelta, timezone
from time import time
from typing import Any
from unittest import mock
from urllib.parse import quote

import orjson
import pytest
import responses
from responses import matchers

from fixtures.gitlab import GET_COMMIT_RESPONSE, GitLabTestCase
from sentry.auth.exceptions import IdentityNotValid
from sentry.exceptions import RestrictedIPAddress
from sentry.integrations.gitlab.blame import GitLabCommitResponse, GitLabFileBlameResponseItem
from sentry.integrations.gitlab.client import (
    GITLAB_WEBHOOK_REQUEST_TIMEOUT,
    GitLabApiRequestType,
)
from sentry.integrations.gitlab.utils import get_rate_limit_info_from_response
from sentry.integrations.source_code_management.commit_context import (
    CommitInfo,
    FileBlameInfo,
    SourceLineInfo,
)
from sentry.integrations.source_code_management.metrics import SCMIntegrationInteractionType
from sentry.integrations.types import EventLifecycleOutcome
from sentry.shared_integrations.exceptions import (
    ApiError,
    ApiHostError,
    ApiRateLimitedError,
    ApiRetryError,
)
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import control_silo_test
from sentry.users.models.identity import Identity
from sentry.utils.cache import cache
from sentry.utils.locking import UnableToAcquireLock
from sentry.utils.locking.lock import Lock

GITLAB_CODEOWNERS = {
    "filepath": "CODEOWNERS",
    "html_url": "https://gitlab.com/org/reponame/CODEOWNERS",
    "raw": "docs/*    @NisanthanNanthakumar   @getsentry/ecosystem\n* @NisanthanNanthakumar\n",
}


class GitLabClientTest(GitLabTestCase):
    def setUp(self) -> None:
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
        self.repo = self.create_gitlab_repo(name="Test-Org/foo", external_id=123)
        self.original_identity_data = dict(self.gitlab_client.identity.data)
        self.gitlab_id = 123

    def store_identity_data(self, **data: Any) -> None:
        identity = Identity.objects.get(id=self.gitlab_client.identity.id)
        identity.data.update(data)
        identity.save()

    def get_stored_identity_data(self) -> dict[str, Any]:
        return Identity.objects.get(id=self.gitlab_client.identity.id).data


@control_silo_test
@freeze_time("2025-01-01T05:22:00Z")
class GitLabGetAccessTokenTest(GitLabClientTest):
    def set_expires(self, expires: int) -> None:
        # The client holds the stored identity, so keep both in step.
        self.gitlab_client.identity.data["expires"] = expires
        self.store_identity_data(expires=expires)

    @responses.activate
    def test_returns_token_dict(self) -> None:
        self.set_expires(int(time()) + 3600)

        result = self.gitlab_client.get_access_token()

        assert result == {
            "access_token": "123456789",
            "expires_at": "2025-01-01T06:17:00+00:00",
            "permissions": None,
        }
        assert len(responses.calls) == 0

    @responses.activate
    def test_returns_none_when_token_empty(self) -> None:
        self.set_expires(int(time()) + 3600)
        self.gitlab_client.identity.data["access_token"] = ""
        result = self.gitlab_client.get_access_token()
        assert result is None

    @responses.activate
    def test_refreshes_a_token_about_to_expire(self) -> None:
        self.set_expires(int(time()) + 60)
        responses.add(
            responses.POST, self.refresh_url, json={**self.refresh_response, "expires_in": 3600}
        )

        result = self.gitlab_client.get_access_token()

        assert result == {
            "access_token": "123432sfh29uhs29347",
            "expires_at": "2025-01-01T06:17:00+00:00",
            "permissions": None,
        }
        assert len(responses.calls) == 1
        stored = self.get_stored_identity_data()
        assert stored["access_token"] == "123432sfh29uhs29347"
        assert stored["refresh_token"] == "29f43sdfsk22fsj929"
        assert stored["expires"] == int(time()) + 3600

    @responses.activate
    def test_refreshes_a_token_within_the_requested_margin(self) -> None:
        self.set_expires(int(time()) + 8 * 60)
        responses.add(
            responses.POST, self.refresh_url, json={**self.refresh_response, "expires_in": 3600}
        )

        result = self.gitlab_client.get_access_token(
            token_minimum_validity_time=timedelta(minutes=10)
        )

        assert result == {
            "access_token": "123432sfh29uhs29347",
            "expires_at": "2025-01-01T06:12:00+00:00",
            "permissions": None,
        }
        assert len(responses.calls) == 1

    @responses.activate
    def test_refreshes_a_token_with_no_recorded_expiry(self) -> None:
        """GitLab before 15.0 can answer without an expiry too; the usual two hours is assumed."""
        assert "expires" not in self.gitlab_client.identity.data
        responses.add(responses.POST, self.refresh_url, json=self.refresh_response)

        result = self.gitlab_client.get_access_token()

        assert result == {
            "access_token": "123432sfh29uhs29347",
            "expires_at": "2025-01-01T07:17:00+00:00",
            "permissions": None,
        }
        assert self.get_stored_identity_data()["expires"] == int(time()) + 7200

    @responses.activate
    def test_keeps_a_short_lived_token_for_half_its_lifetime(self) -> None:
        self.store_identity_data(expires_in=300)
        self.gitlab_client.identity.data["expires_in"] = 300
        self.set_expires(int(time()) + 200)

        result = self.gitlab_client.get_access_token()

        assert result == {
            "access_token": "123456789",
            "expires_at": "2025-01-01T05:22:50+00:00",
            "permissions": None,
        }
        assert len(responses.calls) == 0

    @responses.activate
    def test_refreshes_a_short_lived_token_only_once(self) -> None:
        """A margin as long as the lifetime would refresh the new token again on every call."""
        self.set_expires(int(time()) + 60)
        responses.add(
            responses.POST, self.refresh_url, json={**self.refresh_response, "expires_in": 300}
        )

        first = self.gitlab_client.get_access_token()
        second = self.gitlab_client.get_access_token()

        assert (
            first
            == second
            == {
                "access_token": "123432sfh29uhs29347",
                "expires_at": "2025-01-01T05:24:30+00:00",
                "permissions": None,
            }
        )
        assert len(responses.calls) == 1
        assert self.get_stored_identity_data()["expires_in"] == 300

    @responses.activate
    def test_returns_the_stored_token_without_a_refresh_token(self) -> None:
        self.set_expires(int(time()) + 60)
        del self.gitlab_client.identity.data["refresh_token"]

        result = self.gitlab_client.get_access_token()

        assert result == {
            "access_token": "123456789",
            "expires_at": "2025-01-01T05:18:00+00:00",
            "permissions": None,
        }
        assert len(responses.calls) == 0

    @responses.activate
    def test_uses_a_token_another_request_refreshed(self) -> None:
        # This client still holds the expiring token, while another request has
        # since stored a fresh one. Refreshing again would use a revoked refresh token.
        self.gitlab_client.identity.data["expires"] = int(time()) + 60
        self.store_identity_data(access_token="fresh-token", expires=int(time()) + 7200)

        result = self.gitlab_client.get_access_token()

        assert result == {
            "access_token": "fresh-token",
            "expires_at": "2025-01-01T07:17:00+00:00",
            "permissions": None,
        }
        assert len(responses.calls) == 0

    @responses.activate
    @mock.patch.object(Lock, "blocking_acquire", side_effect=UnableToAcquireLock)
    def test_uses_a_token_stored_while_another_refresh_held_the_lock(
        self, mock_acquire: mock.MagicMock
    ) -> None:
        self.gitlab_client.identity.data["expires"] = int(time()) + 60
        self.store_identity_data(access_token="fresh-token", expires=int(time()) + 7200)

        result = self.gitlab_client.get_access_token()

        assert result is not None
        assert result["access_token"] == "fresh-token"
        assert len(responses.calls) == 0

    @responses.activate
    @mock.patch.object(Lock, "blocking_acquire", side_effect=UnableToAcquireLock)
    def test_raises_when_another_refresh_holds_the_lock_and_stored_nothing(
        self, mock_acquire: mock.MagicMock
    ) -> None:
        self.set_expires(int(time()) + 60)

        with pytest.raises(UnableToAcquireLock):
            self.gitlab_client.get_access_token()

        assert len(responses.calls) == 0

    @responses.activate
    def test_raises_when_gitlab_refuses_the_refresh(self) -> None:
        self.set_expires(int(time()) + 60)
        responses.add(responses.POST, self.refresh_url, status=400, json={"error": "invalid_grant"})

        with pytest.raises(IdentityNotValid):
            self.gitlab_client.get_access_token()

        assert self.get_stored_identity_data()["access_token"] == "123456789"

    @responses.activate
    def test_raises_api_error_when_gitlab_answers_without_a_token(self) -> None:
        """A redirect or a proxy's HTML page, rather than a token."""
        self.set_expires(int(time()) + 60)
        responses.add(responses.POST, self.refresh_url, status=302, body="<html></html>")

        with pytest.raises(ApiError):
            self.gitlab_client.get_access_token()

        assert self.get_stored_identity_data()["access_token"] == "123456789"


@control_silo_test
class GitlabRefreshAuthTest(GitLabClientTest):
    get_user_should_succeed = True

    def setUp(self) -> None:
        super().setUp()

    def tearDown(self) -> None:
        responses.reset()

    def make_users_request(self):
        return self.gitlab_client.get_user()

    def add_user_responses_accepting_only_the_fresh_token(self) -> None:
        responses.add(
            responses.GET,
            self.request_url,
            status=401,
            json={},
            match=[matchers.header_matcher({"Authorization": "Bearer 123456789"})],
        )
        responses.add(
            responses.GET,
            self.request_url,
            json=self.request_data,
            match=[matchers.header_matcher({"Authorization": "Bearer fresh-token"})],
        )

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

        assert orjson.loads(responses_calls[2].response.text) == self.request_data

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
    def test_refresh_auth_flow(self) -> None:
        # Fail first then succeed
        self.add_get_user_response(success=False)
        self.add_get_user_response(success=True)

        self.add_refresh_auth(success=True)

        resp = self.make_users_request()
        self.assert_request_with_refresh()
        assert resp == self.request_data
        self.assert_identity_was_refreshed()

    @responses.activate
    def test_retries_with_a_token_another_request_stored(self) -> None:
        """Refreshing with this client's refresh token would fail: the other refresh revoked it."""
        self.store_identity_data(access_token="fresh-token", refresh_token="fresh-refresh")
        self.add_user_responses_accepting_only_the_fresh_token()

        resp = self.make_users_request()

        assert resp == self.request_data
        assert len(responses.calls) == 2

    @responses.activate
    @mock.patch.object(Lock, "blocking_acquire", side_effect=UnableToAcquireLock)
    def test_retries_with_the_stored_token_while_another_refresh_holds_the_lock(
        self, mock_acquire: mock.MagicMock
    ) -> None:
        self.store_identity_data(access_token="fresh-token")
        self.add_user_responses_accepting_only_the_fresh_token()

        assert self.make_users_request() == self.request_data

    @responses.activate
    def test_resets_the_refresh_flag_when_the_retry_fails(self) -> None:
        self.add_get_user_response(success=False)
        self.add_refresh_auth(success=True)
        responses.add(responses.GET, self.request_url, status=404, json={})

        with pytest.raises(ApiError):
            self.make_users_request()

        assert self.gitlab_client.is_refreshing_token is False

    @responses.activate
    def test_refresh_auth_fails_gracefully(self) -> None:
        self.add_get_user_response(success=False)
        self.add_refresh_auth(success=False)

        with pytest.raises(IdentityNotValid):
            self.make_users_request()

        self.assert_request_failed_refresh()
        self.assert_identity_was_not_refreshed()

    @responses.activate
    def test_no_refresh_when_api_call_successful(self) -> None:
        self.add_get_user_response(success=True)
        resp = self.make_users_request()

        assert len(responses.calls) == 1
        call = responses.calls[0]
        self.assert_response_call(call, self.request_url, 200)
        assert resp == self.request_data
        self.assert_identity_was_not_refreshed()

    @responses.activate
    def test_check_file(self) -> None:
        path = "src/file.py"
        ref = "537f2e94fbc489b2564ca3d6a5f0bd9afa38c3c3"
        responses.add(
            responses.HEAD,
            f"https://example.gitlab.com/api/v4/projects/{self.gitlab_id}/repository/files/src%2Ffile.py?ref={ref}",
            json={"text": 200},
        )

        resp = self.gitlab_client.check_file(self.repo, path, ref)
        assert responses.calls[0].response.status_code == 200
        assert resp  # this is None on error

    @responses.activate
    def test_check_no_file(self) -> None:
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
    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_get_stacktrace_link(self, mock_record: mock.MagicMock) -> None:
        path = "/src/file.py"
        ref = "537f2e94fbc489b2564ca3d6a5f0bd9afa38c3c3"
        responses.add(
            responses.HEAD,
            f"https://example.gitlab.com/api/v4/projects/{self.gitlab_id}/repository/files/src%2Ffile.py?ref={ref}",
            json={"text": 200},
        )

        with mock.patch.object(
            self.installation,
            "check_file",
            wraps=self.installation.check_file,
        ) as mock_check_file:
            source_url = self.installation.get_stacktrace_link(self.repo, path, "master", ref)
        assert (
            source_url
            == "https://example.gitlab.com/example-repo/blob/537f2e94fbc489b2564ca3d6a5f0bd9afa38c3c3/src/file.py"
        )
        mock_check_file.assert_called_once_with(
            self.repo,
            path,
            ref,
            parent_interaction_type=SCMIntegrationInteractionType.GET_STACKTRACE_LINK,
        )
        assert len(mock_record.mock_calls) == 2
        assert mock_record.mock_calls[0].args[0] == EventLifecycleOutcome.STARTED
        assert mock_record.mock_calls[1].args[0] == EventLifecycleOutcome.SUCCESS

    @responses.activate
    @mock.patch(
        "sentry.integrations.gitlab.client.GitLabApiClient.check_file",
        side_effect=ApiRetryError(text="retry error"),
    )
    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_get_stacktrace_link_retry_error(
        self, mock_record: mock.MagicMock, mock_check_file: mock.MagicMock
    ) -> None:
        path = "/src/file.py"
        ref = "537f2e94fbc489b2564ca3d6a5f0bd9afa38c3c3"
        responses.add(
            responses.HEAD,
            f"https://example.gitlab.com/api/v4/projects/{self.gitlab_id}/repository/files/src%2Ffile.py?ref={ref}",
            json={"text": 200},
        )

        source_url = self.installation.get_stacktrace_link(self.repo, path, "master", None)
        assert source_url is None
        assert len(mock_record.mock_calls) == 2
        assert mock_record.mock_calls[0].args[0] == EventLifecycleOutcome.STARTED
        assert mock_record.mock_calls[1].args[0] == EventLifecycleOutcome.SUCCESS

    @responses.activate
    @mock.patch("requests.sessions.Session.send")
    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_get_stacktrace_link_restricted_ip_address(
        self, mock_record: mock.MagicMock, mock_send: mock.MagicMock
    ) -> None:
        path = "/src/file.py"
        ref = "537f2e94fbc489b2564ca3d6a5f0bd9afa38c3c3"
        responses.add(
            responses.HEAD,
            f"https://example.gitlab.com/api/v4/projects/{self.gitlab_id}/repository/files/src%2Ffile.py?ref={ref}",
            json={"text": 200},
        )
        mock_send.side_effect = RestrictedIPAddress

        with pytest.raises(ApiHostError):
            self.installation.get_stacktrace_link(self.repo, path, "master", None)

        assert len(mock_record.mock_calls) == 2
        assert mock_record.mock_calls[0].args[0] == EventLifecycleOutcome.STARTED
        assert mock_record.mock_calls[1].args[0] == EventLifecycleOutcome.HALTED

    @mock.patch(
        "sentry.integrations.gitlab.integration.GitlabIntegration.check_file",
        return_value=GITLAB_CODEOWNERS["html_url"],
    )
    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @responses.activate
    def test_get_codeowner_file(
        self, mock_record: mock.MagicMock, mock_check_file: mock.MagicMock
    ) -> None:
        self.config = self.create_code_mapping(
            repo=self.repo,
            project=self.project,
        )
        responses.add(
            method=responses.GET,
            url=f"https://example.gitlab.com/api/v4/projects/{self.gitlab_id}/repository/files/CODEOWNERS/raw?ref=master",
            body="docs/*    @NisanthanNanthakumar   @getsentry/ecosystem\n* @NisanthanNanthakumar\n",
        )
        result = self.installation.get_codeowner_file(
            self.config.project_repository.repository, ref=self.config.default_branch
        )

        assert result == GITLAB_CODEOWNERS
        mock_check_file.assert_called_once_with(
            self.config.project_repository.repository,
            "CODEOWNERS",
            self.config.default_branch,
            parent_interaction_type=SCMIntegrationInteractionType.GET_CODEOWNER_FILE,
        )

        assert (
            len(mock_record.mock_calls) == 2
        )  # check_file is mocked in this test, so there will be no metrics logged for it
        assert mock_record.mock_calls[0].args[0] == EventLifecycleOutcome.STARTED
        assert mock_record.mock_calls[1].args[0] == EventLifecycleOutcome.SUCCESS

    @responses.activate
    def test_get_commit(self) -> None:
        commit = "a" * 40
        responses.add(
            method=responses.GET,
            url=f"https://example.gitlab.com/api/v4/projects/{self.gitlab_id}/repository/commits/{commit}",
            json=orjson.loads(GET_COMMIT_RESPONSE),
        )

        resp = self.gitlab_client.get_commit(self.gitlab_id, commit)
        assert resp == orjson.loads(GET_COMMIT_RESPONSE)

    @responses.activate
    def test_get_repository_tree(self) -> None:
        tree_response = [
            {
                "id": "a1e8f8d7",
                "name": "html",
                "type": "tree",
                "path": "files/html",
                "mode": "040000",
            },
        ]
        responses.add(
            method=responses.GET,
            url=f"https://example.gitlab.com/api/v4/projects/{self.gitlab_id}/repository/tree",
            json=tree_response,
        )
        resp = self.gitlab_client.get_repository_tree(
            str(self.gitlab_id), ref="main", recursive=True
        )
        assert resp == tree_response
        assert "ref=main" in responses.calls[0].request.url
        assert "recursive=true" in responses.calls[0].request.url

    @responses.activate
    def test_get_rate_limit_info_from_response(self) -> None:
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
    def test_get_rate_limit_info_from_response_invalid(self) -> None:
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
    def setUp(self) -> None:
        super().setUp()
        self.cache_key = "integration.gitlab.client:90c877e3983404c2ccf5756f578abd5f"
        self.cache_key2 = "integration.gitlab.client:4d9a6af2411001e36cd3b66f50c1bf78"
        self.cache_key3 = "integration.gitlab.client:9cae8cea1a0f2b48037a956e61b7134c"
        self.file_1 = SourceLineInfo(
            path="src/sentry/integrations/github/client_1.py",
            lineno=10,
            ref="master",
            repo=self.repo,
            code_mapping=None,  # type: ignore[arg-type]
        )
        self.file_2 = SourceLineInfo(
            path="src/sentry/integrations/github/client_1.py",
            lineno=15,
            ref="master",
            repo=self.repo,
            code_mapping=None,  # type: ignore[arg-type]
        )
        self.file_3 = SourceLineInfo(
            path="src/sentry/integrations/github/client_2.py",
            lineno=20,
            ref="master",
            repo=self.repo,
            code_mapping=None,  # type: ignore[arg-type]
        )
        self.file_4 = SourceLineInfo(
            path="src/sentry/integrations/github/client_3.py",
            lineno=20,
            ref="master",
            repo=self.repo,
            code_mapping=None,  # type: ignore[arg-type]
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
    def test_success_single_file(self) -> None:
        self.set_up_success_responses()
        resp = self.gitlab_client.get_blame_for_files(files=[self.file_1], extra={})

        assert resp == [self.blame_1]

    @responses.activate
    def test_success_single_file_cached(self) -> None:
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
    def test_success_multiple_files(self) -> None:
        self.set_up_success_responses()
        resp = self.gitlab_client.get_blame_for_files(
            files=[self.file_1, self.file_2, self.file_3], extra={}
        )
        assert resp == [self.blame_1, self.blame_2, self.blame_3]

    @responses.activate
    def test_success_multiple_files_cached(self) -> None:
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
    def test_failure_404(self, mock_logger_warning: mock.MagicMock) -> None:
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
    def test_failure_response_type(self) -> None:
        responses.add(responses.GET, self.make_blame_request(self.file_1), json={}, status=200)

        with pytest.raises(ApiError):
            self.gitlab_client.get_blame_for_files(files=[self.file_1], extra={})

    @responses.activate
    @mock.patch(
        "sentry.integrations.gitlab.blame.logger.warning",
    )
    def test_failure_approaching_rate_limit(self, mock_logger_warning: mock.MagicMock) -> None:
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
        mock_logger_warning.assert_called_with(
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
    def test_failure_partial_expected(self, mock_logger_warning: mock.MagicMock) -> None:
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
    def test_failure_partial_fatal(self) -> None:
        """
        Tests that the function is aborted when a fatal response is returned
        """
        # First file returns a 500
        responses.add(responses.GET, self.make_blame_request(self.file_1), status=500)

        with pytest.raises(ApiError):
            self.gitlab_client.get_blame_for_files(files=[self.file_1, self.file_2], extra={})

    @responses.activate
    def test_invalid_commits(self) -> None:
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


@control_silo_test
class GitLabGetMergeCommitShaFromCommitTest(GitLabClientTest):
    @responses.activate
    def test_merge_commit_sha(self) -> None:
        merge_commit_sha = "123"
        commit_sha = "123"
        responses.add(
            responses.GET,
            url=f"https://example.gitlab.com/api/v4/projects/{self.gitlab_id}/repository/commits/{commit_sha}/merge_requests",
            json=[
                {
                    "state": "merged",
                    "merge_commit_sha": merge_commit_sha,
                    "squash_commit_sha": None,
                }
            ],
            status=200,
        )

        sha = self.gitlab_client.get_merge_commit_sha_from_commit(repo=self.repo, sha=commit_sha)
        assert sha == merge_commit_sha

    @responses.activate
    def test_squash_commit_sha(self) -> None:
        squash_commit_sha = "123"
        commit_sha = "123"
        responses.add(
            responses.GET,
            url=f"https://example.gitlab.com/api/v4/projects/{self.gitlab_id}/repository/commits/{commit_sha}/merge_requests",
            json=[
                {
                    "state": "merged",
                    "merge_commit_sha": None,
                    "squash_commit_sha": squash_commit_sha,
                }
            ],
            status=200,
        )

        sha = self.gitlab_client.get_merge_commit_sha_from_commit(repo=self.repo, sha=commit_sha)
        assert sha == squash_commit_sha

    @responses.activate
    def test_no_merge_requests(self) -> None:
        commit_sha = "123"
        responses.add(
            responses.GET,
            url=f"https://example.gitlab.com/api/v4/projects/{self.gitlab_id}/repository/commits/{commit_sha}/merge_requests",
            json=[],
            status=200,
        )

        sha = self.gitlab_client.get_merge_commit_sha_from_commit(repo=self.repo, sha=commit_sha)
        assert sha is None

    @responses.activate
    def test_open_merge_request(self) -> None:
        commit_sha = "123"
        responses.add(
            responses.GET,
            url=f"https://example.gitlab.com/api/v4/projects/{self.gitlab_id}/repository/commits/{commit_sha}/merge_requests",
            json=[{"state": "opened"}],
            status=200,
        )

        sha = self.gitlab_client.get_merge_commit_sha_from_commit(repo=self.repo, sha=commit_sha)
        assert sha is None

    @responses.activate
    def test_multiple_merged_requests(self) -> None:
        commit_sha = "123"
        responses.add(
            responses.GET,
            url=f"https://example.gitlab.com/api/v4/projects/{self.gitlab_id}/repository/commits/{commit_sha}/merge_requests",
            json=[
                {"state": "merged"},
                {"state": "merged"},
            ],
            status=200,
        )

        sha = self.gitlab_client.get_merge_commit_sha_from_commit(repo=self.repo, sha=commit_sha)
        assert sha is None


@control_silo_test
class GitLabProjectWebhookRequestTypeTest(GitLabClientTest):
    @responses.activate
    @mock.patch("sentry.shared_integrations.client.base.metrics.incr")
    def test_hook_calls_are_tagged_by_request_type(self, mock_incr: mock.MagicMock) -> None:
        hooks_url = f"https://example.gitlab.com/api/v4/projects/{self.gitlab_id}/hooks"
        responses.add(responses.POST, hooks_url, status=201, json={"id": 7})
        responses.add(responses.PUT, f"{hooks_url}/7", status=200, json={"id": 7})
        responses.add(responses.DELETE, f"{hooks_url}/7", status=204)

        with (
            mock.patch.object(self.gitlab_client, "post", wraps=self.gitlab_client.post) as post,
            mock.patch.object(self.gitlab_client, "put", wraps=self.gitlab_client.put) as put,
            mock.patch.object(
                self.gitlab_client, "delete", wraps=self.gitlab_client.delete
            ) as delete,
        ):
            self.gitlab_client.create_project_webhook(self.gitlab_id)
            self.gitlab_client.update_project_webhook(self.gitlab_id, 7)
            self.gitlab_client.delete_project_webhook(self.gitlab_id, 7)

        assert post.call_args.kwargs["timeout"] == GITLAB_WEBHOOK_REQUEST_TIMEOUT
        assert put.call_args.kwargs["timeout"] == GITLAB_WEBHOOK_REQUEST_TIMEOUT
        assert delete.call_args.kwargs["timeout"] == GITLAB_WEBHOOK_REQUEST_TIMEOUT

        for status, request_type in (
            (201, GitLabApiRequestType.CREATE_PROJECT_WEBHOOK),
            (200, GitLabApiRequestType.UPDATE_PROJECT_WEBHOOK),
            (204, GitLabApiRequestType.DELETE_PROJECT_WEBHOOK),
        ):
            mock_incr.assert_any_call(
                "integrations.http_response",
                sample_rate=1.0,
                tags={"integration": "gitlab", "status": status, "api_request_type": request_type},
            )
