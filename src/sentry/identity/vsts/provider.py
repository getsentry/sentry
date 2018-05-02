from __future__ import absolute_import

from django import forms

from sentry import http
from sentry import options

from sentry.web.helpers import render_to_response
from sentry.options.manager import FLAG_PRIORITIZE_DISK
from sentry.identity.oauth2 import OAuth2Provider, OAuth2LoginView, OAuth2CallbackView
from sentry.pipeline import PipelineView

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
            AccountConfigView(),
        ]


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


class AccountForm(forms.Form):
    instance = forms.CharField(
        label='Instance',
        widget=forms.TextInput(attrs={'placeholder': 'eg. example.visualstudio.com'}),
        help_text='VS Team Services account (account.visualstudio.com).',
    )


class AccountConfigView(PipelineView):
    def dispatch(self, request, pipeline):
        if 'instance' in request.POST:
            instance = request.POST.get('instance')
            account = self.get_account_info(instance, pipeline)
            if account is not None:
                pipeline.bind_state('instance', instance)
                pipeline.bind_state('account', account)
                return pipeline.next_step()
        return render_to_response(
            template='templates/vsts-account.html',
            context={
                'form': AccountForm(),
            },
            request=request,
        )

    def get_accounts(self, instance, pipeline):
        session = http.build_session()
        url = 'https://%s/_apis/accounts?api-version=4.1' % instance
        access_token = pipeline.state['identity']['data']['access_token']
        response = session.get(
            url,
            headers={
                'Content-Type': 'application/json',
                'Authorization': 'Bearer %s' % access_token,
            }
        )
        if response.status_code == 203:
            return response.json()
        return None

    def get_account_info(self, instance, pipeline):
        accounts = self.get_accounts(instance, pipeline)
        if accounts is None:
            return accounts

        if accounts['count'] > 1:
            account_name = instance.split('.', maxsplit=1)[0].lower()
            for account in accounts['value']:
                if account_name in account['accountName'].lower():
                    return account
        return accounts['value'][0]
