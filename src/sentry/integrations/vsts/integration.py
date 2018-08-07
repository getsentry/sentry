from __future__ import absolute_import
from time import time
import logging

from django import forms
from django.utils.translation import ugettext as _

from sentry import http
from sentry.models import Integration as IntegrationModel, IntegrationExternalProject
from sentry.integrations import Integration, IntegrationFeatures, IntegrationProvider, IntegrationMetadata
from sentry.integrations.exceptions import ApiError, IntegrationError
from sentry.integrations.repositories import RepositoryMixin
from sentry.integrations.vsts.issues import VstsIssueSync
from sentry.models import Repository
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
Connect your Sentry organization to one or more of your Visual Studio Team Services (VSTS) accounts. Get started streamlining your bug squashing workflow by unifying your Sentry and Visual Studio accounts together.

* Create and link Sentry issue groups directly to a VSTS workitem in any of your projects, providing a quick way to jump from Sentry bug to tracked ticket!
* Automatically synchronize assignees to and from VSTS. Don't get confused who's fixing what, let us handle ensuring your issues and tickets match up to your Sentry and VSTS assignees.
* Never forget to close a resolved workitem! Resolving an issue in Sentry will resolve your linked workitems and viceversa.
* Synchronize comments on Sentry Issues directly to the linked VSTS workitems.

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
    comment_key = 'sync_comments'
    outbound_status_key = 'sync_status_forward'
    inbound_status_key = 'sync_status_reverse'
    outbound_assignee_key = 'sync_forward_assignment'
    inbound_assignee_key = 'sync_reverse_assignment'

    def __init__(self, *args, **kwargs):
        super(VstsIntegration, self).__init__(*args, **kwargs)
        self.default_identity = None

    def reinstall(self):
        self.reinstall_repositories()

    def get_repositories(self):
        try:
            repos = self.get_client().get_repos(self.instance)
        except ApiError as e:
            raise IntegrationError(self.message_from_error(e))
        data = []
        for repo in repos['value']:
            data.append({
                'name': '%s\%s' % (repo['project']['name'], repo['name']),
                'identifier': repo['id'],
            })
        return data

    def get_unmigratable_repositories(self):
        return Repository.objects.filter(
            organization_id=self.organization_id,
            provider='visualstudio',
        ).exclude(
            external_id__in=[r['identifier'] for r in self.get_repositories()],
        )

    def get_client(self):
        if self.default_identity is None:
            self.default_identity = self.get_default_identity()

        return VstsApiClient(
            self.default_identity,
            VstsIntegrationProvider.oauth_redirect_url,
        )

    def get_organization_config(self):
        client = self.get_client()
        instance = self.model.metadata['domain_name']

        try:
            projects = client.get_projects(instance)['value']

            project_selector = []
            all_states = set()

            for project in projects:
                project_selector.append({'value': project['id'], 'label': project['name']})
                project_states = client.get_work_item_states(instance, project['id'])['value']
                for state in project_states:
                    all_states.add(state['name'])

            all_states = [(state, state) for state in all_states]
            disabled = False

        except ApiError:
            all_states = []
            disabled = True

        return [
            {
                'name': self.inbound_status_key,
                'type': 'boolean',
                'label': _('Sync Status from VSTS to Sentry'),
                'help': _("When a VSTS work item is moved to a done category, it's linked Sentry issue will be resolved. When a VSTS ticket is moved out of a Done category, it's linked Sentry issue will be unresolved."),
            },
            {
                'name': self.outbound_status_key,
                'type': 'choice_mapper',
                'label': _('Sync Status from Sentry to VSTS'),
                'disabled': disabled,
                'help': _('Declares what the linked VSTS ticket workflow status should be transitioned to when the Sentry issue is resolved or unresolved.'),
                'addButtonText': _('Map Project'),
                'addDropdown': {
                    'emptyMessage': _('All projects configured'),
                    'noResultsMessage': _('Could not find VSTS project'),
                    'items': project_selector,
                },
                'mappedSelectors': {
                    'on_resolve': {'choices': all_states, 'placeholder': _('Select a status')},
                    'on_unresolve': {'choices': all_states, 'placeholder': _('Select a status')},
                },
                'columnLabels': {
                    'on_resolve': _('When resolved'),
                    'on_unresolve': _('When unresolved'),
                },
                'mappedColumnLabel': _('VSTS Project'),
            },
            {
                'name': self.comment_key,
                'type': 'boolean',
                'label': _('Post Comments to VSTS'),
                'help': _('Synchronize comments from Sentry issues to linked VSTS work items.'),
            },
            {
                'name': self.outbound_assignee_key,
                'type': 'boolean',
                'label': _('Synchronize Assignment to VSTS'),
                'help': _('When assigning something in Sentry, the linked VSTS ticket will have the associated VSTS user assigned.'),
            },
            {
                'name': self.inbound_assignee_key,
                'type': 'boolean',
                'label': _('Synchronize Assignment to Sentry'),
                'help': _('When assigning a user to a Linked VSTS ticket, the associated Sentry user will be assigned to the Sentry issue.'),
            },
        ]

    def update_organization_config(self, data):
        if 'sync_status_forward' in data:
            project_ids_and_statuses = data.pop('sync_status_forward')
            data['sync_status_forward'] = bool(project_ids_and_statuses)

            IntegrationExternalProject.objects.filter(
                organization_integration_id=self.org_integration.id,
            ).delete()

            for project_id, statuses in project_ids_and_statuses.items():
                IntegrationExternalProject.objects.create(
                    organization_integration_id=self.org_integration.id,
                    external_id=project_id,
                    resolved_status=statuses['on_resolve'],
                    unresolved_status=statuses['on_unresolve'],
                )

        config = self.org_integration.config
        config.update(data)
        self.org_integration.update(config=config)

    def get_config_data(self):
        config = self.org_integration.config
        project_mappings = IntegrationExternalProject.objects.filter(
            organization_integration_id=self.org_integration.id,
        )
        sync_status_forward = {}
        for pm in project_mappings:
            sync_status_forward[pm.external_id] = {
                'on_unresolve': pm.unresolved_status,
                'on_resolve': pm.resolved_status,
            }
        config['sync_status_forward'] = sync_status_forward
        return config

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
    features = frozenset([IntegrationFeatures.ISSUE_SYNC, IntegrationFeatures.COMMITS])

    setup_dialog_config = {
        'width': 600,
        'height': 800,
    }

    def post_install(self, integration, organization):
        unmigratable_repos = self \
            .get_installation(integration, organization.id) \
            .get_unmigratable_repositories()

        repos = Repository.objects.filter(
            organization_id=organization.id,
            provider='visualstudio',
        ).exclude(
            id__in=unmigratable_repos,
        )

        for repo in repos:
            repo.update(integration_id=integration.id)

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

        if not IntegrationModel.objects.filter(
                provider='vsts', external_id=account['AccountId']).exists():
            subscription_id, subscription_secret = self.create_subscription(
                instance, account['AccountId'], oauth_data)
            integration['metadata']['subscription'] = {
                'id': subscription_id,
                'secret': subscription_secret,
            }

        return integration

    def create_subscription(self, instance, account_id, oauth_data):
        webhook = WorkItemWebhook()
        try:
            subscription, shared_secret = webhook.create_subscription(
                instance, oauth_data, self.oauth_redirect_url, account_id)
        except ApiError as e:
            if e.code != 400 or 'permission' not in e.message:
                raise e
            raise IntegrationError(
                'You do not have sufficent account access to create an integration.\nPlease check with the owner of this account.'
            )

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
