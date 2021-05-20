from sentry.auth.providers.saml2.generic.provider import GenericSAML2Provider
from sentry.auth.providers.saml2.provider import SCIMMixin


class ActiveDirectorySAML2Provider(SCIMMixin, GenericSAML2Provider):
    name = "Active Directory"
