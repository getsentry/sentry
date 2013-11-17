# -*- coding: utf-8 -*-
"""
vk.com OpenAPI and OAuth 2.0 support.

This contribution adds support for VK.com OpenAPI, OAuth 2.0 and IFrame apps.
Username is retrieved from the identity returned by server.
"""
try:
    import json as simplejson
except ImportError:
    try:
        import simplejson
    except ImportError:
        from django.utils import simplejson

from django.contrib.auth import authenticate

from urllib import urlencode
from hashlib import md5
from time import time

from social_auth.backends import SocialAuthBackend, OAuthBackend, BaseAuth, \
                                 BaseOAuth2
from social_auth.exceptions import AuthTokenRevoked, AuthException, \
                                   AuthCanceled, AuthFailed
from social_auth.utils import setting, log, dsa_urlopen


# vk configuration
VK_AUTHORIZATION_URL = 'http://oauth.vk.com/authorize'
VK_ACCESS_TOKEN_URL = 'https://oauth.vk.com/access_token'
VK_SERVER = 'vk.com'
VK_DEFAULT_DATA = ['first_name', 'last_name', 'screen_name',
                   'nickname', 'photo']

VK_API_URL = 'https://api.vk.com/method/'
VK_SERVER_API_URL = 'http://api.vk.com/api.php'
VK_API_VERSION = '3.0'

LOCAL_HTML = setting('VK_LOCAL_HTML', setting('VKONTAKTE_LOCAL_HTML',
                                              'vkontakte.html'))

USE_APP_AUTH = setting('VKAPP_APP_ID', False)


class VKOpenAPIBackend(SocialAuthBackend):
    """VK OpenAPI authentication backend"""
    name = 'vk-openapi'

    def get_user_id(self, details, response):
        """Return user unique id provided by VK"""
        return response['id']

    def get_user_details(self, response):
        """Return user details from VK request"""
        nickname = response.get('nickname') or response['id']
        if isinstance(nickname, (list, tuple, )):
            nickname = nickname[0]
        return {
            'username': nickname,
            'email': '',
            'fullname': '',
            'first_name': response.get('first_name')[0]
                                if 'first_name' in response else '',
            'last_name': response.get('last_name')[0]
                                if 'last_name' in response else ''
        }


class VKOpenAPIAuth(BaseAuth):
    """VKontakte OpenAPI authorization mechanism"""
    AUTH_BACKEND = VKOpenAPIBackend
    APP_ID = setting('VKONTAKTE_APP_ID')

    def user_data(self, access_token, *args, **kwargs):
        return dict(self.request.GET)

    def auth_html(self):
        """Returns local VK authentication page, not necessary for
        VK to authenticate.
        """
        from django.template import RequestContext, loader

        dict = {'VK_APP_ID': self.APP_ID,
                'VK_COMPLETE_URL': self.redirect}

        vk_template = loader.get_template(LOCAL_HTML)
        context = RequestContext(self.request, dict)

        return vk_template.render(context)

    def auth_complete(self, *args, **kwargs):
        """Performs check of authentication in VK, returns User if
        succeeded"""
        app_cookie = 'vk_app_' + self.APP_ID

        if not 'id' in self.request.GET or \
           not app_cookie in self.request.COOKIES:
            raise AuthCanceled(self)

        cookie_dict = dict(item.split('=') for item in
                                self.request.COOKIES[app_cookie].split('&'))
        check_str = ''.join(item + '=' + cookie_dict[item]
                                for item in ['expire', 'mid', 'secret', 'sid'])

        hash = md5(check_str + setting('VK_API_SECRET')).hexdigest()

        if hash != cookie_dict['sig'] or int(cookie_dict['expire']) < time():
            raise AuthFailed('VK authentication failed: invalid hash')
        else:
            kwargs.update({
                'auth': self,
                'response': self.user_data(cookie_dict['mid']),
                self.AUTH_BACKEND.name: True
            })
            return authenticate(*args, **kwargs)

    @property
    def uses_redirect(self):
        """VK does not require visiting server url in order
        to do authentication, so auth_xxx methods are not needed to be called.
        Their current implementation is just an example"""
        return False


class VKOAuth2Backend(OAuthBackend):
    """VKOAuth2 authentication backend"""
    name = 'vk-oauth'

    EXTRA_DATA = [
        ('id', 'id'),
        ('expires', 'expires')
    ]

    def get_user_id(self, details, response):
        """OAuth providers return an unique user id in response"""
        return response['user_id']

    def get_user_details(self, response):
        """Return user details from VK account"""
        return {
            'username': response.get('screen_name'),
            'email': '',
            'first_name': response.get('first_name'),
            'last_name': response.get('last_name')
        }


class VKApplicationBackend(VKOAuth2Backend):
    name = 'vk-app'


