from __future__ import absolute_import

from sentry import http, options

from sentry.identity.oauth2 import OAuth2Provider, OAuth2LoginView, OAuth2CallbackView
from sentry.utils.http import absolute_uri


def get_user_info(access_token):
    session = http.build_session()
    resp = session.get(
        'https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=1.0',
        headers={
            'Accept': 'application/json',
            'Authorization': 'bearer %s' % access_token,
        },
    )
    resp.raise_for_status()
    resp = resp.json()

    return resp


class VSTSIdentityProvider(OAuth2Provider):
    key = 'vsts'
    name = 'Visual Studio Team Services'

    oauth_access_token_url = 'https://app.vssps.visualstudio.com/oauth2/token'
    oauth_authorize_url = 'https://app.vssps.visualstudio.com/oauth2/authorize'
    oauth_scopes = (
        'vso.code',
        'vso.graph',
        'vso.project',
        'vso.release',
        'vso.serviceendpoint_manage',
        'vso.work_write',
        'vso.workitemsearch',
    )

    def get_oauth_client_id(self):
        return options.get('vsts.client-id')

    def get_oauth_client_secret(self):
        return options.get('vsts.client-secret')

    def get_refresh_token_url(self):
        return self.oauth_access_token_url

    def get_pipeline_views(self):
        return [
            OAuth2LoginView(
                authorize_url=self.oauth_authorize_url,
                client_id=self.get_oauth_client_id(),
                scope=' '.join(self.get_oauth_scopes()),
            ),
            VSTSOAuth2CallbackView(
                access_token_url=self.oauth_access_token_url,
                client_id=self.get_oauth_client_id(),
                client_secret=self.get_oauth_client_secret(),
            ),
        ]

    def get_refresh_token_headers(self):
        return {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': '1654',
        }

    def get_refresh_token_params(self, refresh_token, *args, **kwargs):
        oauth_redirect_url = kwargs.get('redirect_url')
        if oauth_redirect_url is None:
            raise ValueError('VSTS requires oauth redirect url when refreshing identity')
        return {
            'client_assertion_type': 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
            'client_assertion': self.get_oauth_client_secret(),
            'grant_type': 'refresh_token',
            'assertion': refresh_token,
            'redirect_uri': absolute_uri(oauth_redirect_url),
        }

    def build_identity(self, data):
        data = data['data']
        user = get_user_info(data['access_token'])

        return {
            'type': 'vsts',
            'id': user['id'],
            'email': user['emailAddress'],
            'email_verified': True,
            'name': user['displayName'],
            'scopes': sorted(self.oauth_scopes),
            'data': self.get_oauth_data(data),
        }


class VSTSOAuth2CallbackView(OAuth2CallbackView):

    def exchange_token(self, request, pipeline, code):
        from sentry.http import safe_urlopen, safe_urlread
        from sentry.utils.http import absolute_uri
        from six.moves.urllib.parse import parse_qsl
        from sentry.utils import json
        req = safe_urlopen(
            url=self.access_token_url,
            headers={
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': '1322',
            },
            data={
                'client_assertion_type': 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
                'client_assertion': self.client_secret,
                'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion': code,
                'redirect_uri': absolute_uri(pipeline.redirect_url()),
            },
        )
        body = safe_urlread(req)
        if req.headers['Content-Type'].startswith('application/x-www-form-urlencoded'):
            return dict(parse_qsl(body))
        return json.loads(body)
