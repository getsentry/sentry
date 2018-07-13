from __future__ import absolute_import
from time import time
import logging

from django import forms
from django.utils.translation import ugettext as _

from sentry import http
from sentry.models import Integration as IntegrationModel
from sentry.integrations import Integration, IntegrationFeatures, IntegrationProvider, IntegrationMetadata
from sentry.integrations.exceptions import ApiError
from sentry.integrations.repositories import RepositoryMixin
from sentry.integrations.vsts.issues import VstsIssueSync
from sentry.pipeline import NestedPipelineView
from sentry.identity.pipeline import IdentityProviderPipeline
from sentry.identity.vsts import VSTSIdentityProvider, get_user_info
from sentry.pipeline import PipelineView
from sentry.web.helpers import render_to_response
from sentry.utils.http import absolute_uri
from .client import VstsApiClient
from .repository import VstsRepositoryProvider
from .webhooks import WorkItemWebhook
DESCRIPTION = """
VSTS
"""

metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    author='The Sentry Team',
    noun=_('Account'),
    issue_url='https://github.com/getsentry/sentry/issues/new?title=VSTS%20Integration:%20&labels=Component%3A%20Integrations',
    source_url='https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/vsts',
    aspects={},
)


class VstsIntegration(Integration, RepositoryMixin, VstsIssueSync):
    logger = logging.getLogger('sentry.integrations')

    def __init__(self, *args, **kwargs):
        super(VstsIntegration, self).__init__(*args, **kwargs)
        self.default_identity = None

    def reinstall(self):
        self.reinstall_repositories()

    def get_repositories(self):
        try:
            repos = self.get_client().get_repos(self.instance)
        except ApiError:
            repos = []  # or whatever!
        data = []
        for repo in repos:
            data.append({
                'name': repo['name'],
                'full_name': repo['id'],  # TODO(lb): uhhh???? there is no full name
            })
        return data

    def get_client(self):
        if self.default_identity is None:
            self.default_identity = self.get_default_identity()

        return VstsApiClient(self.default_identity, VstsIntegrationProvider.oauth_redirect_url)

    def get_organization_config(self):
        client = self.get_client()
        instance = self.model.metadata['domain_name']

        try:
            # NOTE(lb): vsts get workitem states does not give an id.
            work_item_states = client.get_work_item_states(instance)['value']
            statuses = [(c['name'], c['name']) for c in work_item_states]
            disabled = False
        except ApiError:
            # TODO(epurkhsier): Maybe disabling the inputs for the resolve
            # statuses is a little heavy handed. Is there something better we
            # can fall back to?
            statuses = []
            disabled = True

        return [
            {
                'name': 'resolve_status',
                'type': 'choice',
                'allowEmpty': True,
                'disabled': disabled,
                'choices': statuses,
                'label': _('Visual Studio Team Services Resolved Status'),
                'placeholder': _('Select a Status'),
                'help': _('Declares what the linked Visual Studio Team Services ticket workflow status should be transitioned to when the Sentry issue is resolved.'),
            },
            {
                'name': 'resolve_when',
                'type': 'choice',
                'allowEmpty': True,
                'disabled': disabled,
                'choices': statuses,
                'label': _('Resolve in Sentry When'),
                'placeholder': _('Select a Status'),
                'help': _('When a Visual Studio Team Services ticket is transitioned to this status, trigger resolution of the Sentry issue.'),
            },
            {
                'name': 'regression_status',
                'type': 'choice',
                'allowEmpty': True,
                'disabled': disabled,
                'choices': statuses,
                'label': _('Visual Studio Team Services Regression Status'),
                'placeholder': _('Select a Status'),
                'help': _('Declares what the linked Visual Studio Team Services ticket workflow status should be transitioned to when the Sentry issue has a regression.'),
            },
            {
                'name': 'sync_comments',
                'type': 'boolean',
                'label': _('Post Comments to Visual Studio Team Services'),
                'help': _('Synchronize comments from Sentry issues to linked Visual Studio Team Services tickets.'),
            },
            {
                'name': 'sync_forward_assignment',
                'type': 'boolean',
                'label': _('Synchronize Assignment to Visual Studio Team Services'),
                'help': _('When assigning something in Sentry, the linked Visual Studio Team Services ticket will have the associated Visual Studio Team Services user assigned.'),
            },
            {
                'name': 'sync_reverse_assignment',
                'type': 'boolean',
                'label': _('Synchronize Assignment to Sentry'),
                'help': _('When assigning a user to a Linked Visual Studio Team Services ticket, the associated Sentry user will be assigned to the Sentry issue.'),
            },
        ]

    @property
    def instance(self):
        return self.model.metadata['domain_name']

    @property
    def default_project(self):
        try:
            return self.model.metadata['default_project']
        except KeyError:
            return None

    def create_comment(self, issue_id, comment):
        self.get_client().update_work_item(self.instance, issue_id, comment=comment)


