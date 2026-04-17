from collections.abc import Mapping
from typing import Any

from django.contrib import messages
from django.http import HttpResponseRedirect
from django.http.request import HttpRequest
from django.http.response import HttpResponseBase

from sentry.identity.pipeline import IdentityPipeline
from sentry.integrations.base import IntegrationData
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.integrations.types import IntegrationProviderSlug
from sentry.integrations.vsts.integration import VstsIntegrationProvider
from sentry.pipeline.views.base import PipelineView
from sentry.pipeline.views.nested import NestedPipelineView
from sentry.utils.http import absolute_uri


class VstsExtensionIntegrationProvider(VstsIntegrationProvider):
    key = "vsts-extension"
    integration_key = IntegrationProviderSlug.AZURE_DEVOPS.value

    # This is only to enable the VSTS -> Sentry installation flow, so we don't
    # want it to actually appear of the Integrations page.
    visible = False

    def get_pipeline_views(self) -> list[PipelineView[IntegrationPipeline]]:
        identity_pipeline_config = {
            "redirect_url": absolute_uri(self.oauth_redirect_url),
            "oauth_scopes": self.get_scopes(),
        }
        return [
            NestedPipelineView(
                bind_key="identity",
                provider_key=self.key,
                pipeline_cls=IdentityPipeline,
                config=identity_pipeline_config,
            ),
            VstsExtensionFinishedView(),
        ]

    def build_integration(self, state: Mapping[str, Any]) -> IntegrationData:
        return super().build_integration(
            {
                **state,
                "account": {
                    "accountId": state[IntegrationProviderSlug.AZURE_DEVOPS.value]["accountId"],
                    "accountName": state[IntegrationProviderSlug.AZURE_DEVOPS.value]["accountName"],
                },
            }
        )


class VstsExtensionFinishedView:
    def dispatch(self, request: HttpRequest, pipeline: IntegrationPipeline) -> HttpResponseBase:
        response = pipeline.finish_pipeline()

        integration = getattr(pipeline, "integration", None)
        if not integration:
            return response

        messages.add_message(request, messages.SUCCESS, "VSTS Extension installed.")

        assert pipeline.organization is not None
        return HttpResponseRedirect(
            absolute_uri(
                f"/settings/{pipeline.organization.slug}/integrations/vsts-extension/{integration.id}/"
            )
        )
