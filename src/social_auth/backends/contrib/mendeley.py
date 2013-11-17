"""
Mendeley OAuth support

No extra configurations are needed to make this work.
"""
from social_auth.backends import ConsumerBasedOAuth, OAuthBackend

try:
    import json as simplejson
except ImportError:
    try:
        import simplejson
    except ImportError:
        from django.utils import simplejson

MENDELEY_SERVER = 'mendeley.com'
MENDELEY_REQUEST_TOKEN_URL = 'http://api.%s/oauth/request_token/' % \
                                    MENDELEY_SERVER
MENDELEY_ACCESS_TOKEN_URL = 'http://api.%s/oauth/access_token/' % \
                                    MENDELEY_SERVER
MENDELEY_AUTHORIZATION_URL = 'http://api.%s/oauth/authorize/' % \
                                    MENDELEY_SERVER
MENDELEY_CHECK_AUTH = 'http://api.%s/oapi/profiles/info/' % MENDELEY_SERVER

MENDELEY_FIELD_SELECTORS = ['profile_id', 'name', 'bio']


class MendeleyBackend(OAuthBackend):
    name = 'mendeley'
    EXTRA_DATA = [('profile_id', 'profile_id'),
                  ('name', 'name'),
                  ('bio', 'bio')]

    def get_user_id(self, details, response):
        return response['main']['profile_id']

    def get_user_details(self, response):
        """Return user details from Mendeley account"""
        profile_id = response['main']['profile_id']
        name = response['main']['name']
        bio = response['main']['bio']
        return {'profile_id': profile_id,
                'name': name,
                'bio': bio}


class MendeleyAuth(ConsumerBasedOAuth):
    """Mendeley OAuth authentication mechanism"""
    AUTHORIZATION_URL = MENDELEY_AUTHORIZATION_URL
    REQUEST_TOKEN_URL = MENDELEY_REQUEST_TOKEN_URL
    ACCESS_TOKEN_URL = MENDELEY_ACCESS_TOKEN_URL
    AUTH_BACKEND = MendeleyBackend
    SETTINGS_KEY_NAME = 'MENDELEY_CONSUMER_KEY'
    SETTINGS_SECRET_NAME = 'MENDELEY_CONSUMER_SECRET'
    SCOPE_VAR_NAME = 'MENDELEY_SCOPE'
    SCOPE_SEPARATOR = '+'

    def user_data(self, access_token, *args, **kwargs):
        """Return user data provided"""
        url = MENDELEY_CHECK_AUTH + 'me/'
        request = self.oauth_request(access_token, url)
        data = simplejson.loads(self.fetch_response(request))
        data.update(data['main'])
        return data

BACKENDS = {
    'mendeley': MendeleyAuth,
}
