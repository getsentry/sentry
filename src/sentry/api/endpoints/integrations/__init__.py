"""
These endpoints power the Integration Directory, which exists for users to
discover and install third-party add-ons that make Sentry more powerful.
"""

from .details import OrganizationIntegrationDetailsEndpoint
from .index import OrganizationIntegrationsEndpoint
from .install_request import OrganizationIntegrationRequestEndpoint
from .plugins.configs_index import OrganizationPluginsConfigsEndpoint
from .plugins.index import OrganizationPluginsEndpoint

__all__ = (
    "OrganizationIntegrationDetailsEndpoint",
    "OrganizationIntegrationRequestEndpoint",
    "OrganizationIntegrationsEndpoint",
    "OrganizationPluginsConfigsEndpoint",
    "OrganizationPluginsEndpoint",
)
