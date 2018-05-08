from __future__ import absolute_import

from django.utils.translation import ugettext_lazy as _
from django import forms

# from sentry import http, options
from sentry.web.helpers import render_to_response
from sentry.identity.pipeline import IdentityProviderPipeline
# from sentry.identity.github import get_user_info
from sentry.integrations import IntegrationMetadata
from sentry.integrations.github.integration import GitHubIntegration
from sentry.pipeline import NestedPipelineView, PipelineView
from sentry.utils.http import absolute_uri

# from sentry.integrations.github.utils import get_jwt


DESCRIPTION = """
    Fill me out (Enterprise)
"""


metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    author='The Sentry Team',
    noun=_('Installation'),
    issue_url='https://github.com/getsentry/sentry/issues/new?title=GitHub%20Integration:%20&labels=Component%3A%20Integrations',
    source_url='https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/github',
    aspects={}
)


class InstallationForm(forms.Form):
    def __init__(self, *args, **kwargs):
        super(InstallationForm, self).__init__(*args, **kwargs)

        self.fields['url'] = forms.CharField(widget=forms.TextInput(
            attrs={
                'label': "Installation Url",
                'placeholder': _('https://github.example.com'),
            }
        ))
        self.fields['id'] = forms.CharField(widget=forms.TextInput(
            attrs={
                'label': "Github App ID",
                'placeholder': _('1'),
            }
        ))
        self.fields['name'] = forms.CharField(widget=forms.TextInput(
            attrs={
                'label': "Github App Name",
                'placeholder': _('sentry-app'),
            }
        ))
        self.fields['client-id'] = forms.CharField(widget=forms.TextInput(
            attrs={
                'label': "Github App Client ID",
                'placeholder': _('1'),
            }
        ))
        self.fields['client-secret'] = forms.CharField(widget=forms.TextInput(
            attrs={
                'label': "Github App Client Secret",
                'placeholder': _('XXXXXXXXXXXXXXXXXXXXXXXXXXX'),
            }
        ))
        self.fields['webhook-secret'] = forms.CharField(required=False, widget=forms.TextInput(
            attrs={
                'label': "Github App Webhook Secret",
                'placeholder': _('XXXXXXXXXXXXXXXXXXXXXXXXXXX'),
            }
        ))
        self.fields['private-key'] = forms.CharField(widget=forms.TextInput(
            attrs={
                'label': "Github App Private Key",
                'placeholder': _('XXXXXXXXXXXXXXXXXXXXXXXXXXX'),
            }
        ))


class InstallationConfigView(PipelineView):
    def dispatch(self, request, pipeline):
        form = InstallationForm(request.POST)
        # TODO(maxbittker) handle errors
        if form.is_valid():
            installation_data = {
                "url": request.POST.get('url'),
                "id": request.POST.get('id'),
                "name": request.POST.get('name'),
                "client-id": request.POST.get('client-id'),
                "client-secret": request.POST.get('client-secret'),
                "webhook-secret": request.POST.get('webhook-secret'),
                "private-key": request.POST.get('private-key'),
            }
            pipeline.bind_state('installation_data', installation_data)
            return pipeline.next_step()

        project_form = InstallationForm()

        return render_to_response(
            template='sentry/integrations/github-enterprise-config.html',
            context={
                'form': project_form,
            },
            request=request,
        )


class GitHubEnterpriseIntegration(GitHubIntegration):
    key = 'github-enterprise'
    name = 'GitHub Enterprise'
    metadata = metadata

    def get_pipeline_views(self):
        identity_pipeline_config = {
            'oauth_scopes': (),
            'redirect_url': absolute_uri('/extensions/github/setup/'),
        }

        identity_pipeline_view = NestedPipelineView(
            bind_key='identity',
            provider_key='github-enterprise',
            pipeline_cls=IdentityProviderPipeline,
            config=identity_pipeline_config,
        )

        return [InstallationConfigView(),
                GitHubEnterpriseInstallationRedirect(),
                identity_pipeline_view]


class GitHubEnterpriseInstallationRedirect(PipelineView):
    def get_app_url(self, installation_data):
        url = installation_data.get('url')
        name = installation_data.get('name')
        return '{}apps/{}'.format(url, name)

    def dispatch(self, request, pipeline):
        installation_data = pipeline.fetch_state(key='installation_data')

        if 'installation_id' in request.GET:
            pipeline.bind_state('installation_id', request.GET['installation_id'])
            return pipeline.next_step()

        return self.redirect(self.get_app_url(installation_data))
