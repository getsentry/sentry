from __future__ import absolute_import

from django import forms

from sentry import http
from sentry import options

from sentry.web.helpers import render_to_response
from sentry.identity.oauth2 import OAuth2Provider, OAuth2LoginView, OAuth2CallbackView
from sentry.pipeline import PipelineView


class VSTSIdentityProvider(OAuth2Provider):
    key = 'vsts'
    name = 'Visual Studio Team Services'

    oauth_access_token_url = 'https://app.vssps.visualstudio.com/oauth2/token'
    oauth_authorize_url = 'https://app.vssps.visualstudio.com/oauth2/authorize'

    oauth_scopes = (
        'vso.code',
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
    def __init__(self, accounts, *args, **kwargs):
        super(AccountForm, self).__init__(*args, **kwargs)
        self.fields['account'] = forms.ChoiceField(
            choices=[(acct['AccountId'], acct['AccountName']) for acct in accounts],
            label='Account',
            help_text='VS Team Services account (account.visualstudio.com).',
        )


class AccountConfigView(PipelineView):
    def dispatch(self, request, pipeline):
        if 'account' in request.POST:
            account_id = request.POST.get('account')
            accounts = pipeline.fetch_state(key='accounts')
            account = self.get_account_from_id(account_id, accounts)
            if account is not None:
                pipeline.bind_state('account', account)
                pipeline.bind_state('instance', account['AccountName'] + '.visualstudio.com')
                return pipeline.next_step()

        access_token = pipeline.fetch_state(key='data')['access_token']
        accounts = self.get_accounts(access_token)
        pipeline.bind_state('accounts', accounts)
        account_form = AccountForm(accounts)
        return render_to_response(
            template='sentry/integrations/vsts-config.html',
            context={
                'form': account_form,
            },
            request=request,
        )

    def get_account_from_id(self, account_id, accounts):
        for account in accounts:
            if account['AccountId'] == account_id:
                return account
        return None

    def get_accounts(self, access_token):
        session = http.build_session()
        url = 'https://app.vssps.visualstudio.com/_apis/accounts'
        response = session.get(
            url,
            headers={
                'Content-Type': 'application/json',
                'Authorization': 'Bearer %s' % access_token,
            },
        )
        if response.status_code == 200:
            return response.json()
        return None
