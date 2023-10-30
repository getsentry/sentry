from sentry.shared_integrations.client import BaseApiClient


class ApiClient(BaseApiClient):
    integration_type = "integration"
    metrics_prefix = "integrations"
    log_path = "sentry.integrations.client"

    # Used in metrics and logging.
    integration_name = "undefined"
