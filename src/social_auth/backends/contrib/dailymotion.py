"""
Dailymotion OAuth2 support.

This adds support for Dailymotion OAuth service. An application must
be registered first on dailymotion and the settings DAILYMOTION_CONSUMER_KEY
and DAILYMOTION_CONSUMER_SECRET must be defined with the corresponding
values.

User screen name is used to generate username.

By default account id is stored in extra_data field, check OAuthBackend
class for details on how to extend it.
"""
from urllib2 import HTTPError

try:
    import json as simplejson
except ImportError:
    try:
        import simplejson
    except ImportError:
        from django.utils import simplejson

from social_auth.utils import dsa_urlopen
from social_auth.backends import BaseOAuth2
from social_auth.backends import SocialAuthBackend
from social_auth.exceptions import AuthCanceled


# Dailymotion configuration
DAILYMOTION_SERVER = 'api.dailymotion.com'
DAILYMOTION_REQUEST_TOKEN_URL = 'https://%s/oauth/token' % DAILYMOTION_SERVER
DAILYMOTION_ACCESS_TOKEN_URL = 'https://%s/oauth/token' % DAILYMOTION_SERVER
# Note: oauth/authorize forces the user to authorize every time.
#       oauth/authenticate uses their previous selection, barring revocation.
DAILYMOTION_AUTHORIZATION_URL = 'https://%s/oauth/authorize' % \
                                    DAILYMOTION_SERVER
DAILYMOTION_CHECK_AUTH = 'https://%s/me/?access_token=' % DAILYMOTION_SERVER


class DailymotionBackend(SocialAuthBackend):
    """Dailymotion OAuth authentication backend"""
    name = 'dailymotion'
    EXTRA_DATA = [('id', 'id')]

    def get_user_id(self, details, response):
        """Use dailymotion username as unique id"""
        return details['username']

    def get_user_details(self, response):
        return {'username': response['screenname']}


class DailymotionAuth(BaseOAuth2):
    """Dailymotion OAuth2 authentication mechanism"""

    AUTHORIZATION_URL = DAILYMOTION_AUTHORIZATION_URL
    REQUEST_TOKEN_URL = DAILYMOTION_REQUEST_TOKEN_URL
    ACCESS_TOKEN_URL = DAILYMOTION_ACCESS_TOKEN_URL
    AUTH_BACKEND = DailymotionBackend
    SETTINGS_KEY_NAME = 'DAILYMOTION_OAUTH2_KEY'
    SETTINGS_SECRET_NAME = 'DAILYMOTION_OAUTH2_SECRET'

    def user_data(self, access_token, *args, **kwargs):
        """Return user data provided"""
        try:
            data = dsa_urlopen(DAILYMOTION_CHECK_AUTH + access_token).read()
            return simplejson.loads(data)
        except (ValueError, HTTPError):
            return None

    def auth_complete(self, *args, **kwargs):
        """Completes login process, must return user instance"""
        if 'denied' in self.data:
            raise AuthCanceled(self)
        else:
            return super(DailymotionAuth, self).auth_complete(*args, **kwargs)

    def oauth_request(self, token, url, extra_params=None):
        extra_params = extra_params or {}
        return extra_params


# Backend definition
BACKENDS = {
    'dailymotion': DailymotionAuth,
}
