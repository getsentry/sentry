"""
Flickr OAuth support.

This contribution adds support for Flickr OAuth service. The settings
FLICKR_APP_ID and FLICKR_API_SECRET must be defined with the values
given by Flickr application registration process.

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


# Flickr configuration
FLICKR_SERVER = 'http://www.flickr.com/services'
FLICKR_REQUEST_TOKEN_URL = '%s/oauth/request_token' % FLICKR_SERVER
FLICKR_AUTHORIZATION_URL = '%s/oauth/authorize' % FLICKR_SERVER
FLICKR_ACCESS_TOKEN_URL = '%s/oauth/access_token' % FLICKR_SERVER


class FlickrBackend(OAuthBackend):
    """Flickr OAuth authentication backend"""
    name = 'flickr'
    # Default extra data to store
    EXTRA_DATA = [
        ('id', 'id'),
        ('username', 'username'),
        ('expires', 'expires')
    ]

    def get_user_details(self, response):
        """Return user details from Flickr account"""
        return {'username': response.get('id'),
                'email': '',
                'first_name': response.get('fullname')}


class FlickrAuth(ConsumerBasedOAuth):
    """Flickr OAuth authentication mechanism"""
    AUTHORIZATION_URL = FLICKR_AUTHORIZATION_URL
    REQUEST_TOKEN_URL = FLICKR_REQUEST_TOKEN_URL
    ACCESS_TOKEN_URL = FLICKR_ACCESS_TOKEN_URL
    AUTH_BACKEND = FlickrBackend
    SETTINGS_KEY_NAME = 'FLICKR_APP_ID'
    SETTINGS_SECRET_NAME = 'FLICKR_API_SECRET'

    def access_token(self, token):
        """Return request for access token value"""
        # Flickr is a bit different - it passes user information along with
        # the access token, so temporarily store it to view the user_data
        # method easy access later in the flow!
        request = self.oauth_request(token, self.ACCESS_TOKEN_URL)
        response = self.fetch_response(request)
        token = Token.from_string(response)
        params = parse_qs(response)

        token.user_nsid = params['user_nsid'][0] if 'user_nsid' in params \
                                                 else None
        token.fullname = params['fullname'][0] if 'fullname' in params \
                                               else None
        token.username = params['username'][0] if 'username' in params \
                                               else None
        return token

    def user_data(self, access_token, *args, **kwargs):
        """Loads user data from service"""
        return {
            'id': access_token.user_nsid,
            'username': access_token.username,
            'fullname': access_token.fullname,
        }

    def auth_extra_arguments(self):
        params = super(FlickrAuth, self).auth_extra_arguments() or {}
        if not 'perms' in params:
            params['perms'] = 'read'
        return params


# Backend definition
BACKENDS = {
    'flickr': FlickrAuth,
}
