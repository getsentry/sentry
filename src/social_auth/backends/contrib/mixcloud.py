"""
Mixcloud OAuth2 support
"""
from urllib import urlencode
from urllib2 import Request

try:
    import json as simplejson
except ImportError:
    try:
        import simplejson
    except ImportError:
        from django.utils import simplejson

from social_auth.backends import BaseOAuth2, OAuthBackend
from social_auth.utils import dsa_urlopen


MIXCLOUD_PROFILE_URL = 'https://api.mixcloud.com/me/'


class MixcloudBackend(OAuthBackend):
    name = 'mixcloud'

    def get_user_id(self, details, response):
        return response['username']

    def get_user_details(self, response):
        return {'username': response['username'],
                'email': None,
                'fullname': response['name'],
                'first_name': None,
                'last_name': None}


class MixcloudOAuth2(BaseOAuth2):
    AUTH_BACKEND = MixcloudBackend
    AUTHORIZATION_URL = 'https://www.mixcloud.com/oauth/authorize'
    ACCESS_TOKEN_URL = 'https://www.mixcloud.com/oauth/access_token'
    SETTINGS_KEY_NAME = 'MIXCLOUD_CLIENT_ID'
    SETTINGS_SECRET_NAME = 'MIXCLOUD_CLIENT_SECRET'

    def user_data(self, access_token, *args, **kwargs):
        return mixcloud_profile(access_token)


def mixcloud_profile(access_token):
    data = {'access_token': access_token, 'alt': 'json'}
    request = Request(MIXCLOUD_PROFILE_URL + '?' + urlencode(data))
    try:
        return simplejson.loads(dsa_urlopen(request).read())
    except (ValueError, KeyError, IOError):
        return None


BACKENDS = {
    'mixcloud': MixcloudOAuth2,
}
