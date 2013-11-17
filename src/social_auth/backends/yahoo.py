"""
Yahoo OpenID support

No extra configurations are needed to make this work.
"""
from social_auth.backends import OpenIDBackend, OpenIdAuth


YAHOO_OPENID_URL = 'http://me.yahoo.com'


class YahooBackend(OpenIDBackend):
    """Yahoo OpenID authentication backend"""
    name = 'yahoo'


class YahooAuth(OpenIdAuth):
    """Yahoo OpenID authentication"""
    AUTH_BACKEND = YahooBackend

    def openid_url(self):
        """Return Yahoo OpenID service url"""
        return YAHOO_OPENID_URL


# Backend definition
BACKENDS = {
    'yahoo': YahooAuth,
}
