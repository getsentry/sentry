from django.http.response import HttpResponseBase
from django.urls import reverse
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework.request import Request

from sentry.identity.pipeline import IdentityProviderPipeline
from sentry.models.identity import IdentityProvider
from sentry.web.frontend.base import ControlSiloOrganizationView, control_silo_view
from sentry.web.helpers import render_to_response


@control_silo_view
class AccountIdentityAssociateView(ControlSiloOrganizationView):
    @method_decorator(never_cache)
    def handle(self, request: Request, organization, provider_key, external_id) -> HttpResponseBase:
        try:
            provider_model = IdentityProvider.objects.get(
                type=provider_key, external_id=external_id
            )
        except IdentityProvider.DoesNotExist:
            return self.redirect(reverse("sentry-account-settings-identities"))

        pipeline = IdentityProviderPipeline(
            organization=organization,
            provider_key=provider_key,
            provider_model=provider_model,
            request=request,
        )

        if request.method != "POST" and not pipeline.is_valid():
            context = {"provider": pipeline.provider, "organization": organization}
            return render_to_response("sentry/auth-link-identity.html", context, request)

        pipeline.initialize()

        return pipeline.current_step()
