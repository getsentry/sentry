from django.contrib import messages
from django.http import HttpResponseRedirect
from django.http.response import HttpResponseBase
from django.urls import reverse
from django.utils.translation import gettext_lazy as _

from sentry.api.utils import generate_organization_url
from sentry.identity.pipeline import IdentityProviderPipeline
from sentry.integrations.github.integration import (
    INSTALLATION_CSRF_COOKIE_MAX_AGE_SECONDS,
    INSTALLATION_CSRF_COOKIE_NAME,
)
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.utils.http import absolute_uri, create_redirect_url
from sentry.web.frontend.base import BaseView

# The request doesn't contain the pipeline type (pipeline information is stored
# in redis keyed by the pipeline name), so we try to construct multiple pipelines
# and use whichever one works.
PIPELINE_CLASSES = [IntegrationPipeline, IdentityProviderPipeline]


from rest_framework.request import Request


class PipelineAdvancerView(BaseView):
    """Gets the current pipeline from the request and executes the current step."""

    auth_required = False

    csrf_protect = False

    def handle(self, request: Request, provider_id: str) -> HttpResponseBase:
        pipeline = None

        for pipeline_cls in PIPELINE_CLASSES:
            pipeline = pipeline_cls.get_for_request(request=request)
            if pipeline:
                break

        # GitHub apps may be installed directly from GitHub, in which case
        # they will redirect here *without* being in the pipeline. If that happens
        # redirect to the integration install org picker.
        if (
            provider_id == "github"
            and request.GET.get("setup_action") == "install"
            and pipeline is None
        ):
            installation_id = request.GET.get("installation_id")
            rv = self.redirect(
                reverse("integration-installation", args=[provider_id, installation_id])
            )
            rv.set_cookie(
                INSTALLATION_CSRF_COOKIE_NAME,
                str(request.user.id),
                max_age=INSTALLATION_CSRF_COOKIE_MAX_AGE_SECONDS,
                path="/",
                httponly=True,
            )
            return rv

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
