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
