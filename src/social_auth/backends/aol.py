"""
AOL OpenID support

No extra configurations are needed to make this work.
"""
from social_auth.backends import OpenIdAuth, OpenIDBackend


AOL_OPENID_URL = 'http://openid.aol.com'

# Backends
class AolBackend(OpenIDBackend):
    """Aol OpenID authentication backend"""
    name = 'aol'

# Auth classes
class AolAuth(OpenIdAuth):
    """Aol OpenID authentication"""
    AUTH_BACKEND = AolBackend

    def openid_url(self):
        """Return AOL OpenID service url"""
        return AOL_OPENID_URL

# Backend definition
BACKENDS = {
    'aol': AolAuth,
}
