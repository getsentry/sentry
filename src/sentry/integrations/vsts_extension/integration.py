from collections.abc import Mapping
from typing import Any

from django.contrib import messages
from django.http import HttpResponseRedirect
from django.http.request import HttpRequest
from django.http.response import HttpResponseBase
from rest_framework import serializers

from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
from sentry.integrations.base import IntegrationData
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.integrations.types import IntegrationProviderSlug
from sentry.integrations.vsts.integration import AccountConfigView, VstsIntegrationProvider
from sentry.pipeline.views.base import ApiPipelineSteps, PipelineView
from sentry.utils.http import absolute_uri

# Azure DevOps organization name rules: letters, numbers, or hyphens, starting
# and ending with an alphanumeric, up to 50 characters.
# https://learn.microsoft.com/en-us/azure/devops/organizations/accounts/rename-organization?view=azure-devops#rename-your-organization
VSTS_ACCOUNT_NAME_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9-]{0,48}[A-Za-z0-9]$"


class VstsExtensionInitialDataSerializer(CamelSnakeSerializer[dict[str, Any]]):
    """Initial pipeline data for Azure DevOps Marketplace installs.

    The Marketplace redirects to the configure link with `targetId` /
    `targetName` identifying the Azure DevOps organization the install was
    started from. The account is therefore already known: we validate the name
    and bind it to top-level pipeline state as `account` so the OAuth step can
    finish the install without an account-selection screen.
    """

    target_id = serializers.CharField()
    target_name = serializers.RegexField(
        VSTS_ACCOUNT_NAME_PATTERN,
        error_messages={"invalid": "Invalid targetName parameter"},
    )

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        return {
            "account": {
                "accountId": attrs["target_id"],
                "accountName": attrs["target_name"],
            }
        }


class VstsExtensionIntegrationProvider(VstsIntegrationProvider):
    key = "vsts-extension"
    integration_key = IntegrationProviderSlug.AZURE_DEVOPS.value

    can_add_externally = True

    # This is only to enable the VSTS -> Sentry installation flow, so we don't
    # want it to actually appear of the Integrations page.
    visible = False

    def get_pipeline_views(self) -> list[PipelineView[IntegrationPipeline]]:
        views = super().get_pipeline_views()
        views = [view for view in views if not isinstance(view, AccountConfigView)]
        views.append(VstsExtensionFinishedView())
        return views

    def get_pipeline_api_steps(self) -> ApiPipelineSteps[IntegrationPipeline]:
        # Unlike the main Azure DevOps provider, the account is already known
        # from the Marketplace params (bound to state as `account` by the
        # initial-data serializer), so there is no account-selection step.
        return [self._make_oauth_api_step()]

    def get_initial_data_serializer_cls(self) -> type[VstsExtensionInitialDataSerializer]:
        return VstsExtensionInitialDataSerializer

    def build_integration(self, state: Mapping[str, Any]) -> IntegrationData:
        # The API pipeline binds the account top-level via the initial-data
        # serializer; the legacy configure view binds it under the provider key.
        account = state.get("account") or {
            "accountId": state[IntegrationProviderSlug.AZURE_DEVOPS.value]["accountId"],
            "accountName": state[IntegrationProviderSlug.AZURE_DEVOPS.value]["accountName"],
        }
        return super().build_integration({**state, "account": account})


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
