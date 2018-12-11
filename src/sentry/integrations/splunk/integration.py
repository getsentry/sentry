from __future__ import absolute_import

from six.moves.urllib.parse import urlparse
from django.utils.translation import ugettext_lazy as _
from django import forms

from sentry import http
from sentry.integrations import (
    FeatureDescription,
    IntegrationInstallation,
    IntegrationFeatures,
    IntegrationProvider,
    IntegrationMetadata
)
from sentry.pipeline import PipelineView
from sentry.utils.hashlib import sha1_text
from sentry.web.helpers import render_to_response

DESCRIPTION = """
Connect your Sentry organization to Splunk, enabling the following features:
"""

FEATURES = [
    FeatureDescription(
        """
        Forward processed events (learn more
        [here](https://docs.sentry.io/data-management/data-forwarding/))
        """,
        IntegrationFeatures.DATA_FORWARDING,
    ),
]

metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    features=FEATURES,
    author='The Sentry Team',
    noun=_('Installation'),
    issue_url='https://github.com/getsentry/sentry/issues/',
    source_url='https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/splunk',
    aspects={},
)


class SplunkIntegration(IntegrationInstallation):
    pass


class InstallationConfigForm(forms.Form):
    endpoint = forms.CharField(
        label=_('HEC Endpoint'),
        help_text=_('The HTTP Event Collector endpoint for your Splunk instance.'),
        widget=forms.TextInput(
            attrs={'placeholder': 'https://input-foo.cloud.splunk.com:8088'}
        ),
        required=True,
    )
    token = forms.CharField(
        label=_('Token'),
        required=True,
    )
    index = forms.CharField(
        label=_('Index'),
        widget=forms.TextInput(
            attrs={'placeholder': _(
                'e.g. main')}
        ),
        required=True,
        initial='main',
    )
    source = forms.CharField(
        label=_('Source'),
        help_text=_('The source name to identify the events received from Sentry.'),
        widget=forms.TextInput(
            attrs={'placeholder': _(
                'e.g. sentry')}
        ),
        required=True,
        initial='sentry',
    )
    verify_ssl = forms.BooleanField(
        label=_('Verify SSL'),
        help_text=_('By default, we ignore SSL verification '
                    'when delivering payloads to your Splunk instance'),
        widget=forms.CheckboxInput(),
        required=False,
        initial=False
    )

    def clean_endpoint(self):
        """
        Strip off trailing / as they cause invalid URLs downstream
        """
        endpoint = self.cleaned_data['endpoint']
        if not endpoint.endswith('/services/collector'):
            endpoint = endpoint.rstrip('/') + '/services/collector'
        return endpoint

    def clean(self):
        data = self.cleaned_data
        if data.get('endpoint') and data.get('token'):
            session = http.build_session()
            resp = session.options(
                data['endpoint'],
                verify=data.get('verify_ssl', False),
                headers={
                    'Authorization': 'Splunk {}'.format(data['token'])
                },
            )
            if resp.status_code != 200:
                raise forms.ValidationError(
                    'The specified HEC endpoint returned an invalid HTTP status code: {}'.format(
                        resp.status_code))
        return data


class InstallationGuideView(PipelineView):
    def dispatch(self, request, pipeline):
        if request.method == 'POST':
            return pipeline.next_step()

        return render_to_response(
            template='sentry/integrations/splunk-config.html',
            request=request,
        )


class InstallationConfigView(PipelineView):
    def dispatch(self, request, pipeline):
        form = InstallationConfigForm(request.POST if request.POST.get('op') == 'config' else None)
        if form.is_valid():
            pipeline.bind_state('config', dict(form.cleaned_data))

            return pipeline.next_step()

        return render_to_response(
            template='sentry/integrations/splunk-config.html',
            context={
                'form': form,
            },
            request=request,
        )


class SplunkIntegrationProvider(IntegrationProvider):
    key = 'splunk'
    name = 'Splunk'
    metadata = metadata
    integration_cls = SplunkIntegration

    needs_default_identity = False

    features = frozenset([
        IntegrationFeatures.DATA_FORWARDING,
    ])

    setup_dialog_config = {
        'width': 1030,
        'height': 1000,
    }

    def get_pipeline_views(self):
        return [InstallationGuideView(), InstallationConfigView()]

    def build_integration(self, state):
        data = state['config']

        parsed_url = urlparse(data['endpoint'])

        integration = {
            'name': parsed_url.hostname,
            'external_id': sha1_text(data['endpoint']),
            'metadata': {
                'token': data['token'],
                'index': data['index'],
                'source': data['source'],
                'endpoint': data['endpoint'],
                'verify_ssl': data['verify_ssl'],
            },
            # 'user_identity': {
            #     'type': 'gitlab',
            #     'external_id': u'{}:{}'.format(hostname, user['id']),
            #     'scopes': scopes,
            #     'data': oauth_data,
            # },
        }

        return integration

    # def setup(self):
    #     from sentry.plugins import bindings
    #     bindings.add(
    #         'integration-repository.provider',
    #         GitlabRepositoryProvider,
    #         id='integrations:gitlab',
    #     )
