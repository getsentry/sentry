from __future__ import absolute_import

from django.http import HttpResponse
from sentry.integrations import Integration, PipelineView


class ExampleSetupView(PipelineView):
    TEMPLATE = """
        <form method="POST">
            <p>This is an example integration configuration page.</p>
            <p><label>Integration Name:</label></p>
            <p><input type="name" name="name" /></p>
            <p><input type="submit" value="Continue" /></p>
        </form>
    """

    def dispatch(self, request, helper):
        if 'name' in request.POST:
            helper.bind_state('name', request.POST['name'])
            return helper.next_step()

        return HttpResponse(self.TEMPLATE)


class ExampleIntegration(Integration):
    """
    An example integration, generally used for testing.
    """
    key = 'example'

    name = 'Example'

    def get_pipeline(self):
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
