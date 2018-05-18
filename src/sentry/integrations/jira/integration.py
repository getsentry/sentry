from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.utils.translation import ugettext_lazy as _

from sentry.integrations import (
    Integration, IntegrationFeatures, IntegrationProvider, IntegrationMetadata
)
from sentry.integrations.issues import IssueSyncMixin

from .client import JiraApiClient


alert_link = {
    'text': 'Visit the **Atlassian Marketplace** to install this integration.',
    # TODO(jess): update this when we have our app listed on the
    # atlassian marketplace
    'link': 'https://marketplace.atlassian.com/',
}

metadata = IntegrationMetadata(
    description='Sync Sentry and JIRA issues.',
    author='The Sentry Team',
    noun=_('Instance'),
    issue_url='https://github.com/getsentry/sentry/issues/new?title=JIRA%20Integration:%20&labels=Component%3A%20Integrations',
    source_url='https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/jira',
    aspects={
        'alert_link': alert_link,
    },
)


class JiraIntegration(Integration, IssueSyncMixin):

    def get_link_issue_config(self, group, **kwargs):
        fields = super(JiraIntegration, self).get_link_issue_config(group, **kwargs)
        org = group.organization
        autocomplete_url = reverse(
            'sentry-extensions-jira-search', args=[org.slug, self.model.id],
        )
        for field in fields:
            if field['name'] == 'externalIssue':
                field['autocompleteUrl'] = autocomplete_url
        return fields

    def get_client(self):
        return JiraApiClient(
            self.model.metadata['base_url'],
            self.model.metadata['shared_secret'],
        )

    def get_issue(self, issue_id):
        client = self.get_client()
        issue = client.get_issue(issue_id)
        return {
            'title': issue['fields']['summary'],
            'description': issue['fields']['description'],
        }

    def create_comment(self, issue_id, comment):
        return self.get_client().create_comment(issue_id, comment)

    def search_issues(self, query):
        return self.get_client().search_issues(query)


class JiraIntegrationProvider(IntegrationProvider):
    key = 'jira'
    name = 'JIRA'
    metadata = metadata
    integration_cls = JiraIntegration

    features = frozenset([IntegrationFeatures.ISSUE_SYNC])

    can_add = False

    def get_pipeline_views(self):
        return []

    def build_integration(self, state):
        # Most information is not availabe during integration install time,
        # since the integration won't have been fully configired on JIRA's side
        # yet, we can't make API calls for more details like the server name or
        # Icon.
        return {
            'provider': 'jira',
            'external_id': state['clientKey'],
            'name': 'JIRA',
            'metadata': {
                'oauth_client_id': state['oauthClientId'],
                # public key is possibly deprecated, so we can maybe remove this
                'public_key': state['publicKey'],
                'shared_secret': state['sharedSecret'],
                'base_url': state['baseUrl'],
                'domain_name': state['baseUrl'].replace('https://', ''),
            },
        }
