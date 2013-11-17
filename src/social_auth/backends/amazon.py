import base64
from urllib2 import Request, HTTPError
from urllib import urlencode

try:
    import json as simplejson
except ImportError:
    try:
        import simplejson
    except ImportError:
        from django.utils import simplejson

from social_auth.backends import BaseOAuth2, OAuthBackend
from social_auth.utils import dsa_urlopen
from social_auth.exceptions import AuthTokenError


class AmazonBackend(OAuthBackend):
    """Amazon OAuth2 authentication backend"""
    name = 'amazon'
    # Default extra data to store
    EXTRA_DATA = [
        ('user_id', 'user_id'),
        ('postal_code', 'postal_code')
    ]
    ID_KEY = 'user_id'

    def get_user_details(self, response):
        """Return user details from amazon account"""
        name = response.get('name') or ''
        first_name = ''
        last_name = ''
        if name and ' ' in name:
            first_name, last_name = response.get('name').split(' ', 1)
        else:
            first_name = name
        return {'username': name,
                'email': response.get('email'),
                'fullname': name,
                'first_name': first_name,
                'last_name': last_name}


class AmazonAuth(BaseOAuth2):
    """Amazon OAuth2 support"""
    REDIRECT_STATE = False
    AUTH_BACKEND = AmazonBackend
    AUTHORIZATION_URL = 'http://www.amazon.com/ap/oa'
    ACCESS_TOKEN_URL = 'https://api.amazon.com/auth/o2/token'
    SETTINGS_KEY_NAME = 'AMAZON_APP_ID'
    SETTINGS_SECRET_NAME = 'AMAZON_API_SECRET'
    SCOPE_VAR_NAME = 'AMAZON_EXTENDED_PERMISSIONS'
    DEFAULT_SCOPE = ['profile']

    @classmethod
    def refresh_token(cls, token, redirect_uri):
        data = cls.refresh_token_params(token)
        data['redirect_uri'] = redirect_uri
        request = Request(cls.ACCESS_TOKEN_URL,
                          data=urlencode(data),
                          headers=cls.auth_headers())
        return cls.process_refresh_token_response(dsa_urlopen(request).read())

    def user_data(self, access_token, *args, **kwargs):
        """Grab user profile information from amazon."""
        url = 'https://www.amazon.com/ap/user/profile?access_token=%s' % \
                    access_token
        try:
            response = simplejson.load(dsa_urlopen(Request(url)))
        except ValueError:
            return None
        except HTTPError:
            raise AuthTokenError(self)
        else:
            if 'Profile' in response:
                response = {
                    'user_id': response['Profile']['CustomerId'],
                    'name': response['Profile']['Name'],
                    'email': response['Profile']['PrimaryEmail']
                }
            return response

    @classmethod
    def auth_headers(cls):
        return {
            'Authorization': 'Basic %s' % base64.urlsafe_b64encode(
                '%s:%s' % cls.get_key_and_secret()
            )
        }


BACKENDS = {
    'amazon': AmazonAuth
}
