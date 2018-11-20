from __future__ import absolute_import

import logging

from django import forms
from django.utils.translation import ugettext as _

from sentry.identity.pipeline import IdentityProviderPipeline
from sentry.integrations import (
    IntegrationFeatures, IntegrationProvider, IntegrationMetadata, FeatureDescription,
)
from sentry.integrations.jira import JiraIntegration
from sentry.pipeline import NestedPipelineView, PipelineView
from sentry.utils.http import absolute_uri
from sentry.web.helpers import render_to_response

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
    client_id = forms.CharField(
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


class InstallationGuideView(PipelineView):
    """
    Display a setup guide for creating an OAuth client in Jira
    """

    def dispatch(self, request, pipeline):
        if 'completed_guide' in request.GET:
            return pipeline.next_step()
        return render_to_response(
            template='sentry/integrations/jira-server-config.html',
            request=request,
        )


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


class JiraServerIntegration(JiraIntegration):
    pass


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

    def _make_identity_pipeline_view(self):
        """
        Make the nested identity provider view.

        It is important that this view is not constructed until we reach this step and the
        ``installation_data`` is available in the pipeline state. This
        method should be late bound into the pipeline views.
        """
        identity_pipeline_config = dict(
            redirect_url=absolute_uri('/extensions/jira_server/setup/'),
            **self.pipeline.fetch_state('installation_data')
        )

        return NestedPipelineView(
            bind_key='identity',
            provider_key='jira_server',
            pipeline_cls=IdentityProviderPipeline,
            config=identity_pipeline_config,
        )

    def get_pipeline_views(self):
        return [
            InstallationGuideView(),
            InstallationConfigView(),
            # lambda: self._make_identity_pipeline_view()
        ]

    def build_integration(self, state):
        # TODO complete OAuth
        # TODO(lb): This is wrong. Not currently operational.
        # this should be implemented.
        user = state['identity']['data']
        return {
            'provider': 'jira_server',
            'external_id': '%s:%s' % (state['base_url'], state['id']),
            'user_identity': {
                'type': 'jira_server',
                'external_id': '%s:%s' % (state['base_url'], user['id'])
            }
        }
