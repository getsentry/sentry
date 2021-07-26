from sentry.auth.providers.saml2.generic.view import GenericSAML2View


class ActiveDirectorySAML2View(GenericSAML2View):
    """
    Active Directory is a subset of our generic SAML2 implementation. However,
    this may not be obvious to end users. This inheritance class allows us to
    explicitly surface this option to them.
    """
