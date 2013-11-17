"""
Yammer OAuth2 support
"""
import logging
from urllib import urlencode
from urlparse import parse_qs

try:
    import json as simplejson
except ImportError:
    try:
        import simplejson
    except ImportError:
        from django.utils import simplejson

from django.utils.datastructures import MergeDict

from social_auth.backends import BaseOAuth2, OAuthBackend
from social_auth.exceptions import AuthCanceled
from social_auth.utils import dsa_urlopen, setting


YAMMER_SERVER = 'yammer.com'
YAMMER_STAGING_SERVER = 'staging.yammer.com'
YAMMER_OAUTH_URL = 'https://www.%s/oauth2/' % YAMMER_SERVER
YAMMER_AUTH_URL = 'https://www.%s/dialog/oauth' % YAMMER_SERVER
YAMMER_API_URL = 'https://www.%s/api/v1/' % YAMMER_SERVER


class YammerBackend(OAuthBackend):
    name = 'yammer'
    EXTRA_DATA = [
        ('id', 'id'),
        ('expires', 'expires'),
        ('mugshot_url', 'mugshot_url')
    ]

    def get_user_id(self, details, response):
        return response['user']['id']

    def get_user_details(self, response):
        username = response['user']['name']
        first_name = response['user']['first_name']
        last_name = response['user']['last_name']
        full_name = response['user']['full_name']
        email = response['user']['contact']['email_addresses'][0]['address']
        mugshot_url = response['user']['mugshot_url']
        return {
            'username': username,
            'email': email,
            'fullname': full_name,
            'first_name': first_name,
            'last_name': last_name,
            'picture_url': mugshot_url
        }


class YammerOAuth2(BaseOAuth2):
    AUTH_BACKEND = YammerBackend
    AUTHORIZATION_URL = YAMMER_AUTH_URL
    ACCESS_TOKEN_URL = '%s%s' % (YAMMER_OAUTH_URL, 'access_token')
    REQUEST_TOKEN_URL = '%s%s' % (YAMMER_OAUTH_URL, 'request_token')
    SETTINGS_KEY_NAME = 'YAMMER_CONSUMER_KEY'
    SETTINGS_SECRET_NAME = 'YAMMER_CONSUMER_SECRET'

    def user_data(self, access_token, *args, **kwargs):
        """Load user data from yammer"""
        params = {
            'client_id': setting(self.SETTINGS_KEY_NAME, ''),
            'client_secret': setting(self.SETTINGS_SECRET_NAME, ''),
            'code': access_token
        }

        url = '%s?%s' % (self.ACCESS_TOKEN_URL, urlencode(params))

        try:
            return simplejson.load(dsa_urlopen(url))
        except Exception, e:
            logging.exception(e)
        return None

    def auth_complete(self, *args, **kwargs):
        """Yammer API is a little strange"""
        if 'error' in self.data:
            logging.error("%s: %s:\n%s" % (
                self.data('error'), self.data('error_reason'),
                self.data('error_description')
            ))
            raise AuthCanceled(self)

        # now we need to clean up the data params
        data = dict(self.data.copy())
        redirect_state = data.get('redirect_state')
        if redirect_state and '?' in redirect_state:
            redirect_state, extra = redirect_state.split('?', 1)
            extra = parse_qs(extra)
            data['redirect_state'] = redirect_state
            if 'code' in extra:
                data['code'] = extra['code'][0]
        self.data = MergeDict(data)
        return super(YammerOAuth2, self).auth_complete(*args, **kwargs)


BACKENDS = {
    'yammer': YammerOAuth2
}
