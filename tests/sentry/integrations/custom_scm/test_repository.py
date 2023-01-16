from functools import cached_property
from uuid import uuid4

from sentry.integrations.custom_scm.repository import CustomSCMRepositoryProvider
from sentry.models import Integration, Repository
from sentry.testutils import IntegrationRepositoryTestCase


class CustomSCMRepositoryProviderTest(IntegrationRepositoryTestCase):
    provider_name = "integrations:custom_scm"

    def setUp(self):
        super().setUp()
        self.external_id = uuid4().hex
        self.integration = Integration.objects.create(
            provider="custom_scm",
            name="Example Custom SCM",
            external_id=self.external_id,
            metadata={
                "domain_name": "http://example.com/some-org/",
            },
        )
        self.integration.add_organization(self.organization, self.user)
        self.integration.get_provider().setup()

        self.repo = Repository.objects.create(
            name="some-repo", organization_id=self.organization.id
        )
        self.repository_data = {
            "provider": None,
            "installation": self.integration.id,
            "id": self.repo.id,
        }

    @cached_property
    def provider(self):
        return CustomSCMRepositoryProvider("custom_scm")

    def _get_repo_data(self, repo):
        return {
            "provider": None,
            "installation": self.integration.id,
            "id": repo.id,
        }

    def test_create_repository(self):
        response = self.create_repository(
            self._get_repo_data(self.repo), self.integration.id, add_responses=False
        )
        assert response.status_code == 201

        repo = Repository.objects.get(id=self.repo.id)
        assert repo.integration_id == self.integration.id
        assert repo.provider == "integrations:custom_scm"

    def test_non_null_provider(self):
        # no integration_id, but has provider
        repo = Repository.objects.create(
            name="new-repo", organization_id=self.organization.id, provider="github"
        )
        response = self.create_repository(
            self._get_repo_data(repo), self.integration.id, add_responses=False
        )
        assert response.status_code == 404

    def test_non_null_integration_id(self):
        # has both integration_id and provider
        repo = Repository.objects.create(
            name="new-repo",
            organization_id=self.organization.id,
            provider="integrations:custom_scm",
            integration_id=self.integration.id,
        )
        response = self.create_repository(
            self._get_repo_data(repo), self.integration.id, add_responses=False
        )
        assert response.status_code == 404
