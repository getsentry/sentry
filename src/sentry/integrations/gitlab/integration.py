from __future__ import absolute_import
from time import time

from six.moves.urllib.parse import urlparse
from django.utils.translation import ugettext_lazy as _
from django import forms

from sentry import http
from sentry.web.helpers import render_to_response
from sentry.identity.pipeline import IdentityProviderPipeline
from sentry.identity.gitlab.provider import GitlabIdentityProvider
from sentry.integrations import Integration, IntegrationFeatures, IntegrationProvider, IntegrationMetadata
from sentry.pipeline import NestedPipelineView, PipelineView
from sentry.utils.http import absolute_uri


DESCRIPTION = """
Fill me out
"""

metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    author='The Sentry Team',
    noun=_('Installation'),
    issue_url='https://github.com/getsentry/sentry/issues/',
    source_url='https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/gitlab',
    aspects={},
)


class GitlabIntegration(Integration):

    def get_client(self):
        pass


class InstallationForm(forms.Form):
    url = forms.CharField(
        label="Installation Url",
        help_text=_('The "base URL" for your github enterprise instance, '
                    'includes the host and protocol.'),
        widget=forms.TextInput(
            attrs={'placeholder': _('https://github.example.com')}
        ),
    )
    name = forms.CharField(
        label="Gitlab App Name",
        help_text=_('The GitHub App name of your Sentry app. '
                    'This can be found on the apps configuration '
                    'page.'),
        widget=forms.TextInput(
            attrs={'placeholder': _('our-sentry-app')}
        )
    )
    group = forms.CharField(
        label="Gitlab Group Name",
        widget=forms.TextInput(
            attrs={'placeholder': _('my-awesome-group')}
        )
    )
    client_id = forms.CharField(
        label="Gitlab OAuth Client ID",
        widget=forms.TextInput(
            attrs={'placeholder': _('1')}
        )
    )
    client_secret = forms.CharField(
        label="Gitlab OAuth Client Secret",
        widget=forms.TextInput(
            attrs={'placeholder': _('XXXXXXXXXXXXXXXXXXXXXXXXXXX')}
        )
    )

    def __init__(self, *args, **kwargs):
        super(InstallationForm, self).__init__(*args, **kwargs)


class InstallationConfigView(PipelineView):
    def dispatch(self, request, pipeline):
        form = InstallationForm(request.POST)
        if form.is_valid():
            form_data = form.cleaned_data
            form_data['url'] = urlparse(form_data['url']).netloc

            pipeline.bind_state('installation_data', form_data)

            pipeline.bind_state('oauth_config_information', {
                "access_token_url": u"https://{}/oauth/token".format(form_data.get('url')),
                "authorize_url": u"https://{}/oauth/authorize".format(form_data.get('url')),
                "client_id": form_data.get('client_id'),
                "client_secret": form_data.get('client_secret'),
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
            oauth_scopes=(),
            redirect_url=absolute_uri('/extensions/gitlab/setup/'),
            verify_ssl=False,
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

        if 'expires_in' in payload:
            data['expires'] = int(time()) + int(payload['expires_in'])
        if 'refresh_token' in payload:
            data['refresh_token'] = payload['refresh_token']
        if 'token_type' in payload:
            data['token_type'] = payload['token_type']

        return data

    def get_user_info(self, access_token, installation_data):
        session = http.build_session()
        resp = session.get(
            u'https://{}/api/v4/user'.format(installation_data['url']),
            headers={
                'Accept': 'application/json',
                'Authorization': 'Bearer %s' % access_token,
            },
            verify=False
        )

        resp.raise_for_status()
        return resp.json()

    def get_group_info(self, access_token, installation_data):
        session = http.build_session()
        resp = session.get(
            u'https://{}/api/v4/groups/{}'.format(
                installation_data['url'], installation_data['group']),
            headers={
                'Accept': 'application/json',
                'Authorization': 'Bearer %s' % access_token,
            },
            verify=False
        )

        resp.raise_for_status()
        return resp.json()

    def get_pipeline_views(self):
        return [InstallationConfigView(), lambda: self._make_identity_pipeline_view()]

    def build_integration(self, state):
        data = state['identity']['data']
        oauth_data = self.get_oauth_data(data)
        user = self.get_user_info(data['access_token'], state['installation_data'])
        group = self.get_group_info(data['access_token'], state['installation_data'])
        scopes = sorted(GitlabIdentityProvider.oauth_scopes)
        base_url = state['installation_data']['url']

        integration = {
            'name': group['name'],
            'external_id': u'{}:{}'.format(base_url, group['id']),
            'metadata': {
                'icon': group['avatar_url'],
                'domain_name': group['web_url'].replace('https://', ''),
                'scopes': scopes,
            },
            'user_identity': {
                'type': 'gitlab',
                'external_id': user['id'],
                'scopes': scopes,
                'data': oauth_data,
            },
        }

        return integration
