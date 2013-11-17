"""
EverNote OAuth support

No extra configurations are needed to make this work.
"""
from urllib2 import HTTPError
try:
    from urlparse import parse_qs
    parse_qs  # placate pyflakes
except ImportError:
    # fall back for Python 2.5
    from cgi import parse_qs

from oauth2 import Token
from social_auth.utils import setting
from social_auth.backends import ConsumerBasedOAuth, OAuthBackend
from social_auth.exceptions import AuthCanceled


if setting('EVERNOTE_DEBUG', False):
    EVERNOTE_SERVER = 'sandbox.evernote.com'
else:
    EVERNOTE_SERVER = 'www.evernote.com'

EVERNOTE_REQUEST_TOKEN_URL = 'https://%s/oauth' % EVERNOTE_SERVER
EVERNOTE_ACCESS_TOKEN_URL = 'https://%s/oauth' % EVERNOTE_SERVER
EVERNOTE_AUTHORIZATION_URL = 'https://%s/OAuth.action' % EVERNOTE_SERVER


class EvernoteBackend(OAuthBackend):
    """
    Evernote OAuth authentication backend.

    Possible Values:
       {'edam_expires': ['1367525289541'],
        'edam_noteStoreUrl': [
            'https://sandbox.evernote.com/shard/s1/notestore'
        ],
        'edam_shard': ['s1'],
        'edam_userId': ['123841'],
        'edam_webApiUrlPrefix': ['https://sandbox.evernote.com/shard/s1/'],
        'oauth_token': [
            'S=s1:U=1e3c1:E=13e66dbee45:C=1370f2ac245:P=185:A=my_user:' \
            'H=411443c5e8b20f8718ed382a19d4ae38'
        ]}
    """
    name = 'evernote'

    EXTRA_DATA = [
        ('access_token', 'access_token'),
        ('oauth_token', 'oauth_token'),
        ('edam_noteStoreUrl', 'store_url'),
        ('edam_expires', 'expires')
    ]

    @classmethod
    def extra_data(cls, user, uid, response, details=None):
        data = super(EvernoteBackend, cls).extra_data(user, uid, response, details)
        # Evernote returns expiration timestamp in miliseconds, so it needs to
        # be normalized.
        if 'expires' in data:
            data['expires'] = unicode(int(data['expires']) / 1000)
        return data

    def get_user_details(self, response):
        """Return user details from Evernote account"""
        return {
            'username': response['edam_userId'],
            'email': '',
        }

    def get_user_id(self, details, response):
        return response['edam_userId']


class EvernoteAuth(ConsumerBasedOAuth):
    """Evernote OAuth authentication mechanism"""
    AUTHORIZATION_URL = EVERNOTE_AUTHORIZATION_URL
    REQUEST_TOKEN_URL = EVERNOTE_REQUEST_TOKEN_URL
    ACCESS_TOKEN_URL = EVERNOTE_ACCESS_TOKEN_URL
    AUTH_BACKEND = EvernoteBackend
    SETTINGS_KEY_NAME = 'EVERNOTE_CONSUMER_KEY'
    SETTINGS_SECRET_NAME = 'EVERNOTE_CONSUMER_SECRET'

    def access_token(self, token):
        """Return request for access token value"""
        request = self.oauth_request(token, self.ACCESS_TOKEN_URL)

        try:
            response = self.fetch_response(request)
        except HTTPError, e:
            # Evernote returns a 401 error when AuthCanceled
            if e.code == 401:
                raise AuthCanceled(self)
            else:
                raise

        params = parse_qs(response)

        # evernote sents a empty secret token, this way it doesn't fires up the
        # exception
        response = response.replace('oauth_token_secret=',
                                    'oauth_token_secret=None')
        token = Token.from_string(response)

        token.user_info = params
        return token

    def user_data(self, access_token, *args, **kwargs):
        """Return user data provided"""
        # drop lists
        return dict([(key, val[0]) for key, val in
            access_token.user_info.items()])


# Backend definition
BACKENDS = {
    'evernote': EvernoteAuth,
}
