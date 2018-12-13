from __future__ import absolute_import

import logging
import six

from django import forms
from django.core.urlresolvers import reverse
from django.utils.translation import ugettext as _
from django.views.decorators.csrf import csrf_exempt
from six.moves.urllib.parse import urlparse

from sentry.integrations import (
    IntegrationFeatures,
    IntegrationProvider,
    IntegrationMetadata,
    FeatureDescription,
)
from sentry.integrations.client import ApiError
from sentry.integrations.exceptions import IntegrationError
from sentry.integrations.jira import JiraIntegration
from sentry.pipeline import PipelineView
from sentry.utils.hashlib import sha1_text
from sentry.web.helpers import render_to_response
from sentry.integrations.jira.client import JiraApiClient
from .client import JiraServer, JiraServerSetupClient


logger = logging.getLogger('sentry.integrations.jira_server')

DESCRIPTION = """
Connect your Sentry organization into one or more of your Jira Server instances.
Get started streamlining your bug squashing workflow by unifying your Sentry and
Jira instances together.
"""

FEATURE_DESCRIPTIONS = [
    FeatureDescription(
        """
        Create and link Sentry issue groups directly to a Jira ticket in any of your
        projects, providing a quick way to jump from Sentry bug to tracked ticket!
        """,
        IntegrationFeatures.ISSUE_BASIC,
    ),
    FeatureDescription(
        """
        Automatically synchronize assignees to and from Jira. Don't get confused
        who's fixing what, let us handle ensuring your issues and tickets match up
        to your Sentry and Jira assignees.
        """,
        IntegrationFeatures.ISSUE_SYNC,
    ),
    FeatureDescription(
        """
        Synchronize Comments on Sentry Issues directly to the linked Jira ticket.
        """,
        IntegrationFeatures.ISSUE_SYNC,
    ),
]


metadata = IntegrationMetadata(
    description=_(DESCRIPTION.strip()),
    features=FEATURE_DESCRIPTIONS,
    author='The Sentry Team',
    noun=_('Instance'),
    issue_url='https://github.com/getsentry/sentry/issues/new?title=Jira%20Server%20Integration:%20&labels=Component%3A%20Integrations',
    source_url='https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/jira_server',
    aspects={},
)


class InstallationForm(forms.Form):
    url = forms.CharField(
        label=_('Jira URL'),
        help_text=_('The base URL for your Jira Server instance, including the host and protocol.'),
        widget=forms.TextInput(
            attrs={'placeholder': 'https://jira.example.com'}
        ),
    )
    verify_ssl = forms.BooleanField(
        label=_('Verify SSL'),
        help_text=_('By default, we verify SSL certificates '
                    'when making requests to your Jira instance.'),
        widget=forms.CheckboxInput(),
        required=False,
        initial=True
    )
    consumer_key = forms.CharField(
        label=_('Jira Consumer Key'),
        widget=forms.TextInput(
            attrs={'placeholder': _(
                'sentry-consumer-key')}
        )
    )
    private_key = forms.CharField(
        label=_('Jira Consumer Private Key'),
        widget=forms.Textarea(
            attrs={'placeholder': _('--PRIVATE KEY--')}
        )
    )

    def clean_url(self):
        """Strip off trailing / as they cause invalid URLs downstream"""
        return self.cleaned_data['url'].rstrip('/')


class InstallationConfigView(PipelineView):
    """
    Collect the OAuth client credentials from the user.
    """

    def dispatch(self, request, pipeline):
        if request.method == 'POST':
            form = InstallationForm(request.POST)
            if form.is_valid():
                form_data = form.cleaned_data

                pipeline.bind_state('installation_data', form_data)
                return pipeline.next_step()
        else:
            form = InstallationForm()

        return render_to_response(
            template='sentry/integrations/jira-server-config.html',
            context={
                'form': form,
            },
            request=request,
        )


class OAuthLoginView(PipelineView):
    """
    Start the OAuth dance by creating a request token
    and redirecting the user to approve it.
    """
    @csrf_exempt
    def dispatch(self, request, pipeline):
        if 'oauth_token' in request.GET:
            return pipeline.next_step()

        config = pipeline.fetch_state('installation_data')
        client = JiraServerSetupClient(
            config.get('url'),
            config.get('consumer_key'),
            config.get('private_key'),
            config.get('verify_ssl'),
        )
        try:
            request_token = client.get_request_token()
            pipeline.bind_state('request_token', request_token)
            authorize_url = client.get_authorize_url(request_token)

            return self.redirect(authorize_url)
        except ApiError as error:
            logger.info('identity.jira-server.request-token', extra={'error': error})
            return pipeline.error('Could not fetch a request token from Jira')


