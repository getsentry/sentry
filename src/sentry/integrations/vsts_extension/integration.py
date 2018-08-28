from __future__ import absolute_import

from django.contrib import messages
from django.http import HttpResponseRedirect

from sentry.integrations.vsts.integration import (
    VstsIntegrationProvider, AccountConfigView,
)
from sentry.pipeline import PipelineView
from sentry.utils.http import absolute_uri


class VstsExtensionIntegrationProvider(VstsIntegrationProvider):
    key = 'vsts-extension'
    integration_key = 'vsts'

    # This is only to enable the VSTS -> Sentry installation flow, so we don't
    # want it to actually appear of the Integrations page.
    visible = False

    def get_pipeline_views(self):
        views = super(VstsExtensionIntegrationProvider, self).get_pipeline_views()
        views = [view for view in views if not isinstance(view, AccountConfigView)]
        views.append(VstsExtensionFinishedView())
        return views

    def build_integration(self, state):
        # Normally this is saved into the ``identity`` state, but for some
        # reason it gets wiped out in the NestedPipeline. Instead, we'll store
        # it in it's own key (``vsts``) to be used down the line in
        # ``VSTSOrganizationSelectionView``.
        state['account'] = {
            'AccountId': state['vsts']['AccountId'],
            'AccountName': state['vsts']['AccountName'],
        }

        state['instance'] = '{}.visualstudio.com'.format(
            state['vsts']['AccountName']
        )

        return super(
            VstsExtensionIntegrationProvider,
            self
        ).build_integration(state)


class VstsExtensionFinishedView(PipelineView):
    def dispatch(self, request, pipeline):
        pipeline.finish_pipeline()

        messages.add_message(request, messages.SUCCESS, 'VSTS Extension installed.')

        # TODO: replace with whatever we decide the finish step is.
        return HttpResponseRedirect(
            absolute_uri('/settings/{}/integrations/vsts-extension/{}/'.format(
                pipeline.organization.slug,
                pipeline.integration.id,
            ))
        )
