import logging

from django.http import Http404, HttpRequest
from django.http.response import HttpResponseBase

from sentry.integrations.pipeline import IntegrationPipelineError, initialize_integration_pipeline
from sentry.web.frontend.base import ControlSiloOrganizationView, control_silo_view
from sentry.web.helpers import render_to_response

logger = logging.getLogger("sentry.integrations")


@control_silo_view
class OrganizationIntegrationSetupView(ControlSiloOrganizationView):
    required_scope = "org:integrations"

    csrf_protect = False

    def handle(self, request: HttpRequest, organization, provider_id) -> HttpResponseBase:
        try:
            pipeline = initialize_integration_pipeline(request, organization, provider_id)
        except IntegrationPipelineError as e:
            if e.not_found:
                raise Http404
            return render_to_response(
                "sentry/pipeline-provider-error.html", {"error": str(e)}, request
            )

        return pipeline.current_step()
