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

STOCKTWITS_SERVER = 'api.stocktwits.com'
STOCKTWITS_AUTHORIZATION_URL = 'https://%s/api/2/oauth/authorize' % \
                                            STOCKTWITS_SERVER
STOCKTWITS_ACCESS_TOKEN_URL = 'https://%s/api/2/oauth/token' % \
                                            STOCKTWITS_SERVER
STOCKTWITS_CHECK_AUTH = 'https://%s/api/2/account/verify.json' % \
                                            STOCKTWITS_SERVER


class StocktwitsBackend(OAuthBackend):
    name = 'stocktwits'

    def get_user_id(self, details, response):
        return response['user']['id']

    def get_user_details(self, response):
        """Return user details from Stocktwits account"""
        try:
            first_name, last_name = response['user']['name'].split(' ', 1)
        except:
            first_name = response['user']['name']
            last_name = ''
        return {'username': response['user']['username'],
                'email': '',  # not supplied
                'fullname': response['user']['name'],
                'first_name': first_name,
                'last_name': last_name}


class StocktwitsAuth(BaseOAuth2):
    """Stocktwits OAuth mechanism"""
    AUTHORIZATION_URL = STOCKTWITS_AUTHORIZATION_URL
    ACCESS_TOKEN_URL = STOCKTWITS_ACCESS_TOKEN_URL
    SERVER_URL = STOCKTWITS_SERVER
    AUTH_BACKEND = StocktwitsBackend
    SETTINGS_KEY_NAME = 'STOCKTWITS_CONSUMER_KEY'
    SETTINGS_SECRET_NAME = 'STOCKTWITS_CONSUMER_SECRET'
    SCOPE_SEPARATOR = ','
    DEFAULT_SCOPE = ['read', 'publish_messages', 'publish_watch_lists',
                     'follow_users', 'follow_stocks']

    def user_data(self, access_token, *args, **kwargs):
        """Loads user data from service"""
        params = {'access_token': access_token}
        url = STOCKTWITS_CHECK_AUTH + '?' + urlencode(params)
        try:
            return simplejson.load(dsa_urlopen(url))
        except ValueError:
            return None


# Backend definition
BACKENDS = {
    'stocktwits': StocktwitsAuth,
}
