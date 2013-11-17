"""
SoundCloud OAuth2 support.

This contribution adds support for SoundCloud OAuth2 service.

The settings SOUNDCLOUD_CLIENT_ID & SOUNDCLOUD_CLIENT_SECRET must be defined
with the values given by SoundCloud application registration process.

http://developers.soundcloud.com/
http://developers.soundcloud.com/docs

By default account id and token expiration time are stored in extra_data
field, check OAuthBackend class for details on how to extend it.
"""
from urllib import urlencode

try:
    import json as simplejson
except ImportError:
    try:
        import simplejson
    except ImportError:
        from django.utils import simplejson

from social_auth.utils import dsa_urlopen
from social_auth.backends import BaseOAuth2, OAuthBackend


# SoundCloud configuration
SOUNDCLOUD_AUTHORIZATION_URL = 'https://soundcloud.com/connect'
SOUNDCLOUD_ACCESS_TOKEN_URL = 'https://api.soundcloud.com/oauth2/token'
SOUNDCLOUD_USER_DATA_URL = 'https://api.soundcloud.com/me.json'
SOUNDCLOUD_SERVER = 'soundcloud.com'
EXTRA_DATA = [
    ('refresh_token', 'refresh_token'),
    ('expires_in', 'expires')
]


class SoundcloudBackend(OAuthBackend):
    """Soundcloud OAuth authentication backend"""
    name = 'soundcloud'
    # Default extra data to store
    EXTRA_DATA = [
        ('id', 'id'),
        ('expires', 'expires')
    ]

    def get_user_details(self, response):
        """Return user details from Soundcloud account"""
        fullname = response.get('full_name')
        full_name = fullname.split(' ')
        first_name = full_name[0]
        if len(full_name) > 1:
            last_name = full_name[-1]
        else:
            last_name = ''

        return {'username': response.get('username'),
                'email': response.get('email') or '',
                'fullname': fullname,
                'first_name': first_name,
                'last_name': last_name}


class SoundcloudAuth(BaseOAuth2):
    """Soundcloud OAuth2 mechanism"""
    AUTHORIZATION_URL = SOUNDCLOUD_AUTHORIZATION_URL
    ACCESS_TOKEN_URL = SOUNDCLOUD_ACCESS_TOKEN_URL
    AUTH_BACKEND = SoundcloudBackend
    SETTINGS_KEY_NAME = 'SOUNDCLOUD_CLIENT_ID'
    SETTINGS_SECRET_NAME = 'SOUNDCLOUD_CLIENT_SECRET'
    SCOPE_SEPARATOR = ','
    REDIRECT_STATE = False
    #SCOPE_VAR_NAME = 'SOUNDCLOUD_EXTENDED_PERMISSIONS'

    def user_data(self, access_token, *args, **kwargs):
        """Loads user data from service"""
        url = SOUNDCLOUD_USER_DATA_URL + '?' + urlencode({
            'oauth_token': access_token
        })
        try:
            value = simplejson.load(dsa_urlopen(url))
            return value
        except ValueError:
            return None

    def auth_url(self):
        """Return redirect url"""
        if self.STATE_PARAMETER or self.REDIRECT_STATE:
            # Store state in session for further request validation. The state
            # value is passed as state parameter (as specified in OAuth2 spec),
            # but also added to redirect_uri, that way we can still verify the
            # request if the provider doesn't implement the state parameter.
            # Reuse token if any.
            name = self.AUTH_BACKEND.name + '_state'
            state = self.request.session.get(name) or self.state_token()
            self.request.session[self.AUTH_BACKEND.name + '_state'] = state
        else:
            state = None

        params = self.auth_params(state)
        params.update(self.get_scope_argument())
        params.update(self.auth_extra_arguments())

        if self.request.META.get('QUERY_STRING'):
            query_string = '&' + self.request.META['QUERY_STRING']
        else:
            query_string = ''
        return self.AUTHORIZATION_URL + '?' + urlencode(params) + query_string


# Backend definition
BACKENDS = {
    'soundcloud': SoundcloudAuth
}
