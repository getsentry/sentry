"""
Obtain
TRELLO_CONSUMER_KEY & TRELLO_CONSUMER_SECRET
at https://trello.com/1/appKey/generate
and put into settings.py

Also you can put something like
TRELLO_AUTH_EXTRA_ARGUMENTS = {
    'name': '7WebPages Time Tracker',
    'expiration': 'never'
}

into settings.py
"""
from __future__ import absolute_import

try:
    import json as simplejson
except ImportError:
    try:
        import simplejson
    except ImportError:
        from django.utils import simplejson

from six.moves.urllib.parse import urlencode
from social_auth.backends import ConsumerBasedOAuth, OAuthBackend
from social_auth.utils import dsa_urlopen, backend_setting


TRELLO_REQUEST_TOKEN_URL = 'https://trello.com/1/OAuthGetRequestToken'
TRELLO_ACCESS_TOKEN_URL = 'https://trello.com/1/OAuthGetAccessToken'
TRELLO_AUTHORIZATION_URL = 'https://trello.com/1/OAuthAuthorizeToken'
TRELLO_USER_DETAILS_URL = 'https://api.trello.com/1/members/me/'


class TrelloBackend(OAuthBackend):
    """Trello OAuth authentication backend"""
    name = 'trello'
    EXTRA_DATA = [
        ('username', 'username'),
        ('email', 'email'),
        ('fullName', 'full_name'),
    ]

    def get_user_details(self, response):
        """Return user details from Trello account"""
        name_arr = response.get('fullName').split()
        first_name = None
        last_name = None

        if len(name_arr) > 0:
            first_name = name_arr[0]
        if len(name_arr) > 1:
            last_name = name_arr[1]

        return {'username': response.get('username'),
                'email': response.get('email'),
                'first_name': first_name,
                'last_name': last_name}

    def get_user_id(self, details, response):
        """Return the user id, Trello only provides username as a unique
        identifier"""
        return response['username']

    @classmethod
    def tokens(cls, instance):
        """Return the tokens needed to authenticate the access to any API the
        service might provide. Trello uses a pair of OAuthToken consisting
        on a oauth_token and oauth_token_secret.

        instance must be a UserSocialAuth instance.
        """
        token = super(TrelloBackend, cls).tokens(instance)
        if token and 'access_token' in token:
            token = dict(
                tok.split('=')
                for tok in token['access_token'].split('&')
            )
        return token


class TrelloAuth(ConsumerBasedOAuth):
    """Trello OAuth authentication mechanism"""
    AUTHORIZATION_URL = TRELLO_AUTHORIZATION_URL
    REQUEST_TOKEN_URL = TRELLO_REQUEST_TOKEN_URL
    ACCESS_TOKEN_URL = TRELLO_ACCESS_TOKEN_URL
    AUTH_BACKEND = TrelloBackend
    SETTINGS_KEY_NAME = 'TRELLO_CONSUMER_KEY'
    SETTINGS_SECRET_NAME = 'TRELLO_CONSUMER_SECRET'

    def user_data(self, access_token, *args, **kwargs):
        """Loads user data from service"""
        token = access_token.key
        params = {
            'token': token,
            'key': backend_setting(self, self.SETTINGS_KEY_NAME)
        }
        url = TRELLO_USER_DETAILS_URL + '?' + urlencode(params)
        try:
            return simplejson.load(dsa_urlopen(url))
        except ValueError:
            return None


# Backend definition
BACKENDS = {
    'trello': TrelloAuth,
}
