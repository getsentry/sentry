from sentry.identity.vsts.provider import VSTSIdentityProvider


class VstsExtensionIdentityProvider(VSTSIdentityProvider):
    """
    Functions exactly the same as ``VSTSIdentityProvider``.

    This class is necessary because of how Integration Pipelines look up
    sibling/dependent classes using ``key``.

    The IntegrationProvider for the VSTS Extension is slightly different from
    the VSTS version, so it requires a new class. Hence, the Identity portion
    also requires a new class; this one.
    """

    key = "vsts-extension"
