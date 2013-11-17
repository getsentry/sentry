"""
Odnoklassniki.ru OAuth2 and IFRAME application support
If you are using OAuth2 authentication,
    * Take a look to:
        http://dev.odnoklassniki.ru/wiki/display/ok/The+OAuth+2.0+Protocol
    * You need to register OAuth application here:
        http://dev.odnoklassniki.ru/wiki/pages/viewpage.action?pageId=13992188
elif you're building iframe application,
    * Take a look to:
        http://dev.odnoklassniki.ru/wiki/display/ok/
                Odnoklassniki.ru+Third+Party+Platform
    * You need to register your iframe application here:
        http://dev.odnoklassniki.ru/wiki/pages/viewpage.action?pageId=5668937
    * You need to sign a public offer and do some bureaucracy if you want to be
      listed in application registry
Then setup your application according manual and use information from
registration mail to set settings values.
"""
from urllib import urlencode, unquote
from urllib2 import Request
from hashlib import md5

try:
    import json as simplejson
except ImportError:
    try:
        import simplejson
    except ImportError:
        from django.utils import simplejson

from django import forms
from django.contrib.auth import authenticate

from social_auth.backends import OAuthBackend, BaseOAuth2, BaseAuth, \
                                 SocialAuthBackend
from social_auth.exceptions import AuthFailed
from social_auth.utils import log, dsa_urlopen, backend_setting


ODNOKLASSNIKI_API_SERVER = 'http://api.odnoklassniki.ru/'


class OdnoklassnikiBackend(OAuthBackend):
    '''Odnoklassniki authentication backend'''
    name = 'odnoklassniki'
    EXTRA_DATA = [('refresh_token', 'refresh_token'),
                  ('expires_in', 'expires')]

    def get_user_id(self, details, response):
        '''Return user unique id provided by Odnoklassniki'''
        return response['uid']

    def get_user_details(self, response):
        '''Return user details from Odnoklassniki request'''
        return {
            'username': response['uid'],
            'email': '',
            'fullname': unquote(response['name']),
            'first_name': unquote(response['first_name']),
            'last_name': unquote(response['last_name'])
        }


class OdnoklassnikiMixin(object):
    def get_settings(self):
        client_key = backend_setting(self, self.SETTINGS_KEY_NAME)
        client_secret = backend_setting(self, self.SETTINGS_SECRET_NAME)
        public_key = backend_setting(self, self.SETTINGS_PUBLIC_NAME)
        return client_key, client_secret, public_key


class OdnoklassnikiOAuth2(BaseOAuth2, OdnoklassnikiMixin):
    '''Odnoklassniki OAuth2 support'''
    AUTH_BACKEND = OdnoklassnikiBackend
    AUTHORIZATION_URL = 'http://www.odnoklassniki.ru/oauth/authorize'
    ACCESS_TOKEN_URL = 'http://api.odnoklassniki.ru/oauth/token.do'
    SETTINGS_KEY_NAME = 'ODNOKLASSNIKI_OAUTH2_CLIENT_KEY'
    SETTINGS_SECRET_NAME = 'ODNOKLASSNIKI_OAUTH2_CLIENT_SECRET'
    SETTINGS_PUBLIC_NAME = 'ODNOKLASSNIKI_OAUTH2_APP_KEY'

    def get_scope(self):
        return backend_setting(self, 'ODNOKLASSNIKI_OAUTH2_EXTRA_SCOPE', [])

    def user_data(self, access_token, *args, **kwargs):
        '''Return user data from Odnoklassniki REST API'''
        data = {'access_token': access_token, 'method': 'users.getCurrentUser'}
        client_key, client_secret, public_key = self.get_settings()
        return odnoklassniki_api(data, ODNOKLASSNIKI_API_SERVER, public_key,
                                 client_secret, 'oauth')


def odnoklassniki_oauth_sig(data, client_secret):
    '''Calculates signature of request data access_token value must be included
    Algorithm is described at
        http://dev.odnoklassniki.ru/wiki/pages/viewpage.action?pageId=12878032,
    search for "little bit different way"
    '''
    suffix = md5('{0:s}{1:s}'.format(data['access_token'],
                                     client_secret)).hexdigest()
    check_list = sorted(['{0:s}={1:s}'.format(key, value)
                            for key, value in data.items()
                                if key != 'access_token'])
    return md5(''.join(check_list) + suffix).hexdigest()


def odnoklassniki_iframe_sig(data, client_secret_or_session_secret):
    '''Calculates signature as described at:
        http://dev.odnoklassniki.ru/wiki/display/ok/
            Authentication+and+Authorization
    If API method requires session context, request is signed with session
    secret key. Otherwise it is signed with application secret key
    '''
    param_list = sorted(['{0:s}={1:s}'.format(key, value)
                            for key, value in data.items()])
    return md5(''.join(param_list) +
               client_secret_or_session_secret).hexdigest()


