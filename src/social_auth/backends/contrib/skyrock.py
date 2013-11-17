"""
Skyrock OAuth support.

This adds support for Skyrock OAuth service. An application must
be registered first on skyrock and the settings SKYROCK_CONSUMER_KEY
and SKYROCK_CONSUMER_SECRET must be defined with they corresponding
values.

By default account id is stored in extra_data field, check OAuthBackend
class for details on how to extend it.
"""
try:
    import json as simplejson
except ImportError:
    try:
        import simplejson
    except ImportError:
        from django.utils import simplejson

from social_auth.exceptions import AuthCanceled
from social_auth.backends import ConsumerBasedOAuth, OAuthBackend


# Skyrock configuration
SKYROCK_SERVER = 'api.skyrock.com'
SKYROCK_REQUEST_TOKEN_URL = 'https://%s/v2/oauth/initiate' % SKYROCK_SERVER
SKYROCK_ACCESS_TOKEN_URL = 'https://%s/v2/oauth/token' % SKYROCK_SERVER
# Note: oauth/authorize forces the user to authorize every time.
#       oauth/authenticate uses their previous selection, barring revocation.
SKYROCK_AUTHORIZATION_URL = 'http://%s/v2/oauth/authenticate' % SKYROCK_SERVER
SKYROCK_CHECK_AUTH = 'https://%s/v2/user/get.json' % SKYROCK_SERVER


class SkyrockBackend(OAuthBackend):
    """Skyrock OAuth authentication backend"""
    name = 'skyrock'
    EXTRA_DATA = [('id', 'id')]

    def get_user_id(self, details, response):
        return response['id_user']

    def get_user_details(self, response):
        """Return user details from Skyrock account"""
        return {'username': response['username'],
                'email': response['email'],
                'fullname': response['firstname'] + ' ' + response['name'],
                'first_name': response['firstname'],
                'last_name': response['name']}


class SkyrockAuth(ConsumerBasedOAuth):
    """Skyrock OAuth authentication mechanism"""
    AUTHORIZATION_URL = SKYROCK_AUTHORIZATION_URL
    REQUEST_TOKEN_URL = SKYROCK_REQUEST_TOKEN_URL
    ACCESS_TOKEN_URL = SKYROCK_ACCESS_TOKEN_URL
    AUTH_BACKEND = SkyrockBackend
    SETTINGS_KEY_NAME = 'SKYROCK_CONSUMER_KEY'
    SETTINGS_SECRET_NAME = 'SKYROCK_CONSUMER_SECRET'

    def user_data(self, access_token):
        """Return user data provided"""
        request = self.oauth_request(access_token, SKYROCK_CHECK_AUTH)
        json = self.fetch_response(request)
        try:
            return simplejson.loads(json)
        except ValueError:
            return None

    def auth_complete(self, *args, **kwargs):
        """Completes loging process, must return user instance"""
        if 'denied' in self.data:
            raise AuthCanceled(self)
        else:
            return super(SkyrockAuth, self).auth_complete(*args, **kwargs)


# Backend definition
BACKENDS = {
    'skyrock': SkyrockAuth,
}
