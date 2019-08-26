from __future__ import absolute_import

from datetime import datetime, timedelta
from sentry.models import Integration
from ..github.test_search import GithubSearchTest


class GithubEnterpriseSearchTest(GithubSearchTest):
    # Inherit test methods/scenarios from GithubSearchTest
    # and fill out the slots that customize it to use github:enterprise
    provider = "github_enterprise"
    base_url = "https://github.example.org/api/v3"

    def create_integration(self):
        future = datetime.now() + timedelta(hours=1)
        return Integration.objects.create(
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
