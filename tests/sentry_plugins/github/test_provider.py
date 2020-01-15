from __future__ import absolute_import

import responses

from exam import fixture
from sentry.utils.compat.mock import patch
from social_auth.models import UserSocialAuth
from sentry.models import Integration, OrganizationIntegration, Repository
from sentry.testutils import PluginTestCase
from sentry.utils import json

from sentry_plugins.github.client import GitHubClient, GitHubAppsClient
from sentry_plugins.github.plugin import GitHubAppsRepositoryProvider, GitHubRepositoryProvider
from sentry_plugins.github.testutils import (
    COMPARE_COMMITS_EXAMPLE,
    GET_LAST_COMMITS_EXAMPLE,
    INTSTALLATION_REPOSITORIES_API_RESPONSE,
    LIST_INSTALLATION_API_RESPONSE,
)


class GitHubPluginTest(PluginTestCase):
    @fixture
    def provider(self):
        return GitHubRepositoryProvider("github")

    def test_compare_commits(self):
        repo = Repository.objects.create(provider="github", name="example", organization_id=1)

        res = self.provider._format_commits(repo, json.loads(COMPARE_COMMITS_EXAMPLE)["commits"])

        assert res == [
            {
                "author_email": "support@github.com",
                "author_name": "Monalisa Octocat",
                "message": "Fix all the bugs",
                "id": "6dcb09b5b57875f334f61aebed695e2e4193db5e",
                "repository": "example",
            }
        ]

    def test_get_last_commits(self):
        repo = Repository.objects.create(provider="github", name="example", organization_id=1)

        res = self.provider._format_commits(repo, json.loads(GET_LAST_COMMITS_EXAMPLE)[:10])

        assert res == [
            {
                "author_email": "support@github.com",
                "author_name": "Monalisa Octocat",
                "message": "Fix all the bugs",
                "id": "6dcb09b5b57875f334f61aebed695e2e4193db5e",
                "repository": "example",
            }
        ]

    @responses.activate
    def test_create_repository(self):
        responses.add(
            responses.POST,
            "https://api.github.com/repos/getsentry/example-repo/hooks",
            json={"id": "123456", "events": ["push", "pull_request"]},
        )
        user = self.create_user()
        organization = self.create_organization()
        UserSocialAuth.objects.create(
            user=user, provider="github", extra_data={"access_token": "abcdefg"}
        )
        data = {"name": "getsentry/example-repo", "external_id": "654321"}
        data = self.provider.create_repository(organization, data, user)
        assert data == {
            "config": {
                "name": "getsentry/example-repo",
                "webhook_id": "123456",
                "webhook_events": ["push", "pull_request"],
            },
            "external_id": "654321",
            "name": "getsentry/example-repo",
            "url": "https://github.com/getsentry/example-repo",
        }

        request = responses.calls[-1].request
        req_json = json.loads(request.body)
        assert req_json == {
            "active": True,
            "config": {
                "url": "http://testserver/plugins/github/organizations/{}/webhook/".format(
                    organization.id
                ),
                "secret": self.provider.get_webhook_secret(organization),
                "content_type": "json",
            },
            "name": "web",
            "events": ["push", "pull_request"],
        }

    @responses.activate
    def test_delete_repository(self):
        responses.add(
            responses.DELETE,
            "https://api.github.com/repos/getsentry/example-repo/hooks/123456",
            json={},
        )
        user = self.create_user()
        organization = self.create_organization()
        UserSocialAuth.objects.create(
            user=user, provider="github", extra_data={"access_token": "abcdefg"}
        )
        repo = Repository.objects.create(
            provider="github",
            name="example-repo",
            organization_id=organization.id,
            config={
                "name": "getsentry/example-repo",
                "external_id": "654321",
                "webhook_id": "123456",
            },
        )

        self.provider.delete_repository(repo, user)

    @responses.activate
    def test_update_repository_without_webhook(self):
        responses.add(
            responses.POST,
            "https://api.github.com/repos/getsentry/example-repo/hooks",
            json={"id": "123456", "events": ["push", "pull_request"]},
        )
        user = self.create_user()
        organization = self.create_organization()
        UserSocialAuth.objects.create(
            user=user, provider="github", extra_data={"access_token": "abcdefg"}
        )
        repo = Repository.objects.create(
            provider="github",
            name="example-repo",
            organization_id=organization.id,
            config={"name": "getsentry/example-repo", "external_id": "654321"},
        )

        self.provider.update_repository(repo, user)

        assert repo.config["webhook_id"] == "123456"
        assert repo.config["webhook_events"] == ["push", "pull_request"]

    @responses.activate
    def test_update_repository_with_webhook(self):
        responses.add(
            responses.PATCH,
            "https://api.github.com/repos/getsentry/example-repo/hooks/123456",
            json={"id": "123456", "events": ["push", "pull_request"]},
        )
        user = self.create_user()
        organization = self.create_organization()
        UserSocialAuth.objects.create(
            user=user, provider="github", extra_data={"access_token": "abcdefg"}
        )
        repo = Repository.objects.create(
            provider="github",
            name="example-repo",
            organization_id=organization.id,
            config={
                "name": "getsentry/example-repo",
                "external_id": "654321",
                "webhook_id": "123456",
            },
        )

        self.provider.update_repository(repo, user)

        assert repo.config["webhook_id"] == "123456"
        assert repo.config["webhook_events"] == ["push", "pull_request"]


