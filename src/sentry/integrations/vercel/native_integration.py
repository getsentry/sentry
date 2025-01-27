import logging

from sentry.integrations.base import IntegrationInstallation, IntegrationProvider
from sentry.integrations.vercel import VercelNativeClient
from sentry.shared_integrations.exceptions import IntegrationError

logger = logging.getLogger("sentry.integrations.native_vercel")


class VercelNativeIntegration(IntegrationInstallation):
    @property
    def metadata(self):
        return self.model.metadata

    def get_client(self):
        if not self.org_integration:
            raise IntegrationError("Organization Integration does not exist")

        return VercelNativeClient(
            org_integration_id=self.org_integration.id,
            integration_configuration_id=self.model.external_id,
        )

    def send_invoice(self, data):
        client = self.get_client()
        return client.submit_invoice(data)

    def send_billing_data(self, data):
        client = self.get_client()
        return client.submit_billing_data(data)


# TODO: Finish implementing
class VercelNativeIntegrationProvider(IntegrationProvider):
    key = "vercel-native-integration"
    name = "Vercel Native Integration"
    can_add = False
    can_disable = False
    integration_cls = VercelNativeIntegration
