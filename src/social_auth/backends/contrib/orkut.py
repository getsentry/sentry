"""
Orkut OAuth support.

This contribution adds support for Orkut OAuth service. The scope is
limited to http://orkut.gmodules.com/social/ by default, but can be
extended with ORKUT_EXTRA_SCOPE on project settings. Also name, display
name and emails are the default requested user data, but extra values
can be specified by defining ORKUT_EXTRA_DATA setting.

OAuth settings ORKUT_CONSUMER_KEY and ORKUT_CONSUMER_SECRET are needed
to enable this service support.
"""
try:
    import json as simplejson
except ImportError:
    try:
        import simplejson
    except ImportError:
        from django.utils import simplejson

from social_auth.utils import setting, dsa_urlopen
from social_auth.backends import OAuthBackend
from social_auth.backends.google import BaseGoogleOAuth


# Orkut configuration
# default scope, specify extra scope in settings as in:
# ORKUT_EXTRA_SCOPE = ['...']
ORKUT_SCOPE = ['http://orkut.gmodules.com/social/']
ORKUT_REST_ENDPOINT = 'http://www.orkut.com/social/rpc'
ORKUT_DEFAULT_DATA = 'name,displayName,emails'


class OrkutBackend(OAuthBackend):
    """Orkut OAuth authentication backend"""
    name = 'orkut'

    def get_user_details(self, response):
        """Return user details from Orkut account"""
        try:
            emails = response['emails'][0]['value']
        except (KeyError, IndexError):
            emails = ''

        return {'username': response['displayName'],
                'email': emails,
                'fullname': response['displayName'],
                'first_name': response['name']['givenName'],
                'last_name': response['name']['familyName']}


class OrkutAuth(BaseGoogleOAuth):
    """Orkut OAuth authentication mechanism"""
    AUTH_BACKEND = OrkutBackend
    SETTINGS_KEY_NAME = 'ORKUT_CONSUMER_KEY'
    SETTINGS_SECRET_NAME = 'ORKUT_CONSUMER_SECRET'

    def user_data(self, access_token, *args, **kwargs):
        """Loads user data from Orkut service"""
        fields = ORKUT_DEFAULT_DATA
        if setting('ORKUT_EXTRA_DATA'):
            fields += ',' + setting('ORKUT_EXTRA_DATA')
        scope = ORKUT_SCOPE + setting('ORKUT_EXTRA_SCOPE', [])
        params = {'method': 'people.get',
                  'id': 'myself',
                  'userId': '@me',
                  'groupId': '@self',
                  'fields': fields,
                  'scope': ' '.join(scope)}
        request = self.oauth_request(access_token, ORKUT_REST_ENDPOINT, params)
        response = dsa_urlopen(request.to_url()).read()
        try:
            return simplejson.loads(response)['data']
        except (ValueError, KeyError):
            return None

    def oauth_request(self, token, url, extra_params=None):
        extra_params = extra_params or {}
        scope = ORKUT_SCOPE + setting('ORKUT_EXTRA_SCOPE', [])
        extra_params['scope'] = ' '.join(scope)
        return super(OrkutAuth, self).oauth_request(token, url, extra_params)


# Backend definition
BACKENDS = {
    'orkut': OrkutAuth,
}
