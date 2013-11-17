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


class RedditBackend(OAuthBackend):
    """Reddit OAuth2 authentication backend"""
    name = 'reddit'
    # Default extra data to store
    EXTRA_DATA = [
        ('id', 'id'),
        ('link_karma', 'link_karma'),
        ('comment_karma', 'comment_karma'),
        ('refresh_token', 'refresh_token'),
        ('expires_in', 'expires')
    ]

    def get_user_details(self, response):
        """Return user details from reddit account"""
        return {'username': response.get('name'),
                'email': '', 'fullname': '',
                'first_name': '', 'last_name': ''}


class RedditAuth(BaseOAuth2):
    """Reddit OAuth2 support"""
    REDIRECT_STATE = False
    AUTH_BACKEND = RedditBackend
    SCOPE_SEPARATOR = ','
    AUTHORIZATION_URL = 'https://ssl.reddit.com/api/v1/authorize'
    ACCESS_TOKEN_URL = 'https://ssl.reddit.com/api/v1/access_token'
    SETTINGS_KEY_NAME = 'REDDIT_APP_ID'
    SETTINGS_SECRET_NAME = 'REDDIT_API_SECRET'
    SCOPE_VAR_NAME = 'REDDIT_EXTENDED_PERMISSIONS'
    DEFAULT_SCOPE = ['identity']

    @classmethod
    def refresh_token(cls, token, redirect_uri):
        data = cls.refresh_token_params(token)
        data['redirect_uri'] = redirect_uri
        request = Request(cls.ACCESS_TOKEN_URL,
                          data=urlencode(data),
                          headers=cls.auth_headers())
        return cls.process_refresh_token_response(dsa_urlopen(request).read())

    def user_data(self, access_token, *args, **kwargs):
        """Grab user profile information from reddit."""
        try:
            request = Request(
                'https://oauth.reddit.com/api/v1/me.json',
                headers={'Authorization': 'bearer %s' % access_token}
            )
            return simplejson.load(dsa_urlopen(request))
        except ValueError:
            return None
        except HTTPError:
            raise AuthTokenError(self)

    @classmethod
    def auth_headers(cls):
        return {
            'Authorization': 'Basic %s' % base64.urlsafe_b64encode(
                '%s:%s' % cls.get_key_and_secret()
            )
        }


BACKENDS = {
    'reddit': RedditAuth
}
