from __future__ import absolute_import
from time import time

from django.utils.translation import ugettext as _
import six
from sentry import options
from sentry.auth.exceptions import IdentityNotValid


from sentry.integrations import Integration, IntegrationProvider, IntegrationMetadata
from sentry.integrations.exceptions import ApiError
from .client import VstsApiClient
from sentry.pipeline import NestedPipelineView
from sentry.identity.pipeline import IdentityProviderPipeline
from sentry.identity.vsts import VSTSIdentityProvider
from sentry.utils.http import absolute_uri

from .repository import VstsRepositoryProvider
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


class VstsIntegration(Integration):
    oauth_redirect_url = '/extensions/vsts/setup/'
    oauth_refresh_token_uri = 'https://app.vssps.visualstudio.com/oauth2/token'

    def __init__(self, *args, **kwargs):
        super(VstsIntegration, self).__init__(*args, **kwargs)
        self.default_identity = None

    def get_client(self):
        if self.default_identity is None:
            self.default_identity = self.get_default_identity()

        access_token = self.default_identity.data.get('access_token')
        if access_token is None:
            raise ValueError('Identity missing access token')
        return VstsApiClient(access_token)

    def get_project_config(self):
        client = self.get_client()
        disabled = False
        try:
            projects = client.get_projects(self.model.metadata['domain_name'])
        except ApiError:
            # TODO(LB): Disable for now. Need to decide what to do with this in the future
            # should a message be shown to the user?
            # Should we try refreshing the token? For VSTS that often clears up the problem
            project_choices = []
            disabled = True
        else:
            project_choices = [(project['id'], project['name']) for project in projects['value']]

        try:
            # TODO(LB): Will not work in the UI until the serliazer sends a `project_id` to get_installation()
            # serializers and UI are being refactored and it's not worth trying to fix
            # the old system. Revisit
            default_project = self.project_integration.config.get('default_project')
        except Exception:
            default_project = None

        initial_project = ('', '')
        if default_project is not None:
            for project_id, project_name in project_choices:
                if default_project == project_id:
                    initial_project = (project_id, project_name)
                    break

        return [
            {
                'name': 'default_project',
                'type': 'choice',
                'allowEmpty': True,
                'disabled': disabled,
                'required': True,
                'choices': project_choices,
                'initial': initial_project,
                'label': _('Default Project Name'),
                'placeholder': _('MyProject'),
                'help': _('Enter the Visual Studio Team Services project name that you wish to use as a default for new work items'),
            },
        ]

    def get_refresh_identity_params(self):
        data = {
            'refresh_token': self.default_identity.data.get('refresh_token'),
            'client_secret': options.get('vsts.client-secret'),

        }
        for key, value in six.iteritems(data):
            if value is None:
                raise IdentityNotValid(
                    'Could not refresh identity: %s missing %s' %
                    ('vsts', key))

        return data

    def refresh_identity(self):
        from sentry.http import safe_urlopen, safe_urlread
        from sentry.utils.http import absolute_uri
        from six.moves.urllib.parse import parse_qsl
        from sentry.utils import json

        if self.default_identity is None:
            self.default_identity = self.get_default_identity()

        data = self.get_refresh_identity_params()
        resp = safe_urlopen(
            url=self.oauth_refresh_token_uri,
            headers={
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': '1654',
            },
            data={
                'client_assertion_type': 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
                'client_assertion': data['client_secret'],
                'grant_type': 'refresh_token',
                'assertion': data['refresh_token'],
                'redirect_uri': absolute_uri(self.oauth_redirect_url),
            },
        )
        resp.raise_for_status()
        body = safe_urlread(resp)
        if resp.headers['Content-Type'].startswith('application/x-www-form-urlencoded'):
            self.save_identity(dict(parse_qsl(body)))
        self.save_identity(json.loads(body))

    def save_identity(self, data):
        self.default_identity.data = data
        self.default_identity.save()


class VstsIntegrationProvider(IntegrationProvider):
    key = 'vsts'
    name = 'Visual Studio Team Services'
    metadata = metadata
    domain = '.visualstudio.com'
    api_version = '4.1'
    needs_default_identity = True
    integration_cls = VstsIntegration
    can_add_project = True

    setup_dialog_config = {
        'width': 600,
        'height': 800,
    }

    def get_pipeline_views(self):
        identity_pipeline_config = {
            'redirect_url': absolute_uri('/extensions/vsts/setup/'),
        }

        identity_pipeline_view = NestedPipelineView(
            bind_key='identity',
            provider_key='vsts',
            pipeline_cls=IdentityProviderPipeline,
            config=identity_pipeline_config,
        )

        return [
            identity_pipeline_view,
        ]

    def build_integration(self, state):
        data = state['identity']['data']
        account = state['identity']['account']
        instance = state['identity']['instance']

        scopes = sorted(VSTSIdentityProvider.oauth_scopes)
        return {
            'name': account['AccountName'],
            'external_id': account['AccountId'],
            'metadata': {
                'domain_name': instance,
                'scopes': scopes,
            },
            # TODO(LB): Change this to a Microsoft account as opposed to a VSTS workspace
            'user_identity': {
                'type': 'vsts',
                'external_id': account['AccountId'],
                'scopes': [],
                'data': self.get_oauth_data(data),
            },
        }

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
