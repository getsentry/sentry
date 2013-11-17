"""
Behance OAuth2 support.

This contribution adds support for the Behance OAuth service. The settings
BEHANCE_CLIENT_ID and BEHANCE_CLIENT_SECRET must be defined with the values
given by Behance application registration process.

Extended permissions are supported by defining BEHANCE_EXTENDED_PERMISSIONS
setting, it must be a list of values to request.

By default username and access_token are stored in extra_data field.
"""
from social_auth.backends import BaseOAuth2, OAuthBackend


# Behance configuration
BEHANCE_AUTHORIZATION_URL = 'https://www.behance.net/v2/oauth/authenticate'
BEHANCE_ACCESS_TOKEN_URL = 'https://www.behance.net/v2/oauth/token'


class BehanceBackend(OAuthBackend):
    """Behance OAuth authentication backend"""
    name = 'behance'
    # Default extra data to store (in addition to access_token)
    EXTRA_DATA = [
        ('username', 'username'),
    ]

    def get_user_id(self, details, response):
        return response['user']['id']

    def get_user_details(self, response):
        """Return user details from Behance account"""
        user = response['user']
        return {
            'username': user['username'],
            'last_name': user['last_name'],
            'first_name': user['first_name'],
            'fullname': user['display_name'],
            'email': '',
        }

    def extra_data(self, user, uid, response, details):
        # Pull up the embedded user attributes so they can be found as extra
        # data. See the example token response for possible attributes:
        # http://www.behance.net/dev/authentication#step-by-step
        all_data = dict((name, value) for name, value in response.iteritems())
        all_data.update(response['user'])
        return super(BehanceBackend, self).extra_data(user, uid, all_data,
                details)


class BehanceAuth(BaseOAuth2):
    """Behance OAuth2 mechanism"""
    AUTHORIZATION_URL = BEHANCE_AUTHORIZATION_URL
    ACCESS_TOKEN_URL = BEHANCE_ACCESS_TOKEN_URL
    AUTH_BACKEND = BehanceBackend
    SETTINGS_KEY_NAME = 'BEHANCE_CLIENT_ID'
    SETTINGS_SECRET_NAME = 'BEHANCE_CLIENT_SECRET'
    SCOPE_SEPARATOR = '|'
    ### Look at http://www.behance.net/dev/authentication#scopes
    SCOPE_VAR_NAME = 'BEHANCE_EXTENDED_PERMISSIONS'


# Backend definition
BACKENDS = {
    'behance': BehanceAuth
}