def odnoklassniki_api(data, api_url, public_key, client_secret,
                      request_type='oauth'):
    ''' Calls Odnoklassniki REST API method
        http://dev.odnoklassniki.ru/wiki/display/ok/Odnoklassniki+Rest+API
    '''
    data.update({
        'application_key': public_key,
        'format': 'JSON'
    })
    if request_type == 'oauth':
        data['sig'] = odnoklassniki_oauth_sig(data, client_secret)
    elif request_type == 'iframe_session':
        data['sig'] = odnoklassniki_iframe_sig(data,
                                               data['session_secret_key'])
    elif request_type == 'iframe_nosession':
        data['sig'] = odnoklassniki_iframe_sig(data, client_secret)
    else:
        msg = 'Unknown request type {0}. How should it be signed?'
        raise AuthFailed(msg.format(request_type))
    params = urlencode(data)
    request = Request('{0}fb.do?{1}'.format(api_url, params))
    try:
        return simplejson.loads(dsa_urlopen(request).read())
    except (TypeError, KeyError, IOError, ValueError, IndexError):
        log('error', 'Could not load data from Odnoklassniki.',
            exc_info=True, extra=dict(data=params))
        return None


class OdnoklassnikiIframeForm(forms.Form):
    logged_user_id = forms.IntegerField()
    api_server = forms.CharField()
    application_key = forms.CharField()
    session_key = forms.CharField()
    session_secret_key = forms.CharField()
    authorized = forms.IntegerField()
    apiconnection = forms.CharField()
    refplace = forms.CharField(required=False)
    referer = forms.CharField(required=False)
    auth_sig = forms.CharField()
    sig = forms.CharField()
    custom_args = forms.CharField(required=False)

    def __init__(self, auth, *args, **kwargs):
        self.auth = auth
        super(OdnoklassnikiIframeForm, self).__init__(*args, **kwargs)

    def get_auth_sig(self):
        secret_key = backend_setting(self.auth, 'ODNOKLASSNIKI_APP_SECRET')
        hash_source = '{0:d}{1:s}{2:s}'.format(
                self.cleaned_data['logged_user_id'],
                self.cleaned_data['session_key'],
                secret_key
        )
        return md5(hash_source).hexdigest()

    def clean_auth_sig(self):
        correct_key = self.get_auth_sig()
        key = self.cleaned_data['auth_sig'].lower()
        if correct_key != key:
            raise forms.ValidationError('Wrong authorization key')
        return self.cleaned_data['auth_sig']

    def get_response(self):
        fields = ('logged_user_id',
                  'api_server',
                  'application_key',
                  'session_key',
                  'session_secret_key',
                  'authorized',
                  'apiconnection',
                  )
        response = {}
        for fieldname in self.fields.keys():
            if fieldname in fields:
                response[fieldname] = self.cleaned_data[fieldname]
        return response


class OdnoklassnikiAppBackend(SocialAuthBackend):
    '''Odnoklassniki iframe app authentication backend'''
    name = 'odnoklassnikiapp'

    def get_user_id(self, details, response):
        '''Return unique user id provided by Odnoklassniki'''
        return response['uid']

    def extra_data(self, user, uid, response, details):
        return dict([(key, value) for key, value in response.items()
                            if key in response['extra_data_list']])

    def get_user_details(self, response):
        return {'username': response['uid'],
                'email': '',
                'fullname': unquote(response['name']),
                'first_name': unquote(response['first_name']),
                'last_name': unquote(response['last_name'])}


class OdnoklassnikiApp(BaseAuth, OdnoklassnikiMixin):
    '''Odnoklassniki iframe app authentication class'''
    SETTINGS_KEY_NAME = 'ODNOKLASSNIKI_APP_KEY'
    SETTINGS_SECRET_NAME = 'ODNOKLASSNIKI_APP_SECRET'
    SETTINGS_PUBLIC_NAME = 'ODNOKLASSNIKI_APP_PUBLIC_KEY'
    AUTH_BACKEND = OdnoklassnikiAppBackend

    def auth_complete(self, request, user, *args, **kwargs):
        form = OdnoklassnikiIframeForm(auth=self, data=request.GET)
        if not form.is_valid():
            raise AuthFailed('Cannot authorize: malformed parameters')
        else:
            response = form.get_response()
            extra_user_data = backend_setting(
                self, 'ODNOKLASSNIKI_APP_EXTRA_USER_DATA_LIST', ())
            base_fields = ('uid', 'first_name', 'last_name', 'name')
            fields = base_fields + extra_user_data
            data = {
                'method': 'users.getInfo',
                'uids': '{0}'.format(response['logged_user_id']),
                'fields': ','.join(fields),
            }
            client_key, client_secret, public_key = self.get_settings()
            details = odnoklassniki_api(data, response['api_server'],
                                        public_key, client_secret,
                                        'iframe_nosession')
            if len(details) == 1 and 'uid' in details[0]:
                details = details[0]
                auth_data_fields = backend_setting(
                    self,
                    'ODNOKLASSNIKI_APP_EXTRA_AUTH_DATA_LIST',
                    ('api_server', 'apiconnection', 'session_key',
                     'session_secret_key', 'authorized')
                )

                for field in auth_data_fields:
                    details[field] = response[field]
                details['extra_data_list'] = fields + auth_data_fields
                kwargs.update({
                    'auth': self,
                    'response': details,
                    self.AUTH_BACKEND.name: True
                })
            else:
                raise AuthFailed('Cannot get user details: API error')
        return authenticate(*args, **kwargs)

    @property
    def uses_redirect(self):
        '''
        Odnoklassniki API for iframe application does not require redirects
        '''
        return False


# Backend definition
BACKENDS = {
    'odnoklassniki': OdnoklassnikiOAuth2,
    'odnoklassnikiapp': OdnoklassnikiApp
}
