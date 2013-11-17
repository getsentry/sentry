"""
Stackoverflow OAuth support.

This contribution adds support for Stackoverflow OAuth service. The settings
STACKOVERFLOW_CLIENT_ID, STACKOVERFLOW_CLIENT_SECRET and
STACKOVERFLOW_CLIENT_SECRET must be defined with the values given by
Stackoverflow application registration process.

Extended permissions are supported by defining
STACKOVERFLOW_EXTENDED_PERMISSIONS setting, it must be a list of values
to request.

By default account id and token expiration time are stored in extra_data
field, check OAuthBackend class for details on how to extend it.
"""
from urllib import urlencode
from urllib2 import Request, HTTPError
from urlparse import parse_qsl
from gzip import GzipFile
from StringIO import StringIO

try:
    import json as simplejson
except ImportError:
    try:
        import simplejson
    except ImportError:
        from django.utils import simplejson

from django.conf import settings

from social_auth.utils import dsa_urlopen
from social_auth.backends import BaseOAuth2, OAuthBackend
from social_auth.exceptions import AuthUnknownError, AuthCanceled


# Stackoverflow configuration
STACKOVERFLOW_AUTHORIZATION_URL = 'https://stackexchange.com/oauth'
STACKOVERFLOW_ACCESS_TOKEN_URL = 'https://stackexchange.com/oauth/access_token'
STACKOVERFLOW_USER_DATA_URL = 'https://api.stackexchange.com/2.1/me'

STACKOVERFLOW_SERVER = 'stackexchange.com'


class StackoverflowBackend(OAuthBackend):
    """Stackoverflow OAuth authentication backend"""
    name = 'stackoverflow'
    ID_KEY = 'user_id'
    # Default extra data to store
    EXTRA_DATA = [
        ('id', 'id'),
        ('expires', 'expires')
    ]

    def get_user_details(self, response):
        """Return user details from Stackoverflow account"""
        return {'username': response.get('link').split('/')[-1],
                'full_name': response.get('display_name')}


class StackoverflowAuth(BaseOAuth2):
    """Stackoverflow OAuth2 mechanism"""
    AUTHORIZATION_URL = STACKOVERFLOW_AUTHORIZATION_URL
    ACCESS_TOKEN_URL = STACKOVERFLOW_ACCESS_TOKEN_URL
    AUTH_BACKEND = StackoverflowBackend
    SETTINGS_KEY_NAME = 'STACKOVERFLOW_CLIENT_ID'
    SETTINGS_SECRET_NAME = 'STACKOVERFLOW_CLIENT_SECRET'
    SCOPE_SEPARATOR = ','
    # See: https://api.stackexchange.com/docs/authentication#scope
    SCOPE_VAR_NAME = 'STACKOVERFLOW_EXTENDED_PERMISSIONS'

    def auth_complete(self, *args, **kwargs):
        """Completes loging process, must return user instance"""
        self.process_error(self.data)
        params = self.auth_complete_params(self.validate_state())
        request = Request(self.ACCESS_TOKEN_URL, data=urlencode(params),
                          headers=self.auth_headers())

        try:
            response = dict(parse_qsl(dsa_urlopen(request).read()))
        except HTTPError, e:
            if e.code == 400:
                raise AuthCanceled(self)
            else:
                raise
        except (ValueError, KeyError):
            raise AuthUnknownError(self)

        self.process_error(response)
        return self.do_auth(response['access_token'], response=response,
                            *args, **kwargs)

    def user_data(self, access_token, *args, **kwargs):
        """Loads user data from service"""
        url = STACKOVERFLOW_USER_DATA_URL + '?' + urlencode({
            'site': 'stackoverflow',
            'access_token': access_token,
            'key': getattr(settings, 'STACKOVERFLOW_KEY')})

        opener = dsa_urlopen(url)
        if opener.headers.get('content-encoding') == 'gzip':
            ''' stackoverflow doesn't respect no gzip header '''
            gzip = GzipFile(fileobj=StringIO(opener.read()), mode='r')
            response = gzip.read()
        else:
            response = opener.read()

        try:
            data = simplejson.loads(response)
            return data.get('items')[0]
        except (ValueError, TypeError):
            return None

# Backend definition
BACKENDS = {
    'stackoverflow': StackoverflowAuth,
}
