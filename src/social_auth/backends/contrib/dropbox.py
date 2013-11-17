"""
Dropbox OAuth support.

This contribution adds support for Dropbox OAuth service. The settings
DROPBOX_APP_ID and DROPBOX_API_SECRET must be defined with the values
given by Dropbox application registration process.

By default account id and token expiration time are stored in extra_data
field, check OAuthBackend class for details on how to extend it.
"""
try:
    import json as simplejson
except ImportError:
    try:
        import simplejson
    except ImportError:
        from django.utils import simplejson

from social_auth.utils import setting
from social_auth.backends import ConsumerBasedOAuth, OAuthBackend


# Dropbox configuration
DROPBOX_SERVER = 'dropbox.com'
DROPBOX_API = 'api.%s' % DROPBOX_SERVER
DROPBOX_REQUEST_TOKEN_URL = 'https://%s/1/oauth/request_token' % DROPBOX_API
DROPBOX_AUTHORIZATION_URL = 'https://www.%s/1/oauth/authorize' % DROPBOX_SERVER
DROPBOX_ACCESS_TOKEN_URL = 'https://%s/1/oauth/access_token' % DROPBOX_API


class DropboxBackend(OAuthBackend):
    """Dropbox OAuth authentication backend"""
    name = 'dropbox'
    # Default extra data to store
    EXTRA_DATA = [
        ('id', 'id'),
        ('expires', 'expires')
    ]

    def get_user_details(self, response):
        """Return user details from Dropbox account"""
        return {'username': str(response.get('uid')),
                'email': response.get('email'),
                'first_name': response.get('display_name')}

    def get_user_id(self, details, response):
        """OAuth providers return an unique user id in response"""
        # Dropbox uses a uid parameter instead of id like most others...
        return response['uid']


class DropboxAuth(ConsumerBasedOAuth):
    """Dropbox OAuth authentication mechanism"""
    AUTHORIZATION_URL = DROPBOX_AUTHORIZATION_URL
    REQUEST_TOKEN_URL = DROPBOX_REQUEST_TOKEN_URL
    ACCESS_TOKEN_URL = DROPBOX_ACCESS_TOKEN_URL
    AUTH_BACKEND = DropboxBackend
    SETTINGS_KEY_NAME = 'DROPBOX_APP_ID'
    SETTINGS_SECRET_NAME = 'DROPBOX_API_SECRET'

    def user_data(self, access_token, *args, **kwargs):
        """Loads user data from service"""
        url = 'https://' + DROPBOX_API + '/1/account/info'
        request = self.oauth_request(access_token, url)
        response = self.fetch_response(request)
        try:
            return simplejson.loads(response)
        except ValueError:
            return None

    @classmethod
    def enabled(cls):
        """Return backend enabled status by checking basic settings"""
        return setting('DROPBOX_APP_ID') and setting('DROPBOX_API_SECRET')


# Backend definition
BACKENDS = {
    'dropbox': DropboxAuth,
}
