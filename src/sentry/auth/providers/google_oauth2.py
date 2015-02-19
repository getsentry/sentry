from __future__ import absolute_import, print_function

from django.conf import settings
from urllib import urlencode

from sentry.auth import AuthView
from sentry.auth.providers.oauth2 import (
    OAuth2Callback, OAuth2Provider, OAuth2Login
)
from sentry.http import safe_urlopen, safe_urlread
from sentry.utils import json

AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/auth'

ACCESS_TOKEN_URL = 'https://accounts.google.com/o/oauth2/token'

SCOPE = 'email'

CLIENT_ID = getattr(settings, 'GOOGLE_CLIENT_ID', None)

CLIENT_SECRET = getattr(settings, 'GOOGLE_CLIENT_SECRET', None)

# requires Google+ API enabled
USER_DETAILS_ENDPOINT = 'https://www.googleapis.com/plus/v1/people/me'

ERR_INVALID_DOMAIN = 'The domain for your Google account is not allowed to authenticate with this provider.'


class FetchUser(AuthView):
    def __init__(self, domain=None, *args, **kwargs):
        self.domain = domain
        super(FetchUser, self).__init__(*args, **kwargs)

    def dispatch(self, request, helper):
        access_token = helper.fetch_state('data')['access_token']

        req = safe_urlopen('{0}?{1}'.format(
            USER_DETAILS_ENDPOINT,
            urlencode({
                'access_token': access_token,
            }),
        ))
        body = safe_urlread(req)
        data = json.loads(body)

        if self.domain and self.domain != data.get('domain'):
            return helper.error(ERR_INVALID_DOMAIN)

        helper.bind_state('user', data)

        return helper.next_step()


class GoogleOAuth2Provider(OAuth2Provider):
    name = 'Google'

    def __init__(self, domain=None, **config):
        self.domain = domain
        super(GoogleOAuth2Provider, self).__init__(**config)

    def get_auth_pipeline(self):
        return [
            OAuth2Login(
                authorize_url=AUTHORIZE_URL,
                scope=SCOPE,
                client_id=CLIENT_ID,
            ),
            OAuth2Callback(
                access_token_url=ACCESS_TOKEN_URL,
                client_id=CLIENT_ID,
                client_secret=CLIENT_SECRET,
            ),
            FetchUser(domain=self.domain),
        ]

    def build_config(self, state):
        # TODO(dcramer): we actually want to enforce a domain here. Should that
        # be a view which does that, or should we allow this step to raise
        # validation errors?
        return {
            'domain': state['user']['domain'],
        }

    def build_identity(self, state):
        # data.user => {
        #   "displayName": "David Cramer",
        #   "emails": [{"value": "david@getsentry.com", "type": "account"}],
        #   "domain": "getsentry.com",
        #   "verified": false
        # }
        user_data = state['user']
        return {
            'id': user_data['id'],
            # TODO: is there a "correct" email?
            'email': user_data['emails'][0]['value'],
            'name': user_data['displayName'],
            'data': {
                'access_token': state['data']['access_token'],
            },
        }
