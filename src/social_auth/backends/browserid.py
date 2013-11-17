"""
BrowserID support
"""
from urllib import urlencode

try:
    import json as simplejson
except ImportError:
    try:
        import simplejson
    except ImportError:
        from django.utils import simplejson

from django.contrib.auth import authenticate

from social_auth.backends import SocialAuthBackend, BaseAuth
from social_auth.utils import log, dsa_urlopen
from social_auth.exceptions import AuthFailed, AuthMissingParameter


# BrowserID verification server
BROWSER_ID_SERVER = 'https://verifier.login.persona.org/verify'


class BrowserIDBackend(SocialAuthBackend):
    """BrowserID authentication backend"""
    name = 'browserid'

    def get_user_id(self, details, response):
        """Use BrowserID email as ID"""
        return details['email']

    def get_user_details(self, response):
        """Return user details, BrowserID only provides Email."""
        # {'status': 'okay',
        #  'audience': 'localhost:8000',
        #  'expires': 1328983575529,
        #  'email': 'name@server.com',
        #  'issuer': 'login.persona.org'}
        email = response['email']
        return {'username': email.split('@', 1)[0],
                'email': email,
                'fullname': '',
                'first_name': '',
                'last_name': ''}

    def extra_data(self, user, uid, response, details):
        """Return users extra data"""
        return {
            'audience': response['audience'],
            'issuer': response['issuer']
        }


# Auth classes
class BrowserIDAuth(BaseAuth):
    """BrowserID authentication"""
    AUTH_BACKEND = BrowserIDBackend

    def auth_complete(self, *args, **kwargs):
        """Completes loging process, must return user instance"""
        if not 'assertion' in self.data:
            raise AuthMissingParameter(self, 'assertion')

        data = urlencode({
            'assertion': self.data['assertion'],
            'audience': self.request.get_host()
        })

        try:
            response = simplejson.load(dsa_urlopen(BROWSER_ID_SERVER,
                                                   data=data))
        except ValueError:
            log('error', 'Could not load user data from BrowserID.',
                exc_info=True)
        else:
            if response.get('status') == 'failure':
                log('debug', 'Authentication failed.')
                raise AuthFailed(self)

            kwargs.update({
                'auth': self,
                'response': response,
                self.AUTH_BACKEND.name: True
            })
            return authenticate(*args, **kwargs)


# Backend definition
BACKENDS = {
    'browserid': BrowserIDAuth
}
