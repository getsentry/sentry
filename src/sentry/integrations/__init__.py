"""
The Integrations Module contains the infrastructure to send API calls to and
receive webhook requests from third-party services. It contains the business
logic to implement several of Sentry's features including Ticket Rules,
Notifications, and Stacktrace Linking. No models are defined in this module.

See also:
    src/sentry/models/integrations/
    src/sentry/notifications/
    src/sentry/shared_integrations/
    src/sentry_plugins/
"""

__all__ = (
    "FeatureDescription",
    "IntegrationFeatures",
    "IntegrationInstallation",
    "IntegrationMetadata",
    "IntegrationProvider",
)

from .analytics import register_analytics
from .base import (
    FeatureDescription,
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationMetadata,
    IntegrationProvider,
)
from .manager import IntegrationManager

register_analytics()
default_manager = IntegrationManager()
all = default_manager.all
get = default_manager.get
exists = default_manager.exists
register = default_manager.register
unregister = default_manager.unregister
