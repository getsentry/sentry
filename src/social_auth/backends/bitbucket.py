"""
Bitbucket OAuth support.

This adds support for Bitbucket OAuth service. An application must
be registered first on Bitbucket and the settings BITBUCKET_CONSUMER_KEY
and BITBUCKET_CONSUMER_SECRET must be defined with the corresponding
values.

By default username, email, token expiration time, first name and last name are
stored in extra_data field, check OAuthBackend class for details on how to
extend it.
"""
from __future__ import absolute_import

try:
    import json as simplejson
except ImportError:
    try:
        import simplejson
    except ImportError:
        from django.utils import simplejson
from social_auth.backends import ConsumerBasedOAuth, OAuthBackend
from social_auth.utils import dsa_urlopen

# Bitbucket configuration
BITBUCKET_SERVER = 'bitbucket.org/api/1.0'
BITBUCKET_REQUEST_TOKEN_URL = 'https://%s/oauth/request_token' % BITBUCKET_SERVER
BITBUCKET_ACCESS_TOKEN_URL = 'https://%s/oauth/access_token' % BITBUCKET_SERVER
BITBUCKET_AUTHORIZATION_URL = 'https://%s/oauth/authenticate' % BITBUCKET_SERVER
BITBUCKET_EMAIL_DATA_URL = 'https://%s/emails/' % BITBUCKET_SERVER
BITBUCKET_USER_DATA_URL = 'https://%s/users/' % BITBUCKET_SERVER


class BitbucketBackend(OAuthBackend):
    """Bitbucket OAuth authentication backend"""
    name = 'bitbucket'
    EXTRA_DATA = [
        ('username', 'username'),
        ('expires', 'expires'),
        ('email', 'email'),
        ('first_name', 'first_name'),
        ('last_name', 'last_name')
    ]

    def get_user_details(self, response):
        """Return user details from Bitbucket account"""
        return {'username': response.get('username'),
                'email': response.get('email'),
                'fullname': ' '.join((response.get('first_name'),
                                      response.get('last_name'))),
                'first_name': response.get('first_name'),
                'last_name': response.get('last_name')}

    def get_user_id(self, details, response):
        """Return the user id, Bitbucket only provides username as a unique
        identifier"""
        return response['username']

    @classmethod
    def tokens(cls, instance):
        """Return the tokens needed to authenticate the access to any API the
        service might provide. Bitbucket uses a pair of OAuthToken consisting
        on a oauth_token and oauth_token_secret.

        instance must be a UserSocialAuth instance.
        """
        token = super(BitbucketBackend, cls).tokens(instance)
        if token and 'access_token' in token:
            token = dict(
                tok.split('=')
                for tok in token['access_token'].split('&')
            )
        return token


class BitbucketAuth(ConsumerBasedOAuth):
    """Bitbucket OAuth authentication mechanism"""
    AUTHORIZATION_URL = BITBUCKET_AUTHORIZATION_URL
    REQUEST_TOKEN_URL = BITBUCKET_REQUEST_TOKEN_URL
    ACCESS_TOKEN_URL = BITBUCKET_ACCESS_TOKEN_URL
    AUTH_BACKEND = BitbucketBackend
    SETTINGS_KEY_NAME = 'BITBUCKET_CONSUMER_KEY'
    SETTINGS_SECRET_NAME = 'BITBUCKET_CONSUMER_SECRET'

    def user_data(self, access_token):
        """Return user data provided"""
        # Bitbucket has a bit of an indirect route to obtain user data from an
        # authenticated query: First obtain the user's email via an
        # authenticated GET
        url = BITBUCKET_EMAIL_DATA_URL
        request = self.oauth_request(access_token, url)
        response = self.fetch_response(request)
        try:
            # Then retrieve the user's primary email address or the top email
            email_addresses = simplejson.loads(response)
            for email_address in reversed(email_addresses):
                if email_address['active']:
                    email = email_address['email']
                    if email_address['primary']:
                        break
            # Then return the user data using a normal GET with the
            # BITBUCKET_USER_DATA_URL and the user's email
            response = dsa_urlopen(BITBUCKET_USER_DATA_URL + email)
            user_details = simplejson.load(response)['user']
            user_details['email'] = email
            return user_details
        except ValueError:
            return None
        return None


# Backend definition
BACKENDS = {
    'bitbucket': BitbucketAuth,
}
