from django.contrib import messages
from django.http import HttpResponseRedirect
from django.urls import reverse
from django.utils.translation import ugettext_lazy as _

from sentry.api.utils import generate_organization_url
from sentry.identity.pipeline import IdentityProviderPipeline
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.utils.http import absolute_uri, create_redirect_url
from sentry.web.decorators import transaction_start
from sentry.web.frontend.base import BaseView

# The request doesn't contain the pipeline type (pipeline information is stored
# in redis keyed by the pipeline name), so we try to construct multiple pipelines
# and use whichever one works.
PIPELINE_CLASSES = [IntegrationPipeline, IdentityProviderPipeline]


# GitHub apps may be installed directly from GitHub, in which case
# they will redirect here *without* being in the pipeline. If that happens
# redirect to the integration install org picker.
FORWARD_INSTALL_FOR = ["github"]


from rest_framework.request import Request
from rest_framework.response import Response


class PipelineAdvancerView(BaseView):
    """Gets the current pipeline from the request and executes the current step."""

    auth_required = False

    csrf_protect = False

    @transaction_start("PipelineAdvancerView")
    def handle(self, request: Request, provider_id: str) -> Response:
        pipeline = None

        for pipeline_cls in PIPELINE_CLASSES:
            pipeline = pipeline_cls.get_for_request(request=request)
            if pipeline:
                break

        if (
            provider_id in FORWARD_INSTALL_FOR
            and request.GET.get("setup_action") == "install"
            and pipeline is None
        ):
            installation_id = request.GET.get("installation_id")
            return self.redirect(
                reverse("integration-installation", args=[provider_id, installation_id])
            )

        if pipeline is None or not pipeline.is_valid():
            messages.add_message(request, messages.ERROR, _("Invalid request."))
            return self.redirect("/")

        subdomain = pipeline.fetch_state("subdomain")
        if subdomain is not None and request.subdomain != subdomain:
            url_prefix = generate_organization_url(subdomain)
            redirect_url = absolute_uri(
                reverse("sentry-extension-setup", kwargs={"provider_id": provider_id}),
                url_prefix=url_prefix,
            )
            return HttpResponseRedirect(create_redirect_url(request, redirect_url))

        response = pipeline.current_step()
        return response
