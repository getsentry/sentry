from __future__ import absolute_import

import logging


from django.core.urlresolvers import reverse
from django.utils.translation import ugettext as _

from sentry import features
from sentry.integrations import (
    IntegrationInstallation, IntegrationFeatures, IntegrationProvider, IntegrationMetadata, FeatureDescription,
)
from sentry.integrations.exceptions import ApiError, IntegrationError
from sentry.models import IntegrationExternalProject, Organization
from sentry.utils.http import absolute_uri

from .client import JiraApiClient, JiraCloud
from .field_builder import JiraFieldBuilder
from .issues import JiraIssueSync

logger = logging.getLogger('sentry.integrations.jira')  # not used here anymore

DESCRIPTION = """
Connect your Sentry organization into one or more of your Jira cloud instances.
Get started streamlining your bug squashing workflow by unifying your Sentry and
Jira instances together.
"""

FEATURE_DESCRIPTIONS = [
    FeatureDescription(
        """
        Create and link Sentry issue groups directly to a Jira ticket in any of your
        projects, providing a quick way to jump from a Sentry bug to tracked ticket!
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

INSTALL_NOTICE_TEXT = """
Visit the Jira Marketplace to install this integration. After installing the
Sentry add-on, access the settings panel in your Jira instance to enable the
integration for this Organization.
"""

external_install = {
    'url': 'https://marketplace.atlassian.com/apps/1219432/sentry-for-jira',
    'buttonText': _('Jira Marketplace'),
    'noticeText': _(INSTALL_NOTICE_TEXT.strip()),
}

metadata = IntegrationMetadata(
    description=_(DESCRIPTION.strip()),
    features=FEATURE_DESCRIPTIONS,
    author='The Sentry Team',
    noun=_('Instance'),
    issue_url='https://github.com/getsentry/sentry/issues/new?title=Jira%20Integration:%20&labels=Component%3A%20Integrations',
    source_url='https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/jira',
    aspects={
        'externalInstall': external_install,
    },
)


class JiraIntegration(IntegrationInstallation, JiraFieldBuilder, JiraIssueSync):
    comment_key = 'sync_comments'
    outbound_status_key = 'sync_status_forward'
    inbound_status_key = 'sync_status_reverse'
    outbound_assignee_key = 'sync_forward_assignment'
    inbound_assignee_key = 'sync_reverse_assignment'

    def get_organization_config(self):
        configuration = [
            {
                'name': self.outbound_status_key,
                'type': 'choice_mapper',
                'label': _('Sync Sentry Status to Jira'),
                'help': _('When a Sentry issue changes status, change the status of the linked ticket in Jira.'),
                'addButtonText': _('Add Jira Project'),
                'addDropdown': {
                    'emptyMessage': _('All projects configured'),
                    'noResultsMessage': _('Could not find Jira project'),
                    'items': [],  # Populated with projects
                },
                'mappedSelectors': {
                    'on_resolve': {'choices': [], 'placeholder': _('Select a status')},
                    'on_unresolve': {'choices': [], 'placeholder': _('Select a status')},
                },
                'columnLabels': {
                    'on_resolve': _('When resolved'),
                    'on_unresolve': _('When unresolved'),
                },
                'mappedColumnLabel': _('Jira Project'),
            },
            {
                'name': self.outbound_assignee_key,
                'type': 'boolean',
                'label': _('Sync Sentry Assignment to Jira'),
                'help': _('When an issue is assigned in Sentry, assign its linked Jira ticket to the same user.'),
            },
            {
                'name': self.comment_key,
                'type': 'boolean',
                'label': _('Sync Sentry Comments to Jira'),
                'help': _('Post comments from Sentry issues to linked Jira tickets'),
            },
            {
                'name': self.inbound_status_key,
                'type': 'boolean',
                'label': _('Sync Jira Status to Sentry'),
                'help': _('When a Jira ticket is marked done, resolve its linked issue in Sentry. '
                          'When a Jira ticket is removed from being done, unresolve its linked Sentry issue.'),
            },
            {
                'name': self.inbound_assignee_key,
                'type': 'boolean',
                'label': _('Sync Jira Assignment to Sentry'),
                'help': _('When a ticket is assigned in Jira, assign its linked Sentry issue to the same user.'),
            },
        ]

        client = self.get_client()

        try:
            statuses = [(c['id'], c['name']) for c in client.get_valid_statuses()]
            configuration[0]['mappedSelectors']['on_resolve']['choices'] = statuses
            configuration[0]['mappedSelectors']['on_unresolve']['choices'] = statuses

            projects = [{'value': p['id'], 'label': p['name']} for p in client.get_projects_list()]
            configuration[0]['addDropdown']['items'] = projects
        except ApiError:
            configuration[0]['disabled'] = True
            configuration[0]['disabledReason'] = _(
                'Unable to communicate with the Jira instance. You may need to reinstall the addon.')

        organization = Organization.objects.get(id=self.organization_id)
        has_issue_sync = features.has('organizations:integrations-issue-sync',
                                      organization)
        if not has_issue_sync:
            for field in configuration:
                field['disabled'] = True
                field['disabledReason'] = _(
                    'Your organization does not have access to this feature'
                )

        return configuration

    def update_organization_config(self, data):
        """
        Update the configuration field for an organization integration.
        """
        config = self.org_integration.config

        if 'sync_status_forward' in data:
            project_mappings = data.pop('sync_status_forward')

            if any(not mapping['on_unresolve'] or not mapping['on_resolve']
                    for mapping in project_mappings.values()):
                raise IntegrationError('Resolve and unresolve status are required.')

            data['sync_status_forward'] = bool(project_mappings)

            IntegrationExternalProject.objects.filter(
                organization_integration_id=self.org_integration.id,
            ).delete()

            for project_id, statuses in project_mappings.items():
                IntegrationExternalProject.objects.create(
                    organization_integration_id=self.org_integration.id,
                    external_id=project_id,
                    resolved_status=statuses['on_resolve'],
                    unresolved_status=statuses['on_unresolve'],
                )

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

    def sync_metadata(self):
        client = self.get_client()

        try:
            server_info = client.get_server_info()
            projects = client.get_projects_list()
        except ApiError as e:
            raise IntegrationError(self.message_from_error(e))

        self.model.name = server_info['serverTitle']

        # There is no Jira instance icon (there is a favicon, but it doesn't seem
        # possible to query that with the API). So instead we just use the first
        # project Icon.
        if len(projects) > 0:
            avatar = projects[0]['avatarUrls']['48x48'],
            self.model.metadata.update({'icon': avatar})

        self.model.save()

    def get_persisted_default_config_fields(self):
        return ['project', 'issuetype', 'priority']

    def get_group_description(self, group, event, **kwargs):
        output = [
            u'Sentry Issue: [{}|{}]'.format(
                group.qualified_short_id,
                absolute_uri(group.get_absolute_url(params={'referrer': 'jira_integration'})),
            )
        ]
        body = self.get_group_body(group, event)
        if body:
            output.extend([
                '',
                '{code}',
                body,
                '{code}',
            ])
        return '\n'.join(output)

    def get_client(self):
        return JiraApiClient(
            self.model.metadata['base_url'],
            JiraCloud(self.model.metadata['shared_secret']),
            verify_ssl=True
        )

    def error_message_from_json(self, data):
        message = ''
        if data.get('errorMessages'):
            message = ' '.join(data['errorMessages'])
        if data.get('errors'):
            if message:
                message += ' '
            message += ' '.join(['%s: %s' % (k, v) for k, v in data.get('errors').items()])
        return message

    def error_fields_from_json(self, data):
        errors = data.get('errors')
        if not errors:
            return None

        return {key: [error] for key, error in data.get('errors').items()}

    def search_url(self, org_slug):
        """
        Hook method that varies in Jira Server
        """
        return reverse(
            'sentry-extensions-jira-search', args=[org_slug, self.model.id]
        )


class JiraIntegrationProvider(IntegrationProvider):
    key = 'jira'
    name = 'Jira'
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
