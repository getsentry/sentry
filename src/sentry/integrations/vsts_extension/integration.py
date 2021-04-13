from django.contrib import messages
from django.http import HttpResponseRedirect

from sentry.integrations.vsts.integration import AccountConfigView, VstsIntegrationProvider
from sentry.pipeline import PipelineView
from sentry.utils.http import absolute_uri


class VstsExtensionIntegrationProvider(VstsIntegrationProvider):
    key = "vsts-extension"
    integration_key = "vsts"

    # This is only to enable the VSTS -> Sentry installation flow, so we don't
    # want it to actually appear of the Integrations page.
    visible = False

    def get_pipeline_views(self):
        views = super().get_pipeline_views()
        views = [view for view in views if not isinstance(view, AccountConfigView)]
        views.append(VstsExtensionFinishedView())
        return views

    def build_integration(self, state):
        state["account"] = {
            "accountId": state["vsts"]["accountId"],
            "accountName": state["vsts"]["accountName"],
        }

        return super().build_integration(state)


class VstsExtensionFinishedView(PipelineView):
    def dispatch(self, request, pipeline):
        pipeline.finish_pipeline()

        messages.add_message(request, messages.SUCCESS, "VSTS Extension installed.")

        return HttpResponseRedirect(
            absolute_uri(
                f"/settings/{pipeline.organization.slug}/integrations/vsts-extension/{pipeline.integration.id}/"
            )
        )
