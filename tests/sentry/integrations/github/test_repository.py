from __future__ import absolute_import

import datetime
from sentry.utils.compat import mock
import responses
import pytest

from exam import fixture

from sentry.models import Integration, Repository, PullRequest
from sentry.testutils import PluginTestCase
from sentry.testutils.asserts import assert_commit_shape
from sentry.utils import json

from sentry.shared_integrations.exceptions import IntegrationError
from sentry.integrations.github.repository import GitHubRepositoryProvider
from .testutils import COMPARE_COMMITS_EXAMPLE, GET_LAST_COMMITS_EXAMPLE, GET_COMMIT_EXAMPLE


def stub_installation_token():
    ten_hours = datetime.datetime.utcnow() + datetime.timedelta(hours=10)
    responses.add(
        responses.POST,
        "https://api.github.com/app/installations/654321/access_tokens",
        json={"token": "v1.install-token", "expires_at": ten_hours.strftime("%Y-%m-%dT%H:%M:%SZ")},
    )


class GitHubAppsProviderTest(PluginTestCase):
    def setUp(self):
        super(GitHubAppsProviderTest, self).setUp()
        self.organization = self.create_organization()
        self.integration = Integration.objects.create(provider="github", external_id="654321")

    def tearDown(self):
        super(GitHubAppsProviderTest, self).tearDown()
        responses.reset()

    @fixture
    def provider(self):
        return GitHubRepositoryProvider("integrations:github")

    @fixture
    def repository(self):
        return Repository.objects.create(
            name="getsentry/example-repo",
            provider="integrations:github",
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            url="https://github.com/getsentry/example-repo",
            config={"name": "getsentry/example-repo"},
        )

    @responses.activate
    def test_build_repository_config(self):
        organization = self.create_organization()
        integration = Integration.objects.create(provider="github", name="Example GitHub")
        integration.add_organization(organization, self.user)
        data = {
            "identifier": "getsentry/example-repo",
            "external_id": "654321",
            "integration_id": integration.id,
        }
        data = self.provider.build_repository_config(organization, data)
        assert data == {
            "config": {"name": "getsentry/example-repo"},
            "external_id": "654321",
            "integration_id": integration.id,
            "name": "getsentry/example-repo",
            "url": "https://github.com/getsentry/example-repo",
        }

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_compare_commits_no_start(self, get_jwt):
        stub_installation_token()
        responses.add(
            responses.GET,
            "https://api.github.com/repos/getsentry/example-repo/commits?sha=abcdef",
            json=json.loads(GET_LAST_COMMITS_EXAMPLE),
        )
        responses.add(
            responses.GET,
            "https://api.github.com/repos/getsentry/example-repo/commits/6dcb09b5b57875f334f61aebed695e2e4193db5e",
            json=json.loads(GET_COMMIT_EXAMPLE),
        )
        result = self.provider.compare_commits(self.repository, None, "abcdef")
        for commit in result:
            assert_commit_shape(commit)

    @responses.activate
    def test_compare_commits_no_start_failure(self):
        stub_installation_token()
        responses.add(
            responses.GET,
            "https://api.github.com/repos/getsentry/example-repo/commits?sha=abcdef",
            status=502,
        )
        with pytest.raises(IntegrationError):
            self.provider.compare_commits(self.repository, None, "abcdef")

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_compare_commits(self, get_jwt):
        stub_installation_token()
        responses.add(
            responses.GET,
            "https://api.github.com/repos/getsentry/example-repo/compare/xyz123...abcdef",
            json=json.loads(COMPARE_COMMITS_EXAMPLE),
        )
        responses.add(
            responses.GET,
            "https://api.github.com/repos/getsentry/example-repo/commits/6dcb09b5b57875f334f61aebed695e2e4193db5e",
            json=json.loads(GET_COMMIT_EXAMPLE),
        )
        result = self.provider.compare_commits(self.repository, "xyz123", "abcdef")
        for commit in result:
            assert_commit_shape(commit)

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_compare_commits_patchset_handling(self, get_jwt):
        stub_installation_token()
        responses.add(
            responses.GET,
            "https://api.github.com/repos/getsentry/example-repo/compare/xyz123...abcdef",
            json=json.loads(COMPARE_COMMITS_EXAMPLE),
        )
        responses.add(
            responses.GET,
            "https://api.github.com/repos/getsentry/example-repo/commits/6dcb09b5b57875f334f61aebed695e2e4193db5e",
            json=json.loads(GET_COMMIT_EXAMPLE),
        )
        result = self.provider.compare_commits(self.repository, "xyz123", "abcdef")

        patchset = result[0]["patch_set"]
        assert patchset[0] == {"path": "file1.txt", "type": "M"}
        assert patchset[1] == {"path": "added.txt", "type": "A"}
        assert patchset[2] == {"path": "removed.txt", "type": "D"}
        assert patchset[3] == {"path": "old_name.txt", "type": "D"}
        assert patchset[4] == {"path": "renamed.txt", "type": "A"}

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_patchset_caching(self, get_jwt):
        stub_installation_token()
        responses.add(
            responses.GET,
            "https://api.github.com/repos/getsentry/example-repo/commits/abcdef",
            json=json.loads(GET_COMMIT_EXAMPLE),
        )
        client = self.integration.get_installation(self.repository.organization_id).get_client()

        self.provider._get_patchset(client, self.repository.config["name"], "abcdef")
        # One call for auth token, another for the patchset
        assert len(responses.calls) == 2

        self.provider._get_patchset(client, self.repository.config["name"], "abcdef")
        # Now that patchset was cached, github shouldn't have been called again
        assert len(responses.calls) == 2

    @responses.activate
    def test_compare_commits_failure(self):
        stub_installation_token()
        responses.add(
            responses.GET,
            "https://api.github.com/repos/getsentry/example-repo/compare/xyz123...abcdef",
            status=502,
        )
        with pytest.raises(IntegrationError):
            self.provider.compare_commits(self.repository, "xyz123", "abcdef")

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_compare_commits_force_refresh(self, get_jwt):
        stub_installation_token()
        ten_hours = datetime.datetime.utcnow() + datetime.timedelta(hours=10)
        self.integration.metadata = {
            "access_token": "old-access-token",
            "expires_at": ten_hours.replace(microsecond=0).isoformat(),
        }
        self.integration.save()
        responses.add(
            responses.GET,
            "https://api.github.com/repos/getsentry/example-repo/compare/xyz123...abcdef",
            status=404,
            body="GitHub returned a 404 Not Found error.",
        )
        responses.add(
            responses.GET,
            "https://api.github.com/repos/getsentry/example-repo/compare/xyz123...abcdef",
            json=json.loads(COMPARE_COMMITS_EXAMPLE),
        )
        responses.add(
            responses.GET,
            "https://api.github.com/repos/getsentry/example-repo/commits/6dcb09b5b57875f334f61aebed695e2e4193db5e",
            json=json.loads(GET_COMMIT_EXAMPLE),
        )

        result = self.provider.compare_commits(self.repository, "xyz123", "abcdef")
        for commit in result:
            assert_commit_shape(commit)

        # assert token was refreshed
        assert (
            Integration.objects.get(id=self.integration.id).metadata["access_token"]
            == "v1.install-token"
        )

        # compare_commits gives 400, token was refreshed, and compare_commits gives 200
        assert (
            responses.calls[0].response.url
            == u"https://api.github.com/repos/getsentry/example-repo/compare/xyz123...abcdef"
        )
        assert responses.calls[0].response.status_code == 404
        assert (
            responses.calls[1].response.url
            == u"https://api.github.com/app/installations/654321/access_tokens"
        )
        assert responses.calls[1].response.status_code == 200
        assert (
            responses.calls[2].response.url
            == u"https://api.github.com/repos/getsentry/example-repo/compare/xyz123...abcdef"
        )
        assert responses.calls[2].response.status_code == 200

    def test_pull_request_url(self):
        pull = PullRequest(key=99)
        result = self.provider.pull_request_url(self.repository, pull)
        assert result == "https://github.com/getsentry/example-repo/pull/99"

    def test_repository_external_slug(self):
        result = self.provider.repository_external_slug(self.repository)
        assert result == self.repository.config["name"]
