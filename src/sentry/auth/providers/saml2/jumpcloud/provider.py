from sentry.auth.providers.saml2.generic.provider import GenericSAML2Provider


class JumpcloudSAML2Provider(GenericSAML2Provider):
    name = "Jumpcloud"
