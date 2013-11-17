"""
Fedora OpenID support

No extra configurations are needed to make this work.
"""
from social_auth.backends import OpenIDBackend, OpenIdAuth


FEDORA_OPENID_URL = 'https://id.fedoraproject.org'


class FedoraBackend(OpenIDBackend):
    """Fedora OpenID authentication backend"""
    name = 'fedora'


class FedoraAuth(OpenIdAuth):
    """Fedora OpenID authentication"""
    AUTH_BACKEND = FedoraBackend

    def openid_url(self):
        """Return Fedora OpenID service url"""
        return FEDORA_OPENID_URL


# Backend definition
BACKENDS = {
    'fedora': FedoraAuth,
}
