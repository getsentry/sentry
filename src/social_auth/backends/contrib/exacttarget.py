"""
ExactTarget OAuth support.
Support Authentication from IMH using JWT token and pre-shared key.
Requires package pyjwt
"""
import imp
from datetime import timedelta, datetime
from django.contrib.auth import authenticate

from social_auth.utils import setting
from social_auth.backends import BaseOAuth2, OAuthBackend
from social_auth.exceptions import AuthFailed, AuthCanceled


class ExactTargetBackend(OAuthBackend):
    """ExactTarget HubExchange authentication backend"""
    name = 'exacttarget'
    # Default extra data to store
    EXTRA_DATA = []

    def get_user_details(self, response):
        """Use the email address of the user, suffixed by _et"""
        if response.get("token"):
            token = response['token']
            user = token.get('request', {}).get('user')
            if user:
                if 'email' in user:
                    user['username'] = "%s_et" % user['email']
                return user

    def extra_data(self, user, uid, response, details):
        """
        Load extra details from the JWT token
        """
        data = {
            'email': details.get('email'),
            'id': details.get('id'),
            # OAuth token, for use with legacy SOAP API calls:
            #   http://bit.ly/13pRHfo
            'internalOauthToken': details.get('internalOauthToken'),
            # Token for use with the Application ClientID for the FUEL API
            'oauthToken': details.get('oauthToken'),
            # If the token has expired, use the FUEL API to get a new token see
            # http://bit.ly/10v1K5l and http://bit.ly/11IbI6F - set legacy=1
            'refreshToken': details.get('refreshToken'),
        }

        # The expiresIn value determines how long the tokens are valid for.
        # Take a bit off, then convert to an int timestamp
        expiresSeconds = details.get('expiresIn', 0) - 30
        expires = datetime.utcnow() + timedelta(seconds=expiresSeconds)
        data['expires'] = (expires - datetime(1970, 1, 1)).total_seconds()

        if response.get("token"):
            token = response['token']
            org = token.get('request', {}).get('organization')
            if org:
                data['stack'] = org.get('stackKey')
                data['enterpriseId'] = org.get('enterpriseId')
        return data

    def get_user_id(self, details, response):
        """Create a user ID from the ET user ID"""
        return "exacttarget_%s" % details.get('id')

    def uses_redirect(self):
        return False


class ExactTargetAuth(BaseOAuth2):
    """ExactTarget authentication mechanism"""
    AUTH_BACKEND = ExactTargetBackend
    SETTINGS_KEY_NAME = 'EXACTTARGET_UNUSED'
    # Set this to your application signature (from code.exacttarget.com)
    SETTINGS_SECRET_NAME = 'EXACTTARGET_APP_SIGNATURE'

    def __init__(self, request, redirect):
        super(ExactTargetAuth, self).__init__(request, redirect)
        fp, pathname, description = imp.find_module('jwt')
        self.jwt = imp.load_module('jwt', fp, pathname, description)

    def auth_url(self):
        return None

    def auth_complete(self, *args, **kwargs):
        """Completes login process, must return user instance"""

        if self.data.get('error'):
            error = self.data.get('error_description') or self.data['error']
            raise AuthFailed(self, error)

        token = kwargs.get('request').POST.get('jwt', {})

        if not token:
            raise AuthFailed(self, 'Authentication Failed')
        return self.do_auth(token, *args, **kwargs)

    def do_auth(self, jwt_token, *args, **kwargs):
        dummy, client_secret = self.get_key_and_secret()

        # Decode the jwt token, using the Application Signature from settings
        try:
            decoded = self.jwt.decode(jwt_token, client_secret)
        except self.jwt.DecodeError:
            raise AuthCanceled(self)  # Wrong signature, fail authentication

        kwargs.update({
            'auth': self,
            'response': {
            'token': decoded,
            },
            self.AUTH_BACKEND.name: True
        })
        return authenticate(*args, **kwargs)

    @classmethod
    def enabled(cls):
        """Return backend enabled status by checking basic settings"""
        return setting('EXACTTARGET_APP_SIGNATURE')

# Backend definition
BACKENDS = {
    'exacttarget': ExactTargetAuth,
}
