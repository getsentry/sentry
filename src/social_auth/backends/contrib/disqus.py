try:
    import json as simplejson
except ImportError:
    try:
        import simplejson
    except ImportError:
        from django.utils import simplejson

from social_auth.backends import BaseOAuth2, OAuthBackend
from social_auth.utils import dsa_urlopen, backend_setting
from urllib import urlencode


DISQUS_SERVER = 'disqus.com'
DISQUS_AUTHORIZATION_URL = 'https://disqus.com/api/oauth/2.0/authorize/'
DISQUS_ACCESS_TOKEN_URL = 'https://disqus.com/api/oauth/2.0/access_token/'
DISQUS_CHECK_AUTH = 'https://disqus.com/api/3.0/users/details.json'


class DisqusBackend(OAuthBackend):
    name = 'disqus'

    EXTRA_DATA = [
        ('avatar', 'avatar'),
        ('connections', 'connections'),
        ('user_id', 'user_id'),
        ('email', 'email'),
        ('email_hash', 'emailHash'),
        ('expires', 'expires'),
        ('location', 'location'),
        ('meta', 'response'),
        ('name', 'name'),
        ('username', 'username'),
    ]

    def get_user_id(self, details, response):
        return response['response']['id']

    def get_user_details(self, response):
        """Return user details from Disqus account"""
        rr = response.get('response', {})

        return {
            'username': rr.get('username', ''),
            'user_id': response.get('user_id', ''),
            'email': rr.get('email', ''),
            'name': rr.get('name', ''),
        }

    def extra_data(self, user, uid, response, details):
        meta_response = dict(response, **response.get('response', {}))
        return super(DisqusBackend, self).extra_data(user, uid, meta_response,
                                                     details)


class DisqusAuth(BaseOAuth2):
    """Disqus OAuth mechanism"""
    AUTHORIZATION_URL = DISQUS_AUTHORIZATION_URL
    ACCESS_TOKEN_URL = DISQUS_ACCESS_TOKEN_URL
    AUTH_BACKEND = DisqusBackend
    SETTINGS_KEY_NAME = 'DISQUS_CLIENT_ID'
    SETTINGS_SECRET_NAME = 'DISQUS_CLIENT_SECRET'

    def user_data(self, access_token, *args, **kwargs):
        """Loads user data from service"""
        params = {
            'access_token': access_token,
            'api_secret': backend_setting(self, self.SETTINGS_SECRET_NAME),
        }
        url = DISQUS_CHECK_AUTH + '?' + urlencode(params)
        try:
            return simplejson.load(dsa_urlopen(url))
        except ValueError:
            return None


# Backend definition
BACKENDS = {
    'disqus': DisqusAuth,
}
