from social_auth.backends import OpenIDBackend, OpenIdAuth

E_ID_OPENID_URL = 'https://www.e-contract.be/eid-idp/endpoints/openid/auth'


class EIDBackend(OpenIDBackend):
    """e-ID OpenID authentication backend"""
    name = 'eID'


class EIDAuth(OpenIdAuth):
    """Belgium e-ID OpenID authentication"""
    AUTH_BACKEND = EIDBackend

    def openid_url(self):
        """Return Belgium e-ID OpenID service url"""
        return E_ID_OPENID_URL

# Backend definition
BACKENDS = {
    'eID': EIDAuth,
}
