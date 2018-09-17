from __future__ import absolute_import

from sentry import http
from sentry.identity.oauth2 import OAuth2Provider


def get_user_info(access_token, installation_data):
    session = http.build_session()
    resp = session.get(
        u'https://{}/api/v4/user'.format(installation_data['url']),
        headers={
            'Accept': 'application/json',
            'Authorization': 'Bearer %s' % access_token,
        },
        verify=installation_data['verify_ssl']
    )

    resp.raise_for_status()
    return resp.json()


class GitlabIdentityProvider(OAuth2Provider):
    key = 'gitlab'
    name = 'Gitlab'

    oauth_scopes = (
        'api',
        'sudo',
    )

    def build_identity(self, data):
        data = data['data']

        return {
            'type': 'gitlab',
            'id': data['user']['id'],
            'email': data['user']['email'],
            'scopes': sorted(data['scope'].split(',')),
            'data': self.get_oauth_data(data),
        }
