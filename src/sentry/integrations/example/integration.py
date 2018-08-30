from __future__ import absolute_import

from django.http import HttpResponse
from sentry.integrations import (
    Integration, IntegrationFeatures, IntegrationMetadata, IntegrationProvider
)
from sentry.integrations.exceptions import IntegrationError
from sentry.integrations.issues import IssueSyncMixin
from sentry.pipeline import PipelineView


class ExampleSetupView(PipelineView):
    TEMPLATE = """
        <form method="POST">
            <p>This is an example integration configuration page.</p>
            <p><label>Integration Name:</label></p>
            <p><input type="name" name="name" /></p>
            <p><input type="submit" value="Continue" /></p>
        </form>
    """

    def dispatch(self, request, pipeline):
        if 'name' in request.POST:
            pipeline.bind_state('name', request.POST['name'])
            return pipeline.next_step()

        return HttpResponse(self.TEMPLATE)


DESCRIPTION = """
This is an example integration

 * Descriptions support _markdown rendering_.
"""

metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    author='The Sentry Team',
    noun='example',
    issue_url='https://github.com/getsentry/sentry/issues/new',
    source_url='https://github.com/getsentry/sentry',
    aspects={},
)


class ExampleIntegration(Integration, IssueSyncMixin):
    comment_key = 'sync_comments'
    outbound_status_key = 'sync_status_outbound'
    inbound_status_key = 'sync_status_inbound'
    outbound_assignee_key = 'sync_assignee_outbound'
    inbound_assignee_key = 'sync_assignee_inbound'

    def get_issue_url(self, key):
        return 'https://example/issues/{}'.format(key)

    def create_comment(self):
        pass

    def create_issue(self, data, **kwargs):
        if 'assignee' not in data:
            raise IntegrationError('Assignee is required')
        return {
            'key': 'APP-123',
            'title': 'This is a test external issue title',
            'description': 'This is a test external issue description',
        }

    def get_issue(self, issue_id, **kwargs):
        return {
            'key': issue_id,
            'title': 'This is a test external issue title',
            'description': 'This is a test external issue description',
        }

    def sync_assignee_outbound(self, external_issue, user, assign=True, **kwargs):
        pass

    def sync_status_outbound(self, external_issue, is_resolved, project_id):
        pass

    def should_unresolve(self, data):
        return data['status']['category'] != 'done'

    def should_resolve(self, data):
        return data['status']['category'] == 'done'

    def get_issue_display_name(self, external_issue):
        return 'display name: %s' % external_issue.key


class ExampleIntegrationProvider(IntegrationProvider):
    """
    An example integration, generally used for testing.
    """
    key = 'example'
    name = 'Example'
    metadata = metadata

    integration_cls = ExampleIntegration

    features = frozenset([IntegrationFeatures.ISSUE_SYNC])

    def get_pipeline_views(self):
        return [
            ExampleSetupView(),
        ]

    def get_config(self):
        return [{
            'name': 'name',
            'label': 'Name',
            'type': 'text',
            'required': True,
        }]

    def build_integration(self, state):
        return {
            'external_id': state['name'],
        }

    def setup(self):
        """
        Executed once Sentry has been initialized at runtime.

        >>> def setup(self):
        >>>     bindings.add('repository.provider', GitHubRepositoryProvider, key='github')
        """


class AliasedIntegration(ExampleIntegration):
    pass


class AliasedIntegrationProvider(ExampleIntegrationProvider):
    key = 'aliased'
    integration_key = 'example'
    name = 'Integration Key Example'
