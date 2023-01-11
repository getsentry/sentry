from django.urls import reverse
from django.views.decorators.cache import never_cache
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.identity.pipeline import IdentityProviderPipeline
from sentry.models import IdentityProvider
from sentry.web.frontend.base import ControlSiloOrganizationView
from sentry.web.helpers import render_to_response


class AccountIdentityAssociateView(ControlSiloOrganizationView):
    @never_cache
    def handle(self, request: Request, organization, provider_key, external_id) -> Response:
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
