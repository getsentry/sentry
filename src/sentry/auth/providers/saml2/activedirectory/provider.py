from sentry.auth.providers.saml2.generic.provider import GenericSAML2Provider


class ActiveDirectorySAML2Provider(GenericSAML2Provider):
    name = "Active Directory"
