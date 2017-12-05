from __future__ import absolute_import

from django.http import HttpResponse
from sentry.integrations import Integration
from sentry.utils.pipeline import PipelineView


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


class ExampleIntegration(Integration):
    """
    An example integration, generally used for testing.
    """
    key = 'example'

    name = 'Example'

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
