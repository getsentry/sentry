"""
Twitter OAuth support.

This adds support for Twitter OAuth service. An application must
be registered first on twitter and the settings TWITTER_CONSUMER_KEY
and TWITTER_CONSUMER_SECRET must be defined with the corresponding
values.

User screen name is used to generate username.

By default account id is stored in extra_data field, check OAuthBackend
class for details on how to extend it.
"""
try:
    import json as simplejson
except ImportError:
    try:
        import simplejson
    except ImportError:
        from django.utils import simplejson

from social_auth.backends import ConsumerBasedOAuth, OAuthBackend
from social_auth.exceptions import AuthCanceled


# Twitter configuration
TWITTER_SERVER = 'api.twitter.com'
TWITTER_REQUEST_TOKEN_URL = 'https://%s/oauth/request_token' % TWITTER_SERVER
TWITTER_ACCESS_TOKEN_URL = 'https://%s/oauth/access_token' % TWITTER_SERVER
# Note: oauth/authorize forces the user to authorize every time.
#       oauth/authenticate uses their previous selection, barring revocation.
TWITTER_AUTHORIZATION_URL = 'https://%s/oauth/authenticate' % TWITTER_SERVER
TWITTER_CHECK_AUTH = 'https://%s/1.1/account/verify_credentials.json' % \
                                    TWITTER_SERVER


class TwitterBackend(OAuthBackend):
    """Twitter OAuth authentication backend"""
    name = 'twitter'
    EXTRA_DATA = [('id', 'id')]

    def get_user_details(self, response):
        """Return user details from Twitter account"""
        try:
            first_name, last_name = response['name'].split(' ', 1)
        except:
            first_name = response['name']
            last_name = ''
        return {'username': response['screen_name'],
                'email': '',  # not supplied
                'fullname': response['name'],
                'first_name': first_name,
                'last_name': last_name}

    @classmethod
    def tokens(cls, instance):
        """Return the tokens needed to authenticate the access to any API the
        service might provide. Twitter uses a pair of OAuthToken consisting of
        an oauth_token and oauth_token_secret.

        instance must be a UserSocialAuth instance.
        """
        token = super(TwitterBackend, cls).tokens(instance)
        if token and 'access_token' in token:
            token = dict(tok.split('=')
                            for tok in token['access_token'].split('&'))
        return token


class TwitterAuth(ConsumerBasedOAuth):
    """Twitter OAuth authentication mechanism"""
    AUTHORIZATION_URL = TWITTER_AUTHORIZATION_URL
    REQUEST_TOKEN_URL = TWITTER_REQUEST_TOKEN_URL
    ACCESS_TOKEN_URL = TWITTER_ACCESS_TOKEN_URL
    AUTH_BACKEND = TwitterBackend
    SETTINGS_KEY_NAME = 'TWITTER_CONSUMER_KEY'
    SETTINGS_SECRET_NAME = 'TWITTER_CONSUMER_SECRET'

    def user_data(self, access_token, *args, **kwargs):
        """Return user data provided"""
        request = self.oauth_request(access_token, TWITTER_CHECK_AUTH)
        json = self.fetch_response(request)
        try:
            return simplejson.loads(json)
        except ValueError:
            return None

    def auth_complete(self, *args, **kwargs):
        """Completes login process, must return user instance"""
        if 'denied' in self.data:
            raise AuthCanceled(self)
        else:
            return super(TwitterAuth, self).auth_complete(*args, **kwargs)


# Backend definition
BACKENDS = {
    'twitter': TwitterAuth,
}
