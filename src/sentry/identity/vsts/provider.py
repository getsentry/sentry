from __future__ import absolute_import

from sentry import options
from sentry.options.manager import FLAG_PRIORITIZE_DISK
from sentry.identity.oauth2 import OAuth2Provider

options.register('vsts.client-id', flags=FLAG_PRIORITIZE_DISK)
options.register('vsts.client-secret', flags=FLAG_PRIORITIZE_DISK)
options.register('vsts.verification-token', flags=FLAG_PRIORITIZE_DISK)


class VSTSIdentityProvider(OAuth2Provider):
    key = 'vsts'
    name = 'VSTS'

    oauth_access_token_url = 'https://app.vssps.visualstudio.com/oauth2/token'
    oauth_authorize_url = 'https://app.vssps.visualstudio.com/oauth2/authorize'

    oauth_scopes = (
        'vso.code_full',
        'vso.identity_manage',
        'vso.work_full',
    )

    def get_oauth_client_id(self):
        return options.get('vsts.client-id')

    def get_oauth_client_secret(self):
        return options.get('vsts.client-secret')
