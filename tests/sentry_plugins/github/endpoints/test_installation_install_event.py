from uuid import uuid4

from sentry.models import Integration
from sentry.testutils import APITestCase
from sentry_plugins.github.testutils import INSTALLATION_EVENT_EXAMPLE


class InstallationInstallEventWebhookTest(APITestCase):
    def test_simple(self):
        url = "/plugins/github/installations/webhook/"

        response = self.client.post(
            path=url,
            data=INSTALLATION_EVENT_EXAMPLE,
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="installation",
            HTTP_X_HUB_SIGNATURE="sha1=348e46312df2901e8cb945616ee84ce30d9987c9",
            HTTP_X_GITHUB_DELIVERY=str(uuid4()),
        )

        assert response.status_code == 204

        assert Integration.objects.filter(
            provider="github_apps", external_id=2, name="octocat"
        ).exists()
