from __future__ import absolute_import

from sentry.identity.azure_devops.provider import AzureDevOpsIdentityProvider


class AzureDevOpsExtensionIdentityProvider(AzureDevOpsIdentityProvider):
    """
    Functions exactly the same as ``AzureDevOpsIdentityProvider``.

    This class is necessary because of how Integration Pipelines look up
    sibling/dependent classes using ``key``.

    The IntegrationProvider for the AzureDevOps Extension is slightly different from
    the AzureDevOps version, so it requires a new class. Hence, the Identity portion
    also requires a new class; this one.
    """

    key = 'azure-devops-extension'
