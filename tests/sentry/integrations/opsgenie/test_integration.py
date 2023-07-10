# import responses

from sentry.integrations.opsgenie.integration import OpsgenieIntegrationProvider

# from sentry.models.integrations.integration import Integration
from sentry.testutils import IntegrationTestCase


class OpsgenieIntegrationTest(IntegrationTestCase):
    provider = OpsgenieIntegrationProvider
    config = {"base_url": "https://api.opsgenie.com/", "api_key": "123"}

    def setUp(self):
        super().setUp()
