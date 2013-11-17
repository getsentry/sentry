"""
Mail.ru OAuth2 support

Take a look to http://api.mail.ru/docs/guides/oauth/

You need to register OAuth site here:
http://api.mail.ru/sites/my/add

Then update your settings values using registration information

"""

try:
    import json as simplejson
except ImportError:
    try:
        import simplejson
    except ImportError:
        from django.utils import simplejson

from django.conf import settings

from urllib import urlencode, unquote
from urllib2 import Request, HTTPError
from hashlib import md5

from social_auth.backends import OAuthBackend, BaseOAuth2
from social_auth.exceptions import AuthCanceled
from social_auth.utils import setting, log, dsa_urlopen

MAILRU_API_URL = 'http://www.appsmail.ru/platform/api'
MAILRU_OAUTH2_SCOPE = ['']


class MailruBackend(OAuthBackend):
    """Mail.ru authentication backend"""
    name = 'mailru-oauth2'
    EXTRA_DATA = [('refresh_token', 'refresh_token'),
                  ('expires_in', 'expires')]

    def get_user_id(self, details, response):
        """Return user unique id provided by Mail.ru"""
        return response['uid']

    def get_user_details(self, response):
        """Return user details from Mail.ru request"""
        values = {
            'username': unquote(response['nick']),
            'email': unquote(response['email']),
            'first_name': unquote(response['first_name']),
            'last_name': unquote(response['last_name'])
        }

        if values['first_name'] and values['last_name']:
            values['fullname'] = '%s %s' % (values['first_name'],
                                            values['last_name'])
        return values


class MailruOAuth2(BaseOAuth2):
    """Mail.ru OAuth2 support"""
    AUTH_BACKEND = MailruBackend
    AUTHORIZATION_URL = 'https://connect.mail.ru/oauth/authorize'
    ACCESS_TOKEN_URL = 'https://connect.mail.ru/oauth/token'
    SETTINGS_KEY_NAME = 'MAILRU_OAUTH2_CLIENT_KEY'
    SETTINGS_SECRET_NAME = 'MAILRU_OAUTH2_CLIENT_SECRET'

    def get_scope(self):
        return setting('MAILRU_OAUTH2_EXTRA_SCOPE', [])

    def auth_complete(self, *args, **kwargs):
        try:
            return super(MailruOAuth2, self).auth_complete(*args, **kwargs)
        except HTTPError:  # Mail.ru returns HTTPError 400 if cancelled
            raise AuthCanceled(self)

    def user_data(self, access_token, *args, **kwargs):
        """Return user data from Mail.ru REST API"""
        data = {'method': 'users.getInfo', 'session_key': access_token}
        return mailru_api(data)[0]


def mailru_sig(data):
    """ Calculates signature of request data """
    param_list = sorted(list(item + '=' + data[item] for item in data))
    return md5(''.join(param_list) +
               settings.MAILRU_OAUTH2_CLIENT_SECRET).hexdigest()


def mailru_api(data):
    """ Calls Mail.ru REST API method
        http://api.mail.ru/docs/guides/restapi/
    """
    data.update({'app_id': settings.MAILRU_OAUTH2_CLIENT_KEY, 'secure': '1'})
    data['sig'] = mailru_sig(data)

    params = urlencode(data)
    request = Request(MAILRU_API_URL, params)
    try:
        return simplejson.loads(dsa_urlopen(request).read())
    except (TypeError, KeyError, IOError, ValueError, IndexError):
        log('error', 'Could not load data from Mail.ru.',
            exc_info=True, extra=dict(data=params))
        return None


# Backend definition
BACKENDS = {
    'mailru-oauth2': MailruOAuth2
}
