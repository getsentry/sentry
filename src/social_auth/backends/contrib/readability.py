"""
Readability OAuth support.

This contribution adds support for Readability OAuth service. The settings
READABILITY_CONSUMER_KEY and READABILITY_CONSUMER_SECRET must be defined with
the values given by Readability in the Connections page of your account
settings."""

try:
    import json as simplejson
except ImportError:
    try:
        import simplejson
    except ImportError:
        from django.utils import simplejson

from social_auth.backends import ConsumerBasedOAuth, OAuthBackend
from social_auth.exceptions import AuthCanceled
from social_auth.utils import setting

# Readability configuration
READABILITY_SERVER = 'www.readability.com'
READABILITY_API = 'https://%s/api/rest/v1' % READABILITY_SERVER
READABILITY_AUTHORIZATION_URL = '%s/oauth/authorize/' % READABILITY_API
READABILITY_ACCESS_TOKEN_URL = '%s/oauth/access_token/' % READABILITY_API
READABILITY_REQUEST_TOKEN_URL = '%s/oauth/request_token/' % READABILITY_API
READABILITY_USER_DATA_URL = '%s/users/_current' % READABILITY_API


class ReadabilityBackend(OAuthBackend):
    """Readability OAuth authentication backend"""
    name = 'readability'

    EXTRA_DATA = [('date_joined', 'date_joined'),
                  ('kindle_email_address', 'kindle_email_address'),
                  ('avatar_url', 'avatar_url'),
                  ('email_into_address', 'email_into_address')]

    def get_user_details(self, response):
        username = response['username']
        first_name, last_name = response['first_name'], response['last_name']
        return {'username': username,
                'first_name': first_name,
                'last_name': last_name}

    def get_user_id(self, details, response):
        """Returns a unique username to use"""
        return response['username']

    @classmethod
    def tokens(cls, instance):
        """Return the tokens needed to authenticate the access to any API the
        service might provide. Readability uses a pair of OAuthToken consisting
        of an oauth_token and oauth_token_secret.

        instance must be a UserSocialAuth instance.
        """
        token = super(ReadabilityBackend, cls).tokens(instance)
        if token and 'access_token' in token:
            # Split the OAuth query string and only return the values needed
            token = dict(
                filter(
                    lambda x: x[0] in ['oauth_token', 'oauth_token_secret'],
                    map(
                        lambda x: x.split('='),
                        token['access_token'].split('&'))))

        return token


class ReadabilityAuth(ConsumerBasedOAuth):
    """Readability OAuth authentication mechanism"""
    AUTHORIZATION_URL = READABILITY_AUTHORIZATION_URL
    REQUEST_TOKEN_URL = READABILITY_REQUEST_TOKEN_URL
    ACCESS_TOKEN_URL = READABILITY_ACCESS_TOKEN_URL
    SERVER_URL = READABILITY_SERVER
    AUTH_BACKEND = ReadabilityBackend
    SETTINGS_KEY_NAME = 'READABILITY_CONSUMER_KEY'
    SETTINGS_SECRET_NAME = 'READABILITY_CONSUMER_SECRET'

    def user_data(self, access_token, *args, **kwargs):
        url = READABILITY_USER_DATA_URL
        request = self.oauth_request(access_token, url)
        json = self.fetch_response(request)
        try:
            return simplejson.loads(json)
        except ValueError:
            return None

    def auth_complete(self, *args, **kwargs):
        """Completes login process, must return user instance"""
        if 'error' in self.data:
            raise AuthCanceled(self)
        else:
            return super(ReadabilityAuth, self).auth_complete(*args, **kwargs)

    @classmethod
    def enabled(cls):
        """Return backend enabled status by checking basic settings"""

        return setting('READABILITY_CONSUMER_KEY') \
            and setting('READABILITY_CONSUMER_SECRET')

BACKENDS = {
    'readability': ReadabilityAuth,
}
