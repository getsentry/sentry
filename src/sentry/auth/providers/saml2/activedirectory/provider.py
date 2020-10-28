from __future__ import absolute_import, print_function

from sentry.auth.providers.saml2.generic.provider import GenericSAML2Provider


class ActiveDirectorySAML2Provider(GenericSAML2Provider):
    name = "Active Directory"
