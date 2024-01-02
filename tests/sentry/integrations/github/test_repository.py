import datetime
from functools import cached_property
from unittest import mock

import pytest
import responses

from fixtures.github import COMPARE_COMMITS_EXAMPLE, GET_COMMIT_EXAMPLE, GET_LAST_COMMITS_EXAMPLE
from sentry.integrations.github.repository import GitHubRepositoryProvider
from sentry.models.integrations.integration import Integration
from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.silo import SiloMode
from sentry.testutils.asserts import assert_commit_shape
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.utils import json


@control_silo_test
class GitHubAppsProviderTest(TestCase):
    def setUp(self):
        super().setUp()
        ten_hours = datetime.datetime.utcnow() + datetime.timedelta(hours=10)
        self.integration = self.create_integration(
            organization=self.organization,
            provider="github",
            external_id="654321",
            metadata={
                "access_token": "v1.install-token",
                "expires_at": ten_hours.strftime("%Y-%m-%dT%H:%M:%S"),
            },
        )

    def tearDown(self):
        super().tearDown()
        responses.reset()

    @cached_property
    def provider(self):
        return GitHubRepositoryProvider("integrations:github")

    @cached_property
    def repository(self):
        # TODO: Refactor this out with a call to the relevant factory if possible to avoid
        # explicitly having to exempt it from silo limits
        with assume_test_silo_mode(SiloMode.REGION):
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
        responses.add(
            responses.GET,
            "https://api.github.com/repos/getsentry/example-repo/commits/abcdef",
            json=json.loads(GET_COMMIT_EXAMPLE),
        )
        client = self.integration.get_installation(self.repository.organization_id).get_client()

        self.provider._get_patchset(client, self.repository.config["name"], "abcdef")
        # Just for the patchset
        assert len(responses.calls) == 1

        self.provider._get_patchset(client, self.repository.config["name"], "abcdef")
        # Now that patchset was cached, github shouldn't have been called again
        assert len(responses.calls) == 1

    @responses.activate
    def test_compare_commits_failure(self):
        responses.add(
            responses.GET,
            "https://api.github.com/repos/getsentry/example-repo/compare/xyz123...abcdef",
            status=502,
        )
        with pytest.raises(IntegrationError):
            self.provider.compare_commits(self.repository, "xyz123", "abcdef")

    def test_pull_request_url(self):
        pull = PullRequest(key=99)
        result = self.provider.pull_request_url(self.repository, pull)
        assert result == "https://github.com/getsentry/example-repo/pull/99"

    def test_repository_external_slug(self):
        result = self.provider.repository_external_slug(self.repository)
        assert result == self.repository.config["name"]
