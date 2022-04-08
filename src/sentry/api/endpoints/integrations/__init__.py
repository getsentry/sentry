"""
These endpoints power the Integration Directory, which exists for users to
discover and install third-party add-ons that make Sentry more powerful.
"""

from .doc_integrations.details import DocIntegrationDetailsEndpoint
from .doc_integrations.index import DocIntegrationsEndpoint
from .index import OrganizationConfigIntegrationsEndpoint
from .install_request import OrganizationIntegrationRequestEndpoint
from .organization_integrations.details import OrganizationIntegrationDetailsEndpoint
from .organization_integrations.index import OrganizationIntegrationsEndpoint
from .plugins.configs_index import OrganizationPluginsConfigsEndpoint
from .plugins.index import OrganizationPluginsEndpoint

__all__ = (
    "OrganizationConfigIntegrationsEndpoint",
    "OrganizationIntegrationDetailsEndpoint",
    "OrganizationIntegrationRequestEndpoint",
    "OrganizationIntegrationsEndpoint",
    "OrganizationPluginsConfigsEndpoint",
    "OrganizationPluginsEndpoint",
    "DocIntegrationDetailsEndpoint",
    "DocIntegrationsEndpoint",
)
