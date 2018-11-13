from __future__ import absolute_import

import logging

from django.utils.translation import ugettext as _

from sentry.integrations import (
    IntegrationFeatures, IntegrationProvider, IntegrationMetadata, FeatureDescription,
)
from sentry.integrations.jira import JiraIntegration

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


class JiraServerIntegration(JiraIntegration):
    pass


class JiraServerIntegrationProvider(IntegrationProvider):
    key = 'jira_server'
    name = 'Jira Server'
    metadata = metadata
    integration_cls = JiraIntegration

    features = frozenset([
        IntegrationFeatures.ISSUE_BASIC,
        IntegrationFeatures.ISSUE_SYNC
    ])

    can_add = False

    def get_pipeline_views(self):
        return []

    def build_integration(self, state):
        return {
            'provider': 'jira_server',
            'external_id': state['clientKey'],
            'name': 'Jira Server',  # TODO(lb): definitely wrong
            'metadata': {
                'oauth_client_id': state['oauthClientId'],
                'public_key': state['publicKey'],
                'shared_secret': state['sharedSecret'],
                'base_url': state['baseUrl'],
                'domain_name': state['baseUrl'].replace('https://', ''),
            },
        }
