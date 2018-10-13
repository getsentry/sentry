from __future__ import absolute_import

from six.moves.urllib.parse import urlparse
from django.utils.translation import ugettext_lazy as _
from django import forms
from uuid import uuid4

from sentry.web.helpers import render_to_response
from sentry.identity.pipeline import IdentityProviderPipeline
from sentry.identity.gitlab import get_user_info
from sentry.identity.gitlab.provider import GitlabIdentityProvider
from sentry.integrations import (
    FeatureDescription,
    IntegrationInstallation,
    IntegrationFeatures,
    IntegrationProvider,
    IntegrationMetadata
)
from sentry.integrations.repositories import RepositoryMixin
from sentry.pipeline import NestedPipelineView, PipelineView
from sentry.utils.http import absolute_uri

from .client import GitLabApiClient, GitLabSetupClient
from .issues import GitlabIssueBasic
from .repository import GitlabRepositoryProvider

DESCRIPTION = """
Connect your Sentry organization to your GitLab instance or gitlab.com, enabling the following features:
"""

FEATURES = [
    FeatureDescription(
        """
        Track commits and releases (learn more
        [here](https://docs.sentry.io/learn/releases/))
        """,
        IntegrationFeatures.COMMITS,
    ),
    FeatureDescription(
        """
        Resolve Sentry issues via GitLab commits and merge requests by
        including `Fixes PROJ-ID` in the message
        """,
        IntegrationFeatures.COMMITS,
    ),
    FeatureDescription(
        """
        Create GitLab issues from Sentry
        """,
        IntegrationFeatures.ISSUE_BASIC,
    ),
    FeatureDescription(
        """
        Link Sentry issues to existing GitLab issues
        """,
        IntegrationFeatures.ISSUE_BASIC,
    ),
]

metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    features=FEATURES,
    author='The Sentry Team',
    noun=_('Installation'),
    issue_url='https://github.com/getsentry/sentry/issues/',
    source_url='https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/gitlab',
    aspects={},
)


class GitlabIntegration(IntegrationInstallation, GitlabIssueBasic, RepositoryMixin):
    repo_search = True

    def __init__(self, *args, **kwargs):
        super(GitlabIntegration, self).__init__(*args, **kwargs)
        self.default_identity = None

    def get_group_id(self):
        return self.model.name

    def get_client(self):
        if self.default_identity is None:
            self.default_identity = self.get_default_identity()

        return GitLabApiClient(self)

    def get_repositories(self, query=None):
        # Note: gitlab projects are the same things as repos everywhere else
        group = self.get_group_id()
        resp = self.get_client().get_group_projects(group, query)
        return [{
            'identifier': repo['id'],
            'name': repo['name_with_namespace'],
        } for repo in resp]


class InstallationForm(forms.Form):
    url = forms.CharField(
        label=_("Installation Url"),
        help_text=_('The "base URL" for your GitLab instance, '
                    'includes the host and protocol.'),
        widget=forms.TextInput(
            attrs={'placeholder': 'https://gitlab.example.com'}
        ),
    )
    group = forms.CharField(
        label=_("GitLab Group Name"),
        widget=forms.TextInput(
            attrs={'placeholder': _('my-awesome-group')}
        )
    )
    verify_ssl = forms.BooleanField(
        label=_("Verify SSL"),
        help_text=_('By default, we verify SSL certificates '
                    'when delivering payloads to your GitLab instance, '
                    'and request GitLab to verify SSL when it delivers '
                    'webhooks to Sentry.'),
        widget=forms.CheckboxInput(),
        required=False
    )
    client_id = forms.CharField(
        label=_("GitLab Application ID"),
        widget=forms.TextInput(
            attrs={'placeholder': _(
                '5832fc6e14300a0d962240a8144466eef4ee93ef0d218477e55f11cf12fc3737')}
        )
    )
    client_secret = forms.CharField(
        label=_("GitLab Application Secret"),
        widget=forms.TextInput(
            attrs={'placeholder': _('XXXXXXXXXXXXXXXXXXXXXXXXXXX')}
        )
    )

    def __init__(self, *args, **kwargs):
        super(InstallationForm, self).__init__(*args, **kwargs)
        self.fields['verify_ssl'].initial = True


