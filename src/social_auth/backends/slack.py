"""
Obtain
SLACK_CLIENT_ID & SLACK_CLIENT_SECRET
and put into sentry.conf.py
"""
from __future__ import absolute_import

import requests

from social_auth.backends import BaseOAuth2, OAuthBackend

SLACK_TOKEN_EXCHANGE_URL = 'https://slack.com/api/oauth.access'
SLACK_AUTHORIZATION_URL = 'https://slack.com/oauth/authorize'
SLACK_USER_DETAILS_URL = 'https://slack.com/api/auth.test'


class SlackBackend(OAuthBackend):
    """Slack OAuth authentication backend"""
    name = 'slack'
    EXTRA_DATA = [
        ('email', 'email'),
        ('name', 'full_name'),
        ('id', 'id'),
        ('refresh_token', 'refresh_token')
    ]

    def get_user_details(self, response):
        """Return user details from Slack account"""

        return {
            'email': response.get('email'),
            'id': response.get('id'),
            'full_name': response.get('name')
        }


class SlackAuth(BaseOAuth2):
    """Slack OAuth authentication mechanism"""
    AUTHORIZATION_URL = SLACK_AUTHORIZATION_URL
    ACCESS_TOKEN_URL = SLACK_TOKEN_EXCHANGE_URL
    AUTH_BACKEND = SlackBackend
    SETTINGS_KEY_NAME = 'SLACK_CLIENT_ID'
    SETTINGS_SECRET_NAME = 'SLACK_CLIENT_SECRET'
    REDIRECT_STATE = False
    DEFAULT_SCOPE = ['incoming-webhook']

    def user_data(self, access_token, *args, **kwargs):
        """Loads user data from service"""
        try:
            resp = requests.get(SLACK_USER_DETAILS_URL,
                                params={'token': access_token})
            resp.raise_for_status()
            content = resp.json()
            return {
                'id': content['user_id'],
                'name': content['user']
            }
        except ValueError:
            return None


# Backend definition
BACKENDS = {
    'slack': SlackAuth,
}
