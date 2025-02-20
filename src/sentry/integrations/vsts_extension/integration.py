from collections.abc import Mapping, MutableMapping
from typing import Any

from django.contrib import messages
from django.http import HttpResponseRedirect
from django.http.response import HttpResponseBase
from rest_framework.request import Request

from sentry.integrations.vsts.integration import AccountConfigView, VstsIntegrationProvider
from sentry.pipeline import Pipeline, PipelineView
from sentry.utils.http import absolute_uri


class VstsExtensionIntegrationProvider(VstsIntegrationProvider):
    key = "vsts-extension"
    integration_key = "vsts"

    # This is only to enable the VSTS -> Sentry installation flow, so we don't
    # want it to actually appear of the Integrations page.
    visible = False

    def get_pipeline_views(self) -> list[PipelineView]:
        views = super().get_pipeline_views()
        views = [view for view in views if not isinstance(view, AccountConfigView)]
        views.append(VstsExtensionFinishedView())
        return views

    def build_integration(self, state: MutableMapping[str, Any]) -> Mapping[str, Any]:
        state["account"] = {
            "accountId": state["vsts"]["accountId"],
            "accountName": state["vsts"]["accountName"],
        }

        return super().build_integration(state)


class VstsExtensionFinishedView(PipelineView):
    def dispatch(self, request: Request, pipeline: Pipeline) -> HttpResponseBase:
        response = pipeline.finish_pipeline()

        integration = getattr(pipeline, "integration", None)
        if not integration:
            return response

        messages.add_message(request, messages.SUCCESS, "VSTS Extension installed.")

        return HttpResponseRedirect(
            absolute_uri(
                f"/settings/{pipeline.organization.slug}/integrations/vsts-extension/{integration.id}/"
            )
        )
