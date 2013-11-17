from urllib import urlencode

try:
    import json as simplejson
except ImportError:
    try:
        import simplejson
    except ImportError:
        from django.utils import simplejson

from social_auth.backends import BaseOAuth2, OAuthBackend
from social_auth.utils import dsa_urlopen


FOURSQUARE_SERVER = 'foursquare.com'
FOURSQUARE_AUTHORIZATION_URL = 'https://foursquare.com/oauth2/authenticate'
FOURSQUARE_ACCESS_TOKEN_URL = 'https://foursquare.com/oauth2/access_token'
FOURSQUARE_CHECK_AUTH = 'https://api.foursquare.com/v2/users/self'


class FoursquareBackend(OAuthBackend):
    name = 'foursquare'

    def get_user_id(self, details, response):
        return response['response']['user']['id']

    def get_user_details(self, response):
        """Return user details from Foursquare account"""
        firstName = response['response']['user']['firstName']
        lastName = response['response']['user'].get('lastName', '')
        email = response['response']['user']['contact']['email']
        return {'username': firstName + ' ' + lastName,
                'first_name': firstName,
                'last_name': lastName,
                'email': email}


class FoursquareAuth(BaseOAuth2):
    """Foursquare OAuth mechanism"""
    AUTHORIZATION_URL = FOURSQUARE_AUTHORIZATION_URL
    ACCESS_TOKEN_URL = FOURSQUARE_ACCESS_TOKEN_URL
    AUTH_BACKEND = FoursquareBackend
    SETTINGS_KEY_NAME = 'FOURSQUARE_CONSUMER_KEY'
    SETTINGS_SECRET_NAME = 'FOURSQUARE_CONSUMER_SECRET'

    def user_data(self, access_token, *args, **kwargs):
        """Loads user data from service"""
        params = {'oauth_token': access_token}
        url = FOURSQUARE_CHECK_AUTH + '?' + urlencode(params)
        try:
            return simplejson.load(dsa_urlopen(url))
        except ValueError:
            return None


# Backend definition
BACKENDS = {
    'foursquare': FoursquareAuth,
}
