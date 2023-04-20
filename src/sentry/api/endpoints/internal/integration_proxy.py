from sentry.api.base import Endpoint, control_silo_endpoint


@control_silo_endpoint
class InternalIntegrationProxyEndpoint(Endpoint):
    """
    This endpoint should not be called directly. This class instead reserves the path to ensure that
    IntegrationProxyMiddleware doesn't conflict with any existing, functional url patterns.
    """