class VKOAuth2(BaseOAuth2):
    """VK OAuth mechanism"""
    AUTHORIZATION_URL = VK_AUTHORIZATION_URL
    ACCESS_TOKEN_URL = VK_ACCESS_TOKEN_URL
    AUTH_BACKEND = VKOAuth2Backend
    SETTINGS_KEY_NAME = 'VK_APP_ID'
    SETTINGS_SECRET_NAME = 'VK_API_SECRET'
    # Look at:
    # http://vk.com/developers.php?oid=-17680044&p=Application_Access_Rights
    SCOPE_VAR_NAME = 'VK_EXTRA_SCOPE'

    def get_scope(self):
        return setting(VKOAuth2.SCOPE_VAR_NAME) or \
               setting('VK_OAUTH2_EXTRA_SCOPE')

    def user_data(self, access_token, response, *args, **kwargs):
        """Loads user data from service"""
        fields = ','.join(VK_DEFAULT_DATA + setting('VK_EXTRA_DATA', []))
        params = {'access_token': access_token,
                  'fields': fields,
                  'uids': response.get('user_id')}

        data = vk_api('users.get', params)

        if data.get('error'):
            error = data['error']
            msg = error.get('error_msg', 'Unknown error')
            if error.get('error_code') == 5:
                raise AuthTokenRevoked(self, msg)
            else:
                raise AuthException(self, msg)

        if data:
            data = data.get('response')[0]
            data['user_photo'] = data.get('photo')  # Backward compatibility

        return data


class VKAppAuth(VKOAuth2):
    """VKontakte Application Authentication support"""
    AUTH_BACKEND = VKApplicationBackend
    SETTINGS_KEY_NAME = 'VKAPP_APP_ID'
    SETTINGS_SECRET_NAME = 'VKAPP_API_SECRET'

    def auth_complete(self, *args, **kwargs):
        stop, app_auth = self.application_auth(*args, **kwargs)

        if app_auth:
            return app_auth

        if stop:
            return None

        return super(VKAppAuth, self).auth_complete(*args, **kwargs)

    def user_profile(self, user_id, access_token=None):
        data = {'uids': user_id, 'fields': 'photo'}

        if access_token:
            data['access_token'] = access_token

        profiles = vk_api('getProfiles', data, is_app=True).get('response',
                                                                None)
        return profiles[0] if profiles else None

    def is_app_user(self, user_id, access_token=None):
        """Returns app usage flag from VK API"""

        data = {'uid': user_id}

        if access_token:
            data['access_token'] = access_token

        return vk_api('isAppUser', data, is_app=True).get('response', 0)

    def application_auth(self, *args, **kwargs):
        required_params = ('is_app_user', 'viewer_id', 'access_token',
                           'api_id')

        for param in required_params:
            if not param in self.request.REQUEST:
                return (False, None)

        auth_key = self.request.REQUEST.get('auth_key')

        # Verify signature, if present
        if auth_key:
            check_key = md5('_'.join([
                setting(self.SETTINGS_KEY_NAME),
                self.request.REQUEST.get('viewer_id'),
                setting(self.SETTINGS_SECRET_NAME)
            ])).hexdigest()

            if check_key != auth_key:
                raise ValueError('VK authentication failed: invalid '
                                 'auth key')

        user_check = setting('VKAPP_USER_MODE', 0)
        user_id = self.request.REQUEST.get('viewer_id')

        if user_check:
            is_user = self.request.REQUEST.get('is_app_user') \
                        if user_check == 1 else self.is_app_user(user_id)

            if not int(is_user):
                return (True, None)

        data = self.user_profile(user_id)
        data['user_id'] = user_id

        return (True, authenticate(*args, **{'auth': self,
            'request': self.request,
            'response': data, self.AUTH_BACKEND.name: True
        }))


def vk_api(method, data, is_app=False):
    """Calls VK OpenAPI method
        https://vk.com/apiclub,
        https://vk.com/pages.php?o=-1&p=%C2%FB%EF%EE%EB%ED%E5%ED%E8%E5%20%E7'
                                        %E0%EF%F0%EE%F1%EE%E2%20%EA%20API
    """

    # We need to perform server-side call if no access_token
    if not 'access_token' in data:
        if not 'v' in data:
            data['v'] = VK_API_VERSION

        if not 'api_id' in data:
            data['api_id'] = setting('VKAPP_APP_ID' if is_app else 'VK_APP_ID')

        data['method'] = method
        data['format'] = 'json'

        url = VK_SERVER_API_URL
        secret = setting('VKAPP_API_SECRET' if is_app else 'VK_API_SECRET')

        param_list = sorted(list(item + '=' + data[item] for item in data))
        data['sig'] = md5(''.join(param_list) + secret).hexdigest()
    else:
        url = VK_API_URL + method

    params = urlencode(data)
    url += '?' + params
    try:
        return simplejson.load(dsa_urlopen(url))
    except (TypeError, KeyError, IOError, ValueError, IndexError):
        log('error', 'Could not load data from vk.com',
            exc_info=True, extra=dict(data=data))
        return None


# Backend definition
BACKENDS = {
    'vk-openapi': VKOpenAPIAuth,
    'vk-oauth': VKOAuth2 if not USE_APP_AUTH else VKAppAuth,
}