class VstsIntegrationProvider(IntegrationProvider):
    key = 'vsts'
    name = 'Visual Studio Team Services'
    metadata = metadata
    domain = '.visualstudio.com'
    api_version = '4.1'
    oauth_redirect_url = '/extensions/vsts/setup/'
    needs_default_identity = True
    integration_cls = VstsIntegration
    features = frozenset([IntegrationFeatures.ISSUE_SYNC])

    setup_dialog_config = {
        'width': 600,
        'height': 800,
    }

    def get_pipeline_views(self):
        identity_pipeline_config = {
            'redirect_url': absolute_uri(self.oauth_redirect_url),
        }

        identity_pipeline_view = NestedPipelineView(
            bind_key='identity',
            provider_key='vsts',
            pipeline_cls=IdentityProviderPipeline,
            config=identity_pipeline_config,
        )

        return [
            identity_pipeline_view,
            AccountConfigView(),
        ]

    def build_integration(self, state):
        data = state['identity']['data']
        oauth_data = self.get_oauth_data(data)
        account = state['account']
        instance = state['instance']
        user = get_user_info(data['access_token'])
        scopes = sorted(VSTSIdentityProvider.oauth_scopes)

        integration = {
            'name': account['AccountName'],
            'external_id': account['AccountId'],
            'metadata': {
                'domain_name': instance,
                'scopes': scopes,
            },
            'user_identity': {
                'type': 'vsts',
                'external_id': user['id'],
                'scopes': scopes,
                'data': oauth_data,
            },
        }

        try:
            IntegrationModel.objects.get(provider='vsts', external_id=account['AccountId'])
        except IntegrationModel.DoesNotExist:
            subscription_id, subscription_secret = self.create_subscription(
                instance, account['AccountId'], oauth_data)
            integration['metadata']['subscription'] = {
                'id': subscription_id,
                'secret': subscription_secret,
            }

        return integration

    def create_subscription(self, instance, account_id, oauth_data):
        webhook = WorkItemWebhook()
        subscription, shared_secret = webhook.create_subscription(
            instance, oauth_data, self.oauth_redirect_url, account_id)
        subscription_id = subscription['publisherInputs']['tfsSubscriptionId']
        return subscription_id, shared_secret

    def get_oauth_data(self, payload):
        data = {'access_token': payload['access_token']}

        if 'expires_in' in payload:
            data['expires'] = int(time()) + int(payload['expires_in'])
        if 'refresh_token' in payload:
            data['refresh_token'] = payload['refresh_token']
        if 'token_type' in payload:
            data['token_type'] = payload['token_type']

        return data

    def setup(self):
        from sentry.plugins import bindings
        bindings.add(
            'integration-repository.provider',
            VstsRepositoryProvider,
            id='integrations:vsts',
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

        access_token = pipeline.fetch_state(key='identity')['data']['access_token']
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


class AccountForm(forms.Form):
    def __init__(self, accounts, *args, **kwargs):
        super(AccountForm, self).__init__(*args, **kwargs)
        self.fields['account'] = forms.ChoiceField(
            choices=[(acct['AccountId'], acct['AccountName']) for acct in accounts],
            label='Account',
            help_text='VS Team Services account (account.visualstudio.com).',
        )
