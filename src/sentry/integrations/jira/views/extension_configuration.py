import orjson
from django.core.signing import BadSignature, SignatureExpired
from django.http import HttpRequest
from django.http.response import HttpResponseBase

from sentry import features
from sentry.hybridcloud.services.organization_mapping.model import RpcOrganizationMapping
from sentry.integrations.types import IntegrationProviderSlug
from sentry.integrations.web.integration_extension_configuration import (
    IntegrationExtensionConfigurationView,
)
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.utils.signing import unsign
from sentry.web.frontend.base import control_silo_view

from . import SALT

# 24 hours to finish installation
INSTALL_EXPIRATION_TIME = 60 * 60 * 24


@control_silo_view
class JiraExtensionConfigurationView(IntegrationExtensionConfigurationView):
    """
    Handle the UI for adding the Jira integration to a Sentry org.
    """

    provider = IntegrationProviderSlug.JIRA.value
    external_provider_key = IntegrationProviderSlug.JIRA.value

    def post(self, request: HttpRequest, *args, **kwargs) -> HttpResponseBase:
        return self._handle_request(request, *args, **kwargs)

    def _dispatch_pipeline(
        self,
        request: HttpRequest,
        organization: RpcOrganization | RpcOrganizationMapping,
        params: dict,
    ) -> HttpResponseBase:
        if not features.has(
            "organizations:jira-confirm-installation", organization, actor=request.user
        ):
            return super()._dispatch_pipeline(request, organization, params)

        # to protect against CSRF attacks, show a confirmation page that lists the jira org and sentry org
        if request.method == "POST":
            return super()._dispatch_pipeline(request, organization, params)
        try:
            state = self.map_params_to_state(params)
        except SignatureExpired:
            return self.respond(
                "sentry/pipeline-error.html",
                {"error": "Installation link expired"},
            )
        except (BadSignature, KeyError, ValueError):
            return self.respond(
                "sentry/pipeline-error.html",
                {"error": "Invalid installation link"},
            )

        metadata = state.get("metadata") or {}
        return self.respond(
            "sentry/integrations/jira-confirm.html",
            {
                "organization_name": organization.name,
                "organization_slug": organization.slug,
                "jira_base_url": metadata.get("base_url", ""),
                "form_action": request.get_full_path(),
            },
        )

    def map_params_to_state(self, original_params):
        # decode the signed params and add them to whatever params we have
        params = original_params.copy()
        signed_params = params.pop("signed_params", {})
        params.update(
            unsign(
                signed_params,
                max_age=INSTALL_EXPIRATION_TIME,
                salt=SALT,
            )
        )
        params["metadata"] = orjson.loads(params["metadata"])
        return params
