from __future__ import absolute_import

import datetime
import responses
import pytest
import six

from django.utils import timezone
from exam import fixture
from sentry.models import Integration, Repository, IdentityProvider, Identity, IdentityStatus
from sentry.testutils import APITestCase
from sentry.integrations.bitbucket_server.repository import BitbucketServerRepositoryProvider
from sentry.shared_integrations.exceptions import IntegrationError
from .testutils import (
    EXAMPLE_PRIVATE_KEY,
    COMPARE_COMMITS_EXAMPLE,
    REPO,
    COMMIT_CHANGELIST_EXAMPLE,
    COMPARE_COMMITS_WITH_PAGES_1_2_EXAMPLE,
    COMPARE_COMMITS_WITH_PAGES_2_2_EXAMPLE,
    COMMIT_CHANGELIST_WITH_PAGES_FIRST_COMMIT_EXAMPLE,
    COMMIT_CHANGELIST_WITH_PAGES_SECOND_COMMIT_EXAMPLE_1_2,
    COMMIT_CHANGELIST_WITH_PAGES_SECOND_COMMIT_EXAMPLE_2_2,
)


class BitbucketServerRepositoryProviderTest(APITestCase):
    @fixture
    def integration(self):
        integration = Integration.objects.create(
            provider="bitbucket_server",
            name="Example Bitbucket",
            metadata={"verify_ssl": False, "base_url": "https://bitbucket.example.com"},
        )
        identity_provider = IdentityProvider.objects.create(
            external_id="bitbucket.example.com:sentry-test", type="bitbucket_server"
        )
        identity = Identity.objects.create(
            idp=identity_provider,
            user=self.user,
            scopes=(),
            status=IdentityStatus.VALID,
            data={
                "consumer_key": "sentry-test",
                "private_key": EXAMPLE_PRIVATE_KEY,
                "access_token": "access-token",
                "access_token_secret": "access-token-secret",
            },
        )
        integration.add_organization(self.organization, self.user, default_auth_id=identity.id)
        return integration

    @fixture
    def provider(self):
        return BitbucketServerRepositoryProvider("bitbucket_server")

    def test_get_client(self):
        installation = self.integration.get_installation(self.organization.id)
        client = installation.get_client()
        assert client.base_url == self.integration.metadata["base_url"]
        assert client.verify_ssl == self.integration.metadata["verify_ssl"]

    @responses.activate
    def test_compare_commits(self):
        repo = Repository.objects.create(
            provider="bitbucket_server",
            name="sentryuser/newsdiffs",
            organization_id=self.organization.id,
            config={"name": "sentryuser/newsdiffs", "project": "sentryuser", "repo": "newsdiffs"},
            integration_id=self.integration.id,
        )

        responses.add(
            responses.GET,
            "https://bitbucket.example.com/rest/api/1.0/projects/sentryuser/repos/newsdiffs/commits",
            json=COMPARE_COMMITS_EXAMPLE,
        )

        responses.add(
            responses.GET,
            "https://bitbucket.example.com/rest/api/1.0/projects/sentryuser/repos/newsdiffs/commits/e18e4e72de0d824edfbe0d73efe34cbd0d01d301/changes",
            json=COMMIT_CHANGELIST_EXAMPLE,
        )

        res = self.provider.compare_commits(repo, None, "e18e4e72de0d824edfbe0d73efe34cbd0d01d301")

        assert res == [
            {
                "author_email": "sentryuser@getsentry.com",
                "author_name": "Sentry User",
                "message": "README.md edited online with Bitbucket",
                "id": "e18e4e72de0d824edfbe0d73efe34cbd0d01d301",
                "repository": "sentryuser/newsdiffs",
                "patch_set": [
                    {"path": "a.txt", "type": "M"},
                    {"path": "b.txt", "type": "A"},
                    {"path": "c.txt", "type": "D"},
                    {"path": "e.txt", "type": "D"},
                    {"path": "d.txt", "type": "A"},
                ],
                "timestamp": datetime.datetime(2019, 12, 19, 13, 56, 56, tzinfo=timezone.utc),
            }
        ]

    @responses.activate
    def test_compare_commits_with_two_pages(self):
        repo = Repository.objects.create(
            provider="bitbucket_server",
            name="sentryuser/newsdiffs",
            organization_id=self.organization.id,
            config={"name": "sentryuser/newsdiffs", "project": "sentryuser", "repo": "newsdiffs"},
            integration_id=self.integration.id,
        )

        responses.add(
            responses.GET,
            "https://bitbucket.example.com/rest/api/1.0/projects/sentryuser/repos/newsdiffs/commits?merges=exclude&limit=1000&since=d0352305beb41afb3a4ea79e3a97bf6a97520339&start=0&until=042bc8434e0c178d8745c7d9f90bddab9c927887",
            json=COMPARE_COMMITS_WITH_PAGES_1_2_EXAMPLE,
        )

        responses.add(
            responses.GET,
            "https://bitbucket.example.com/rest/api/1.0/projects/sentryuser/repos/newsdiffs/commits?merges=exclude&limit=1000&since=d0352305beb41afb3a4ea79e3a97bf6a97520339&start=1&until=042bc8434e0c178d8745c7d9f90bddab9c927887",
            json=COMPARE_COMMITS_WITH_PAGES_2_2_EXAMPLE,
        )

        responses.add(
            responses.GET,
            "https://bitbucket.example.com/rest/api/1.0/projects/sentryuser/repos/newsdiffs/commits/d0352305beb41afb3a4ea79e3a97bf6a97520339/changes",
            json=COMMIT_CHANGELIST_WITH_PAGES_FIRST_COMMIT_EXAMPLE,
        )

        responses.add(
            responses.GET,
            "https://bitbucket.example.com/rest/api/1.0/projects/sentryuser/repos/newsdiffs/commits/042bc8434e0c178d8745c7d9f90bddab9c927887/changes?merges=exclude&limit=100&start=0",
            json=COMMIT_CHANGELIST_WITH_PAGES_SECOND_COMMIT_EXAMPLE_1_2,
        )

        responses.add(
            responses.GET,
            "https://bitbucket.example.com/rest/api/1.0/projects/sentryuser/repos/newsdiffs/commits/042bc8434e0c178d8745c7d9f90bddab9c927887/changes?merges=exclude&limit=100&start=1",
            json=COMMIT_CHANGELIST_WITH_PAGES_SECOND_COMMIT_EXAMPLE_2_2,
        )

        res = self.provider.compare_commits(
            repo,
            "d0352305beb41afb3a4ea79e3a97bf6a97520339",
            "042bc8434e0c178d8745c7d9f90bddab9c927887",
        )

        assert res == [
            {
                "author_email": "sentryuser@getsentry.com",
                "author_name": "Sentry User",
                "message": "Fist commit",
                "id": "d0352305beb41afb3a4ea79e3a97bf6a97520339",
                "repository": "sentryuser/newsdiffs",
                "patch_set": [{"path": "a.txt", "type": "M"}, {"path": "b.txt", "type": "A"}],
                "timestamp": datetime.datetime(2019, 12, 19, 13, 56, 56, tzinfo=timezone.utc),
            },
            {
                "author_email": "sentryuser@getsentry.com",
                "author_name": "Sentry User",
                "message": "Second commit",
                "id": "042bc8434e0c178d8745c7d9f90bddab9c927887",
                "repository": "sentryuser/newsdiffs",
                "patch_set": [
                    {"path": "c.txt", "type": "D"},
                    {"path": "e.txt", "type": "D"},
                    {"path": "d.txt", "type": "A"},
                ],
                "timestamp": datetime.datetime(2019, 12, 19, 13, 56, 56, tzinfo=timezone.utc),
            },
        ]

    @responses.activate
    def test_build_repository_config(self):
        project = u"laurynsentry"
        repo = u"helloworld"
        full_repo_name = u"%s/%s" % (project, repo)

        webhook_id = 79
        responses.add(
            responses.GET,
            "https://bitbucket.example.com/rest/api/1.0/projects/%s/repos/%s" % (project, repo),
            json=REPO,
        )
        responses.add(
            responses.POST,
            "https://bitbucket.example.com/rest/api/1.0/projects/%s/repos/%s/webhooks"
            % (project, repo),
            json={"id": webhook_id},
            status=201,
        )

        organization = self.organization
        integration = self.integration

        data = {
            "provider": "integrations:bitbucket_server",
            "identifier": project + "/" + repo,
            "installation": integration.id,
        }
        data = self.provider.get_repository_data(organization, data)
        assert data == {
            "provider": "integrations:bitbucket_server",
            "repo": repo,
            "project": project,
            "identifier": project + "/" + repo,
            "name": full_repo_name,
            "installation": integration.id,
            "external_id": six.text_type(REPO["id"]),
        }

        data["identifier"] = full_repo_name
        data = self.provider.build_repository_config(organization, data)

        assert data == {
            "name": full_repo_name,
            "external_id": six.text_type(REPO["id"]),
            "url": "https://bitbucket.example.com/projects/laurynsentry/repos/helloworld/browse",
            "integration_id": integration.id,
            "config": {
                "name": full_repo_name,
                "project": project,
                "repo": repo,
                "webhook_id": webhook_id,
            },
        }

    def test_repository_external_slug(self):
        repo = Repository.objects.create(
            provider="bitbucket_server",
            name="sentryuser/newsdiffs",
            organization_id=self.organization.id,
            config={"name": "sentryuser/newsdiffs"},
            integration_id=self.integration.id,
        )

        result = self.provider.repository_external_slug(repo)
        assert result == repo.name

    def test_get_repository_data_no_installation_id(self):
        with pytest.raises(IntegrationError) as e:
            self.provider.get_repository_data(self.organization, {})
            assert "requires an integration id" in six.text_type(e)
