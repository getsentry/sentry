import datetime
from datetime import timezone
from functools import cached_property
from unittest import mock

import pytest
import responses

from fixtures.bitbucket import COMMIT_DIFF_PATCH, COMPARE_COMMITS_EXAMPLE, REPO
from sentry.integrations.bitbucket.repository import BitbucketRepositoryProvider
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.silo.base import SiloMode
from sentry.testutils.cases import IntegrationRepositoryTestCase, TestCase
from sentry.testutils.silo import assume_test_silo_mode


class BitbucketRepositoryProviderTest(TestCase):
    def setUp(self):
        super().setUp()
        self.base_url = "https://api.bitbucket.org"
        self.shared_secret = "234567890"
        self.subject = "connect:1234567"
        self.integration, _ = self.create_provider_integration_for(
            self.organization,
            self.user,
            provider="bitbucket",
            external_id=self.subject,
            name="MyBitBucket",
            metadata={
                "base_url": self.base_url,
                "shared_secret": self.shared_secret,
                "subject": self.subject,
            },
        )
        self.repo = Repository.objects.create(
            provider="bitbucket",
            name="sentryuser/newsdiffs",
            organization_id=self.organization.id,
            config={"name": "sentryuser/newsdiffs"},
            integration_id=self.integration.id,
        )

    @cached_property
    def provider(self):
        return BitbucketRepositoryProvider("bitbucket")

    def test_get_client(self):
        installation = self.integration.get_installation(self.repo.organization_id)
        client = installation.get_client()
        assert client.base_url == self.base_url
        assert client.shared_secret == self.shared_secret
        assert client.subject == self.subject

    @responses.activate
    def test_compare_commits(self):
        responses.add(
            responses.GET,
            "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs/commits/e18e4e72de0d824edfbe0d73efe34cbd0d01d301",
            body=COMPARE_COMMITS_EXAMPLE,
        )
        responses.add(
            responses.GET,
            "https://api.bitbucket.org/2.0/repositories/sentryuser/newsdiffs/diff/e18e4e72de0d824edfbe0d73efe34cbd0d01d301",
            body=COMMIT_DIFF_PATCH,
        )

        res = self.provider.compare_commits(
            self.repo, None, "e18e4e72de0d824edfbe0d73efe34cbd0d01d301"
        )

        assert res == [
            {
                "author_email": "sentryuser@getsentry.com",
                "author_name": "Sentry User",
                "message": "README.md edited online with Bitbucket",
                "id": "e18e4e72de0d824edfbe0d73efe34cbd0d01d301",
                "repository": "sentryuser/newsdiffs",
                "patch_set": [{"path": "README.md", "type": "M"}],
                "timestamp": datetime.datetime(2017, 5, 16, 23, 21, 40, tzinfo=timezone.utc),
            }
        ]

    @responses.activate
    @mock.patch("sentry.integrations.bitbucket.repository.generate_token", return_value="0" * 64)
    def test_build_repository_config(self, mock_generate_token):
        full_repo_name = "laurynsentry/helloworld"
        webhook_id = "web-hook-id"
        responses.add(
            responses.GET,
            "https://api.bitbucket.org/2.0/repositories/%s" % full_repo_name,
            json=REPO,
        )
        responses.add(
            responses.POST,
            "https://api.bitbucket.org/2.0/repositories/%s/hooks" % full_repo_name,
            json={"uuid": webhook_id, "secret_set": True},
            status=201,
        )

        organization = self.create_organization()
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_provider_integration(
                provider="bitbucket",
                external_id="bitbucket_external_id",
                name="Hello world",
                metadata={"base_url": "https://api.bitbucket.org", "shared_secret": "23456789"},
            )
            integration.add_organization(organization)
        data = {
            "provider": "integrations:bitbucket",
            "identifier": full_repo_name,
            "installation": integration.id,
        }
        data = self.provider.get_repository_data(organization, data)
        assert data == {
            "provider": "integrations:bitbucket",
            "identifier": full_repo_name,
            "installation": integration.id,
            "external_id": REPO["uuid"],
            "name": full_repo_name,
        }
        data = self.provider.build_repository_config(organization, data)
        assert mock_generate_token.called

        assert data == {
            "name": full_repo_name,
            "external_id": REPO["uuid"],
            "url": "https://bitbucket.org/laurynsentry/helloworld",
            "integration_id": integration.id,
            "config": {
                "name": full_repo_name,
                "webhook_id": webhook_id,
                "webhook_secret": "0" * 64,
            },
        }

    def test_repository_external_slug(self):
        result = self.provider.repository_external_slug(self.repo)
        assert result == self.repo.name

    def test_get_repository_data_no_installation_id(self):
        with pytest.raises(IntegrationError) as e:
            self.provider.get_repository_data(self.organization, {})
        assert "requires an integration id" in str(e.value)


class BitbucketCreateRepositoryTestCase(IntegrationRepositoryTestCase):
    provider_name = "integrations:bitbucket"

    def setUp(self):
        super().setUp()
        self.base_url = "https://api.bitbucket.org"
        self.shared_secret = "234567890"
        self.subject = "connect:1234567"
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration = self.create_provider_integration(
                provider="bitbucket",
                external_id=self.subject,
                name="MyBitBucket",
                metadata={
                    "base_url": self.base_url,
                    "shared_secret": self.shared_secret,
                    "subject": self.subject,
                },
            )
            self.integration.get_provider().setup()
            self.integration.add_organization(self.organization, self.user)
        self.repo = Repository.objects.create(
            provider="bitbucket",
            name="sentryuser/newsdiffs",
            organization_id=self.organization.id,
            config={"name": "sentryuser/newsdiffs"},
            integration_id=self.integration.id,
        )
        self.default_repository_config = {"full_name": "getsentry/example-repo", "id": "123"}

    def add_create_repository_responses(self, repository_config):
        responses.add(
            responses.GET,
            f"{self.base_url}/2.0/repositories/{self.repo.name}",
            json=repository_config,
        )
        responses.add(
            responses.POST,
            f"{self.base_url}/2.0/repositories/{self.repo.name}/hooks",
            json={"uuid": "99"},
        )

    def test_create_repository_data_no_installation_id(self):
        response = self.create_repository(self.default_repository_config, None)
        assert response.status_code == 400
        self.assert_error_message(response, "validation", "requires an integration id")

    def test_create_repository_data_integration_does_not_exist(self):
        integration_id = self.integration.id
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration.delete()

        response = self.create_repository(self.default_repository_config, integration_id)
        assert response.status_code == 404
        self.assert_error_message(
            response, "not found", "Integration matching query does not exist."
        )
