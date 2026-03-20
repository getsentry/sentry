from urllib.parse import parse_qs

from django.contrib import messages
from django.http import HttpRequest, HttpResponse, HttpResponseRedirect
from django.http.response import HttpResponseBase
from django.urls import reverse
from django.utils.translation import gettext_lazy as _

from sentry import features
from sentry.identity.pipeline import IdentityPipeline
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.integrations.types import IntegrationProviderSlug
from sentry.organizations.absolute_url import generate_organization_url
from sentry.utils.http import absolute_uri, create_redirect_url
from sentry.utils.json import dumps_htmlsafe
from sentry.web.frontend.base import BaseView, all_silo_view

# The request doesn't contain the pipeline type (pipeline information is stored
# in redis keyed by the pipeline name), so we try to construct multiple pipelines
# and use whichever one works.
PIPELINE_CLASSES = (IntegrationPipeline, IdentityPipeline)

TRAMPOLINE_HTML = """\
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body
    style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
    flex-direction:column;padding:2rem">
<script type="module">
  const data = {data_json};
  if (window.opener) {{
    window.opener.postMessage(data, {origin});
    window.close();
  }} else {{
    document.getElementById("fallback").style.display = "flex";
  }}
</script>
<div id="fallback" style="display:none;flex-direction:column;align-items:center;gap:1.5rem;max-width:600px">
  <p style="font-size:1.1rem;margin:0">Unable to continue. Please restart the flow.</p>
</div>
</body>
</html>"""


def _render_trampoline(request: HttpRequest, pipeline: object) -> HttpResponse:
    """Render a minimal page that posts callback params back to the opener."""
    params: dict[str, str] = {"source": "sentry-pipeline"}
    for key, values in parse_qs(request.META.get("QUERY_STRING", "")).items():
        if values:
            params[key] = values[0]

    data_json = dumps_htmlsafe(params)

    # In multi-region the opener may be on a different origin (e.g.
    # org-slug.sentry.io) than the trampoline (sentry.io/extensions/...),
    # so we need the org-specific URL. In single-region document.origin works.
    if features.has("system:multi-region"):
        org = getattr(pipeline, "organization", None)
        origin = dumps_htmlsafe(generate_organization_url(org.slug if org else ""))
    else:
        origin = "document.origin"

    return HttpResponse(
        TRAMPOLINE_HTML.format(data_json=data_json, origin=origin),
        content_type="text/html",
    )


@all_silo_view
class PipelineAdvancerView(BaseView):
    """
    Gets the current pipeline from the request and executes the current step.

    External services (e.g. GitHub OAuth) redirect back to this view after the
    user completes an action. For legacy template-driven pipelines this view
    processes the callback server-side via pipeline.current_step().

    For API-driven pipelines (is_api_mode) this view does NOT process the
    callback. Instead it renders a lightweight trampoline page that relays the
    callback URL query params (code, state, installation_id, etc.) back to the
    opener window via postMessage and closes itself. The frontend is
    responsible for POSTing those params to the pipeline API endpoint to
    advance the pipeline.
    """

    auth_required = False

    csrf_protect = False

    def handle(self, request: HttpRequest, provider_id: str) -> HttpResponseBase:
        pipeline = None

        for pipeline_cls in PIPELINE_CLASSES:
            pipeline = pipeline_cls.get_for_request(request=request)
            if pipeline:
                break

        # GitHub apps may be installed directly from GitHub, in which case
        # they will redirect here *without* being in the pipeline. If that happens
        # redirect to the integration install org picker.
        if (
            provider_id == IntegrationProviderSlug.GITHUB.value
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

        # If the pipeline was initiated via the API, render a trampoline page
        # that relays the callback params back to the opener window via
        # postMessage instead of processing the callback server-side.
        if pipeline.is_api_mode:
            return _render_trampoline(request, pipeline)

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
