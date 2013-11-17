"""
XING OAuth support

No extra configurations are needed to make this work.
"""
import oauth2 as oauth
from oauth2 import Token

from urllib import urlencode

try:
    import json as simplejson
except ImportError:
    try:
        import simplejson
    except ImportError:
        from django.utils import simplejson

from social_auth.backends import ConsumerBasedOAuth, OAuthBackend
from social_auth.exceptions import AuthCanceled, AuthUnknownError


XING_SERVER = 'xing.com'
XING_REQUEST_TOKEN_URL = 'https://api.%s/v1/request_token' % \
                                    XING_SERVER
XING_ACCESS_TOKEN_URL = 'https://api.%s/v1/access_token' % \
                                    XING_SERVER
XING_AUTHORIZATION_URL = 'https://www.%s/v1/authorize' % \
                                    XING_SERVER
XING_CHECK_AUTH = 'https://api.%s/v1/users/me.json' % XING_SERVER


class XingBackend(OAuthBackend):
    """Xing OAuth authentication backend"""
    name = 'xing'
    EXTRA_DATA = [
        ('id', 'id'),
        ('user_id', 'user_id')
    ]

    def get_user_details(self, response):
        """Return user details from Xing account"""
        first_name, last_name = response['first_name'], response['last_name']
        email = response.get('email', '')
        return {'username': first_name + last_name,
                'fullname': first_name + ' ' + last_name,
                'first_name': first_name,
                'last_name': last_name,
                'email': email}


class XingAuth(ConsumerBasedOAuth):
    """Xing OAuth authentication mechanism"""
    AUTH_BACKEND = XingBackend
    AUTHORIZATION_URL = XING_AUTHORIZATION_URL
    REQUEST_TOKEN_URL = XING_REQUEST_TOKEN_URL
    ACCESS_TOKEN_URL = XING_ACCESS_TOKEN_URL
    SETTINGS_KEY_NAME = 'XING_CONSUMER_KEY'
    SETTINGS_SECRET_NAME = 'XING_CONSUMER_SECRET'
    SCOPE_SEPARATOR = '+'

    def user_data(self, access_token, *args, **kwargs):
        """Return user data provided"""
        key, secret = self.get_key_and_secret()
        consumer = oauth.Consumer(key=key, secret=secret)
        client = oauth.Client(consumer, access_token)
        resp, content = client.request(XING_CHECK_AUTH, 'GET')
        profile = simplejson.loads(content)['users'][0]

        try:
            return {
                'user_id': profile['id'],
                'id': profile['id'],
                'first_name': profile['first_name'],
                'last_name': profile['last_name'],
                'email': profile['active_email']
            }
        except (KeyError, IndexError):
            pass

    def auth_complete(self, *args, **kwargs):
        """Complete auth process. Check Xing error response."""
        oauth_problem = self.request.GET.get('oauth_problem')
        if oauth_problem:
            if oauth_problem == 'user_refused':
                raise AuthCanceled(self, '')
            else:
                raise AuthUnknownError(self, 'Xing error was %s' %
                                                    oauth_problem)
        return super(XingAuth, self).auth_complete(*args, **kwargs)

    def unauthorized_token(self):
        """Makes first request to oauth. Returns an unauthorized Token."""
        request_token_url = self.REQUEST_TOKEN_URL
        scope = self.get_scope_argument()
        if scope:
            request_token_url = request_token_url + '?' + urlencode(scope)

        request = self.oauth_request(
            token=None,
            url=request_token_url,
            extra_params=self.request_token_extra_arguments()
        )
        response = self.fetch_response(request)
        return Token.from_string(response)


# Backend definition
BACKENDS = {
    'xing': XingAuth,
}