class InstallationConfigView(PipelineView):
    def dispatch(self, request, pipeline):
        form = InstallationForm(request.POST)
        if form.is_valid():
            form_data = form.cleaned_data

            pipeline.bind_state('installation_data', form_data)

            pipeline.bind_state('oauth_config_information', {
                "access_token_url": u"{}/oauth/token".format(form_data.get('url')),
                "authorize_url": u"{}/oauth/authorize".format(form_data.get('url')),
                "client_id": form_data.get('client_id'),
                "client_secret": form_data.get('client_secret'),
                "verify_ssl": form_data.get('verify_ssl')
            })

            return pipeline.next_step()

        project_form = InstallationForm()

        return render_to_response(
            template='sentry/integrations/gitlab-config.html',
            context={
                'form': project_form,
            },
            request=request,
        )


class GitlabIntegrationProvider(IntegrationProvider):
    key = 'gitlab'
    name = 'Gitlab'
    metadata = metadata
    integration_cls = GitlabIntegration

    needs_default_identity = True

    features = frozenset([
        IntegrationFeatures.ISSUE_BASIC,
        IntegrationFeatures.COMMITS,
    ])

    setup_dialog_config = {
        'width': 1030,
        'height': 1000,
    }

    def _make_identity_pipeline_view(self):
        """
        Make the nested identity provider view. It is important that this view is
        not constructed until we reach this step and the
        ``oauth_config_information`` is available in the pipeline state. This
        method should be late bound into the pipeline vies.
        """
        identity_pipeline_config = dict(
            oauth_scopes=(
                'api',
                'sudo',
            ),
            redirect_url=absolute_uri('/extensions/gitlab/setup/'),
            **self.pipeline.fetch_state('oauth_config_information')
        )

        return NestedPipelineView(
            bind_key='identity',
            provider_key='gitlab',
            pipeline_cls=IdentityProviderPipeline,
            config=identity_pipeline_config,
        )

    def get_oauth_data(self, payload):
        data = {'access_token': payload['access_token']}

        # https://docs.gitlab.com/ee/api/oauth2.html#2-requesting-access-token
        # doesn't seem to be correct, format we actually get:
        # {
        #   "access_token": "123432sfh29uhs29347",
        #   "token_type": "bearer",
        #   "refresh_token": "29f43sdfsk22fsj929",
        #   "created_at": 1536798907,
        #   "scope": "api sudo"
        # }
        if 'refresh_token' in payload:
            data['refresh_token'] = payload['refresh_token']
        if 'token_type' in payload:
            data['token_type'] = payload['token_type']

        return data

    def get_group_info(self, access_token, installation_data):
        client = GitLabSetupClient(
            installation_data['url'],
            access_token,
            installation_data['verify_ssl']
        )
        resp = client.get_group(installation_data['group'])

        return resp.json

    def get_pipeline_views(self):
        return [InstallationConfigView(), lambda: self._make_identity_pipeline_view()]

    def build_integration(self, state):
        data = state['identity']['data']
        oauth_data = self.get_oauth_data(data)
        user = get_user_info(data['access_token'], state['installation_data'])
        group = self.get_group_info(data['access_token'], state['installation_data'])
        scopes = sorted(GitlabIdentityProvider.oauth_scopes)
        base_url = state['installation_data']['url']

        hostname = urlparse(base_url).netloc
        verify_ssl = state['installation_data']['verify_ssl']

        integration = {
            'name': group['name'],
            # We splice the host & secret together to create an external id.
            # This id is used as a webhook secret so we can find the matching
            # sentry org later on.
            'external_id': u'{}:{}'.format(hostname, uuid4().hex),
            'metadata': {
                'icon': group['avatar_url'],
                'instance': hostname,
                'domain_name': u'{}/{}'.format(hostname, group['path']),
                'scopes': scopes,
                'verify_ssl': verify_ssl,
                'base_url': base_url,
            },
            'user_identity': {
                'type': 'gitlab',
                'external_id': u'{}:{}'.format(hostname, user['id']),
                'scopes': scopes,
                'data': oauth_data,
            },
        }

        return integration

    def setup(self):
        from sentry.plugins import bindings
        bindings.add(
            'integration-repository.provider',
            GitlabRepositoryProvider,
            id='integrations:gitlab',
        )
