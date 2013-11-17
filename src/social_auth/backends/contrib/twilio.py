"""
Twilio support
"""
from urllib import urlencode
from re import sub

from django.contrib.auth import authenticate
from django.conf import settings

from social_auth.backends import SocialAuthBackend, BaseAuth


TWILIO_SERVER = 'https://www.twilio.com'
TWILIO_AUTHORIZATION_URL = 'https://www.twilio.com/authorize/'


class TwilioBackend(SocialAuthBackend):
    name = 'twilio'

    def get_user_id(self, details, response):
        return response['AccountSid']

    def get_user_details(self, response):
        """Return twilio details, Twilio only provides AccountSID as
        parameters."""
        # /complete/twilio/?AccountSid=ACc65ea16c9ebd4d4684edf814995b27e
        account_sid = response['AccountSid']
        return {'username': account_sid,
                'email': '',
                'fullname': '',
                'first_name': '',
                'last_name': ''}


# Auth classes
class TwilioAuth(BaseAuth):
    """Twilio authentication"""
    AUTH_BACKEND = TwilioBackend
    SETTINGS_KEY_NAME = 'TWILIO_CONNECT_KEY'
    SETTINGS_SECRET_NAME = 'TWILIO_AUTH_TOKEN'

    def auth_url(self):
        """Return authorization redirect url."""
        key = self.connect_api_key()
        callback = self.request.build_absolute_uri(self.redirect)
        callback = sub(r'^https', u'http', callback)
        query = urlencode({'cb': callback})
        return '%s%s?%s' % (TWILIO_AUTHORIZATION_URL, key, query)

    def auth_complete(self, *args, **kwargs):
        """Completes loging process, must return user instance"""
        account_sid = self.data.get('AccountSid')

        if not account_sid:
            raise ValueError('No AccountSid returned')

        kwargs.update({'response': self.data, self.AUTH_BACKEND.name: True})
        return authenticate(*args, **kwargs)

    @classmethod
    def enabled(cls):
        """Enable only if settings are defined."""
        return cls.connect_api_key and cls.secret_key

    @classmethod
    def connect_api_key(cls):
        return getattr(settings, cls.SETTINGS_KEY_NAME, '')

    @classmethod
    def secret_key(cls):
        return getattr(settings, cls.SETTINGS_SECRET_NAME, '')


# Backend definition
BACKENDS = {
    'twilio': TwilioAuth
}
