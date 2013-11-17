#coding:utf8
#author:hepochen@gmail.com  https://github.com/hepochen
"""
Weibo OAuth2 support.

This script adds support for Weibo OAuth service. An application must
be registered first on http://open.weibo.com.

WEIBO_CLIENT_KEY and WEIBO_CLIENT_SECRET must be defined in the settings.py
correctly.

By default account id,profile_image_url,gender are stored in extra_data field,
check OAuthBackend class for details on how to extend it.
"""
from urllib import urlencode

try:
    import json as simplejson
except ImportError:
    try:
        import simplejson
    except ImportError:
        from django.utils import simplejson

from social_auth.backends import OAuthBackend, BaseOAuth2
from social_auth.utils import dsa_urlopen


WEIBO_SERVER = 'api.weibo.com'
WEIBO_REQUEST_TOKEN_URL = 'https://%s/oauth2/request_token' % WEIBO_SERVER
WEIBO_ACCESS_TOKEN_URL = 'https://%s/oauth2/access_token' % WEIBO_SERVER
WEIBO_AUTHORIZATION_URL = 'https://%s/oauth2/authorize' % WEIBO_SERVER


class WeiboBackend(OAuthBackend):
    """Weibo (of sina) OAuth authentication backend"""
    name = 'weibo'
    # Default extra data to store
    EXTRA_DATA = [
        ('id', 'id'),
        ('name', 'username'),
        ('profile_image_url', 'profile_image_url'),
        ('gender', 'gender')
    ]

    def get_user_id(self, details, response):
        return response['uid']

    def get_user_details(self, response):
        """Return user details from Weibo. API URL is:
        https://api.weibo.com/2/users/show.json/?uid=<UID>&access_token=<TOKEN>
        """
        return {'username': response.get("name", ""),
                'first_name': response.get('screen_name', '')}


class WeiboAuth(BaseOAuth2):
    """Weibo OAuth authentication mechanism"""
    AUTHORIZATION_URL = WEIBO_AUTHORIZATION_URL
    REQUEST_TOKEN_URL = WEIBO_REQUEST_TOKEN_URL
    ACCESS_TOKEN_URL = WEIBO_ACCESS_TOKEN_URL
    AUTH_BACKEND = WeiboBackend
    SETTINGS_KEY_NAME = 'WEIBO_CLIENT_KEY'
    SETTINGS_SECRET_NAME = 'WEIBO_CLIENT_SECRET'
    REDIRECT_STATE = False

    def user_data(self, access_token, *args, **kwargs):
        uid = kwargs.get('response', {}).get('uid')
        data = {'access_token': access_token, 'uid': uid}
        url = 'https://api.weibo.com/2/users/show.json?' + urlencode(data)
        try:
            return simplejson.loads(dsa_urlopen(url).read())
        except (ValueError, KeyError, IOError):
            return None


# Backend definition
BACKENDS = {
    'weibo': WeiboAuth
}
