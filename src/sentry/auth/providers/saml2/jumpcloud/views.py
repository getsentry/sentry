from sentry.auth.providers.saml2.generic.views import GenericSAML2View


class JumpcloudSAML2View(GenericSAML2View):
    """
    Jumpcloud is a subset of our generic SAML2 implementation. However,
    this may not be obvious to end users. This inheritance class allows us to
    explicitly surface this option to them.
    """
