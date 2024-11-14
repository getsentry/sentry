from functools import cached_property

import responses

from sentry.integrations.github_enterprise.repository import GitHubEnterpriseRepositoryProvider
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode


class GitHubEnterpriseRepositoryTest(TestCase):
    _IP_ADDRESS = "35.232.149.196"

    def setUp(self):
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="github_enterprise",
            external_id="github_external_id",
            metadata={
                "domain_name": f"{self._IP_ADDRESS}/getsentry",
                "installation_id": "installation_id",
                "installation": {"id": 2, "private_key": "private_key", "verify_ssl": True},
            },
        )

    @cached_property
    def provider(self):
        return GitHubEnterpriseRepositoryProvider("integrations:github_enterprise")

    @responses.activate
    def test_build_repository_config(self):
        organization = self.create_organization()
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration.add_organization(organization, self.user)
        data = {
            "identifier": "getsentry/example-repo",
            "external_id": "654321",
            "integration_id": self.integration.id,
        }
        data = self.provider.build_repository_config(organization, data)
        assert data == {
            "config": {"name": "getsentry/example-repo"},
            "external_id": "654321",
            "integration_id": self.integration.id,
            "name": "getsentry/example-repo",
            "url": f"https://{self._IP_ADDRESS}/getsentry/example-repo",
        }
