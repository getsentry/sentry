from datetime import datetime, timedelta

from ..github import test_search


class GithubEnterpriseSearchTest(test_search.GithubSearchTest):
    # Inherit test methods/scenarios from GithubSearchTest
    # and fill out the slots that customize it to use github:enterprise
    provider = "github_enterprise"
    base_url = "https://github.example.org/api/v3"

    def create_integration(self):
        future = datetime.now() + timedelta(hours=1)
        return self.create_provider_integration(
            provider=self.provider,
            name="test",
            external_id=9999,
            metadata={
                "domain_name": "github.example.org",
                "account_type": "Organization",
                "access_token": "123456789",
                "expires_at": future.replace(microsecond=0).isoformat(),
                "installation": {
                    "private_key": "some private key",
                    "id": 123456,
                    "verify_ssl": True,
                },
            },
        )