class GitHubAppsProviderTest(PluginTestCase):
    @fixture
    def provider(self):
        return GitHubAppsRepositoryProvider("github_apps")

    @patch.object(
        GitHubAppsClient,
        "get_repositories",
        return_value=json.loads(INTSTALLATION_REPOSITORIES_API_RESPONSE),
    )
    @patch.object(
        GitHubClient, "get_installations", return_value=json.loads(LIST_INSTALLATION_API_RESPONSE)
    )
    def test_link_auth(self, *args):
        user = self.create_user()
        organization = self.create_organization()
        UserSocialAuth.objects.create(
            user=user, provider="github_apps", extra_data={"access_token": "abcdefg"}
        )

        integration = Integration.objects.create(provider="github_apps", external_id="1")

        self.provider.link_auth(user, organization, {"integration_id": integration.id})

        assert OrganizationIntegration.objects.filter(
            organization=organization, integration=integration
        ).exists()

    def test_delete_repository(self):
        user = self.create_user()
        organization = self.create_organization()
        integration = Integration.objects.create(provider="github_apps", external_id="1")
        repo = Repository.objects.create(
            name="example-repo",
            provider="github_apps",
            organization_id=organization.id,
            integration_id=integration.id,
        )

        # just check that it doesn't throw / try to delete a webhook
        assert self.provider.delete_repository(repo=repo, actor=user) is None

    @patch.object(GitHubAppsClient, "get_last_commits", return_value=[])
    def test_compare_commits_no_start(self, mock_get_last_commits):
        organization = self.create_organization()
        integration = Integration.objects.create(provider="github_apps", external_id="1")
        repo = Repository.objects.create(
            name="example-repo",
            provider="github_apps",
            organization_id=organization.id,
            integration_id=integration.id,
            config={"name": "example-repo"},
        )

        self.provider.compare_commits(repo, None, "a" * 40)

        assert mock_get_last_commits.called

    @patch.object(GitHubAppsClient, "compare_commits", return_value={"commits": []})
    def test_compare_commits(self, mock_compare_commits):
        organization = self.create_organization()
        integration = Integration.objects.create(provider="github_apps", external_id="1")
        repo = Repository.objects.create(
            name="example-repo",
            provider="github_apps",
            organization_id=organization.id,
            integration_id=integration.id,
            config={"name": "example-repo"},
        )

        self.provider.compare_commits(repo, "b" * 40, "a" * 40)

        assert mock_compare_commits.called
