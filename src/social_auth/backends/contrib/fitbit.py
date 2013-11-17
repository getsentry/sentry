"""
Fitbit OAuth support.

This contribution adds support for Fitbit OAuth service. The settings
FITBIT_CONSUMER_KEY and FITBIT_CONSUMER_SECRET must be defined with the values
given by Fitbit application registration process.

By default account id, username and token expiration time are stored in
extra_data field, check OAuthBackend class for details on how to extend it.
"""
try:
    from urlparse import parse_qs
    parse_qs  # placate pyflakes
except ImportError:
    # fall back for Python 2.5
    from cgi import parse_qs

from oauth2 import Token

from social_auth.backends import ConsumerBasedOAuth, OAuthBackend


# Fitbit configuration
FITBIT_SERVER = 'https://api.fitbit.com'
FITBIT_REQUEST_TOKEN_URL = '%s/oauth/request_token' % FITBIT_SERVER
FITBIT_AUTHORIZATION_URL = '%s/oauth/authorize' % FITBIT_SERVER
FITBIT_ACCESS_TOKEN_URL = '%s/oauth/access_token' % FITBIT_SERVER
FITBIT_USERINFO = 'http://api.fitbit.com/1/user/-/profile.json'


class FitbitBackend(OAuthBackend):
    """Fitbit OAuth authentication backend"""
    name = 'fitbit'
    # Default extra data to store
    EXTRA_DATA = [('id', 'id'),
                  ('username', 'username'),
                  ('expires', 'expires')]

    def get_user_id(self, details, response):
        """
        Fitbit doesn't provide user data, it must be requested to its API:
            https://wiki.fitbit.com/display/API/API-Get-User-Info
        """
        return response['id']

    def get_user_details(self, response):
        """Return user details from Fitbit account"""
        return {'username': response.get('id'),
                'email': '',
                'first_name': response.get('fullname')}


class FitbitAuth(ConsumerBasedOAuth):
    """Fitbit OAuth authentication mechanism"""
    AUTHORIZATION_URL = FITBIT_AUTHORIZATION_URL
    REQUEST_TOKEN_URL = FITBIT_REQUEST_TOKEN_URL
    ACCESS_TOKEN_URL = FITBIT_ACCESS_TOKEN_URL
    AUTH_BACKEND = FitbitBackend
    SETTINGS_KEY_NAME = 'FITBIT_CONSUMER_KEY'
    SETTINGS_SECRET_NAME = 'FITBIT_CONSUMER_SECRET'

    def access_token(self, token):
        """Return request for access token value"""
        # Fitbit is a bit different - it passes user information along with
        # the access token, so temporarily store it to vie the user_data
        # method easy access later in the flow!
        request = self.oauth_request(token, self.ACCESS_TOKEN_URL)
        response = self.fetch_response(request)
        token = Token.from_string(response)
        params = parse_qs(response)

        token.encoded_user_id = params.get('encoded_user_id', [None])[0]
        token.fullname = params.get('fullname', [None])[0]
        token.username = params.get('username', [None])[0]
        return token

    def user_data(self, access_token, *args, **kwargs):
        """Loads user data from service"""
        return {
            'id': access_token.encoded_user_id,
            'username': access_token.username,
            'fullname': access_token.fullname,
        }


# Backend definition
BACKENDS = {
    'fitbit': FitbitAuth,
}
