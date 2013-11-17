"""
Yandex OpenID and OAuth2 support.

This contribution adds support for Yandex.ru OpenID service in the form
openid.yandex.ru/user. Username is retrieved from the identity url.

If username is not specified, OpenID 2.0 url used for authentication.
"""
try:
    import json as simplejson
except ImportError:
    try:
        import simplejson
    except ImportError:
        from django.utils import simplejson

from urllib import urlencode
from urlparse import urlparse, urlsplit

from social_auth.backends import OpenIDBackend, OpenIdAuth, OAuthBackend, \
                                 BaseOAuth2

from social_auth.utils import setting, log, dsa_urlopen

# Yandex configuration
YANDEX_AUTHORIZATION_URL = 'https://oauth.yandex.ru/authorize'
YANDEX_ACCESS_TOKEN_URL = 'https://oauth.yandex.ru/token'
YANDEX_SERVER = 'oauth.yandex.ru'

YANDEX_OPENID_URL = 'http://openid.yandex.ru'


def get_username_from_url(links):
    try:
        host = urlparse(links.get('www')).hostname
        return host.split('.')[0]
    except (IndexError, AttributeError):
        return None


class YandexBackend(OpenIDBackend):
    """Yandex OpenID authentication backend"""
    name = 'yandex'

    def get_user_id(self, details, response):
        return details['email'] or response.identity_url

    def get_user_details(self, response):
        """Generate username from identity url"""
        values = super(YandexBackend, self).get_user_details(response)
        values['username'] = values.get('username') or \
                             urlsplit(response.identity_url).path.strip('/')

        values['email'] = values.get('email', '')

        return values


class YandexAuth(OpenIdAuth):
    """Yandex OpenID authentication"""
    AUTH_BACKEND = YandexBackend

    def openid_url(self):
        """Returns Yandex authentication URL"""
        return YANDEX_OPENID_URL


class YaruBackend(OAuthBackend):
    """Yandex OAuth authentication backend"""
    name = 'yaru'
    EXTRA_DATA = [
        ('id', 'id'),
        ('expires', 'expires')
    ]

    def get_user_details(self, response):
        """Return user details from Yandex account"""
        name = response['name']
        last_name = ''

        if ' ' in name:
            names = name.split(' ')
            last_name = names[0]
            first_name = names[1]
        else:
            first_name = name

        return {
            'username': get_username_from_url(response.get('links')),
            'email': response.get('email', ''),
            'first_name': first_name,
            'last_name': last_name,
        }


class YaruAuth(BaseOAuth2):
    """Yandex Ya.ru OAuth mechanism"""
    AUTHORIZATION_URL = YANDEX_AUTHORIZATION_URL
    ACCESS_TOKEN_URL = YANDEX_ACCESS_TOKEN_URL
    AUTH_BACKEND = YaruBackend
    REDIRECT_STATE = False
    SETTINGS_KEY_NAME = 'YANDEX_APP_ID'
    SETTINGS_SECRET_NAME = 'YANDEX_API_SECRET'

    def get_api_url(self):
        return 'https://api-yaru.yandex.ru/me/'

    def user_data(self, access_token, response, *args, **kwargs):
        """Loads user data from service"""
        params = {'oauth_token': access_token,
                  'format': 'json',
                  'text': 1,
                  }

        url = self.get_api_url() + '?' + urlencode(params)
        try:
            return simplejson.load(dsa_urlopen(url))
        except (ValueError, IndexError):
            log('error', 'Could not load data from Yandex.',
                exc_info=True, extra=dict(data=params))
            return None


class YandexOAuth2Backend(YaruBackend):
    """Legacy Yandex OAuth2 authentication backend"""
    name = 'yandex-oauth2'


class YandexOAuth2(YaruAuth):
    """Yandex Ya.ru/Moi Krug OAuth mechanism"""
    AUTH_BACKEND = YandexOAuth2Backend

    def get_api_url(self):
        return setting('YANDEX_OAUTH2_API_URL')

    def user_data(self, access_token, response, *args, **kwargs):
        reply = super(YandexOAuth2, self).user_data(access_token,
                                                    response, args, kwargs)

        if reply:
            if isinstance(reply, list) and len(reply) >= 1:
                reply = reply[0]

            if 'links' in reply:
                userpic = reply['links'].get('avatar')
            elif 'avatar' in reply:
                userpic = reply['avatar'].get('Portrait')
            else:
                userpic = ''

            reply.update({
                'id': reply['id'].split("/")[-1],
                'access_token': access_token,
                'userpic': userpic
            })

        return reply


# Backend definition
BACKENDS = {
    'yandex': YandexAuth,
    'yaru': YaruAuth,
    'yandex-oauth2': YandexOAuth2
}
