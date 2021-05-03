from sentry.auth.providers.saml2.generic.provider import GenericSAML2Provider
from sentry import features


class ActiveDirectorySAML2Provider(GenericSAML2Provider):
    name = "Active Directory"

    def can_use_scim(self, organization, user):
        if features.has("organizations:sso-scim", organization, actor=user):
            return True
        return False
