"""
This module is originally written: django-social-auth-appsfuel==1.0.0
You could refer to https://github.com/AppsFuel/django-social-auth-appsfuel for issues

settings.py should include the following:

    APPSFUEL_CLIENT_ID = '...'
    APPSFUEL_CLIENT_SECRET = '...'

"""
import json
from urllib import urlencode
from social_auth.backends import BaseOAuth2, OAuthBackend
from social_auth.utils import dsa_urlopen


class AppsfuelBackend(OAuthBackend):
    name = 'appsfuel'

    def get_user_id(self, details, response):
        return response['user_id']

    def get_user_details(self, response):
        """Return user details from Appsfuel account"""
        fullname = response.get('display_name', '')
        email = response.get('email', '')
        username = email.split('@')[0] if email else ''
        return {
            'username': username,
            'first_name': fullname,
            'email': email
        }


class AppsfuelAuth(BaseOAuth2):
    """Appsfuel OAuth mechanism"""
    AUTH_BACKEND = AppsfuelBackend
    AUTHORIZATION_URL = 'http://app.appsfuel.com/content/permission'
    ACCESS_TOKEN_URL = 'https://api.appsfuel.com/v1/live/oauth/token'
    USER_URL = 'https://api.appsfuel.com/v1/live/user'
    SETTINGS_KEY_NAME = 'APPSFUEL_CLIENT_ID'
    SETTINGS_SECRET_NAME = 'APPSFUEL_CLIENT_SECRET'

    def user_data(self, access_token, *args, **kwargs):
        """Loads user data from service"""
        params = {'access_token': access_token}
        url = self.USER_URL + '?' + urlencode(params)
        return json.load(dsa_urlopen(url))


class AppsfuelSandboxBackend(AppsfuelBackend):
    name = 'appsfuel-sandbox'


class AppsfuelSandboxAuth(AppsfuelAuth):
    AUTH_BACKEND = AppsfuelSandboxBackend
    AUTHORIZATION_URL = 'https://api.appsfuel.com/v1/sandbox/choose'
    ACCESS_TOKEN_URL = 'https://api.appsfuel.com/v1/sandbox/oauth/token'
    USER_URL = 'https://api.appsfuel.com/v1/sandbox/user'


# Backend definitions
BACKENDS = {
    'appsfuel': AppsfuelAuth,
    'appsfuel-sandbox': AppsfuelSandboxAuth,
}
