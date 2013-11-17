"""
OAuth 1.0 Yahoo backend

Options:
YAHOO_CONSUMER_KEY
YAHOO_CONSUMER_SECRET

References:
* http://developer.yahoo.com/oauth/guide/oauth-auth-flow.html
* http://developer.yahoo.com/social/rest_api_guide/
*           introspective-guid-resource.html
* http://developer.yahoo.com/social/rest_api_guide/
*           extended-profile-resource.html

Scopes:
To make this extension works correctly you have to have at least
Yahoo Profile scope with Read permission

Throws:
AuthUnknownError - if user data retrieval fails (guid or profile)
"""

try:
    import json as simplejson
except ImportError:
    try:
        import simplejson
    except ImportError:
        from django.utils import simplejson

from social_auth.backends import ConsumerBasedOAuth, OAuthBackend
from social_auth.exceptions import AuthUnknownError


# Google OAuth base configuration
YAHOO_OAUTH_SERVER = 'api.login.yahoo.com'
REQUEST_TOKEN_URL = 'https://api.login.yahoo.com/oauth/v2/get_request_token'
AUTHORIZATION_URL = 'https://api.login.yahoo.com/oauth/v2/request_auth'
ACCESS_TOKEN_URL = 'https://api.login.yahoo.com/oauth/v2/get_token'


class YahooOAuthBackend(OAuthBackend):
    """Yahoo OAuth authentication backend"""
    name = 'yahoo-oauth'

    EXTRA_DATA = [
        ('guid', 'id'),
        ('access_token', 'access_token'),
        ('expires', 'expires')
    ]

    def get_user_id(self, details, response):
        return response['guid']

    def get_user_details(self, response):
        """Return user details from Yahoo Profile"""
        fname = response.get('givenName')
        lname = response.get('familyName')
        if 'emails' in response:
            email = response.get('emails')[0]['handle']
        else:
            email = ''
        return {'username': response.get('nickname'),
                'email': email,
                'fullname': '%s %s' % (fname, lname),
                'first_name': fname,
                'last_name': lname}


class YahooOAuth(ConsumerBasedOAuth):
    AUTHORIZATION_URL = AUTHORIZATION_URL
    REQUEST_TOKEN_URL = REQUEST_TOKEN_URL
    ACCESS_TOKEN_URL = ACCESS_TOKEN_URL
    AUTH_BACKEND = YahooOAuthBackend
    SETTINGS_KEY_NAME = 'YAHOO_CONSUMER_KEY'
    SETTINGS_SECRET_NAME = 'YAHOO_CONSUMER_SECRET'

    def user_data(self, access_token, *args, **kwargs):
        """Loads user data from service"""
        guid = self._get_guid(access_token)
        url = 'http://social.yahooapis.com/v1/user/%s/profile?format=json' \
                    % guid
        request = self.oauth_request(access_token, url)
        response = self.fetch_response(request)
        try:
            return simplejson.loads(response)['profile']
        except ValueError:
            raise AuthUnknownError('Error during profile retrieval, '
                                   'please, try again later')

    def _get_guid(self, access_token):
        """
            Beause you have to provide GUID for every API request
            it's also returned during one of OAuth calls
        """
        url = 'http://social.yahooapis.com/v1/me/guid?format=json'
        request = self.oauth_request(access_token, url)
        response = self.fetch_response(request)
        try:
            json = simplejson.loads(response)
            return json['guid']['value']
        except ValueError:
            raise AuthUnknownError('Error during user id retrieval, '
                                   'please, try again later')


# Backend definition
BACKENDS = {
    'yahoo-oauth': YahooOAuth
}