class OAuthCallbackView(PipelineView):
    """
    Complete the OAuth dance by exchanging our request token
    into an access token.
    """
    @csrf_exempt
    def dispatch(self, request, pipeline):
        config = pipeline.fetch_state('installation_data')
        client = JiraServerSetupClient(
            config.get('url'),
            config.get('consumer_key'),
            config.get('private_key'),
            config.get('verify_ssl'),
        )

        try:
            access_token = client.get_access_token(
                pipeline.fetch_state('request_token'),
                request.GET['oauth_token']
            )
            pipeline.bind_state('access_token', access_token)

            return pipeline.next_step()
        except ApiError as error:
            logger.info('identity.jira-server.access-token', extra={'error': error})
            return pipeline.error('Could not fetch an access token from Jira')


class JiraServerIntegration(JiraIntegration):
    """
    IntegrationInstallation implementation for Jira-Server
    """
    default_identity = None

    def get_client(self):
        if self.default_identity is None:
            self.default_identity = self.get_default_identity()

        return JiraApiClient(
            self.model.metadata['base_url'],
            JiraServer(self.default_identity.data),
            self.model.metadata['verify_ssl'])

    def get_link_issue_config(self, group, **kwargs):
        fields = super(JiraIntegration, self).get_link_issue_config(group, **kwargs)
        org = group.organization
        autocomplete_url = reverse(
            'sentry-extensions-jiraserver-search', args=[org.slug, self.model.id],
        )
        for field in fields:
            if field['name'] == 'externalIssue':
                field['url'] = autocomplete_url
                field['type'] = 'select'
        return fields

    def search_url(self, org_slug):
        return reverse(
            'sentry-extensions-jiraserver-search', args=[org_slug, self.model.id]
        )


class JiraServerIntegrationProvider(IntegrationProvider):
    key = 'jira_server'
    name = 'Jira Server'
    metadata = metadata
    integration_cls = JiraServerIntegration

    needs_default_identity = True

    can_add = True

    features = frozenset([
        IntegrationFeatures.ISSUE_BASIC,
        IntegrationFeatures.ISSUE_SYNC
    ])

    setup_dialog_config = {
        'width': 1030,
        'height': 1000,
    }

    def get_pipeline_views(self):
        return [
            InstallationConfigView(),
            OAuthLoginView(),
            OAuthCallbackView(),
        ]

    def build_integration(self, state):
        install = state['installation_data']
        access_token = state['access_token']

        hostname = urlparse(install['url']).netloc
        external_id = '%s:%s' % (hostname, install['consumer_key'])
        webhook_secret = sha1_text(install['private_key']).hexdigest()

        credentials = {
            'consumer_key': install['consumer_key'],
            'private_key': install['private_key'],
            'access_token': access_token['oauth_token'],
            'access_token_secret': access_token['oauth_token_secret'],
        }
        # Create the webhook before the integration record exists
        # so that if it fails we don't persist a broken integration.
        self.create_webhook(external_id, webhook_secret, install, credentials)

        return {
            'name': install['consumer_key'],
            'provider': 'jira_server',
            'external_id': external_id,
            'metadata': {
                'base_url': install['url'],
                'domain_name': hostname,
                'verify_ssl': install['verify_ssl'],
                'webhook_secret': webhook_secret,
            },
            'user_identity': {
                'type': 'jira_server',
                'external_id': external_id,
                'scopes': [],
                'data': credentials
            }
        }

    def create_webhook(self, external_id, webhook_secret, install, credentials):
        client = JiraServerSetupClient(
            install['url'],
            install['consumer_key'],
            install['private_key'],
            install['verify_ssl']
        )
        try:
            client.create_issue_webhook(external_id, webhook_secret, credentials)
        except ApiError as err:
            logger.info('jira-server.webhook.failed', extra={
                'error': six.text_type(err),
                'external_id': external_id,
            })
            try:
                details = err.json['messages'][0].values().pop()
            except Exception:
                details = ''
            message = u'Could not create issue webhook in Jira. {}'.format(details)
            raise IntegrationError(message)
