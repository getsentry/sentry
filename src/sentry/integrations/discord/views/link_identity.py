from django.core.signing import BadSignature, SignatureExpired
from django.http import HttpRequest, HttpResponse
from django.urls import reverse
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache

from sentry import analytics
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.types import ExternalProviders
from sentry.integrations.utils.identities import get_identity_or_404
from sentry.types.actor import ActorType
from sentry.users.models.identity import Identity
from sentry.utils.http import absolute_uri
from sentry.utils.signing import sign, unsign
from sentry.web.frontend.base import BaseView, control_silo_view
from sentry.web.helpers import render_to_response

from .constants import SALT


def build_linking_url(integration: RpcIntegration, discord_id: str) -> str:
    endpoint = "sentry-integration-discord-link-identity"
    kwargs = {
        "discord_id": discord_id,
        "integration_id": integration.id,
    }
    return absolute_uri(reverse(endpoint, kwargs={"signed_params": sign(salt=SALT, **kwargs)}))


@control_silo_view
class DiscordLinkIdentityView(BaseView):
    """
    Django view for linking user to Discord account.
    """

    @method_decorator(never_cache)
    def handle(self, request: HttpRequest, signed_params: str) -> HttpResponse:
        try:
            params = unsign(signed_params, salt=SALT)
        except (SignatureExpired, BadSignature):
            return render_to_response("sentry/integrations/discord/expired-link.html")

        organization, integration, idp = get_identity_or_404(
            ExternalProviders.DISCORD,
            request.user,
            integration_id=params["integration_id"],
        )

        if request.method != "POST":
            return render_to_response(
                "sentry/auth-link-identity.html",
                request=request,
                context={"organization": organization, "provider": integration.get_provider()},
            )

        Identity.objects.link_identity(user=request.user, idp=idp, external_id=params["discord_id"])  # type: ignore[arg-type]

        analytics.record(
            "integrations.discord.identity_linked",
            provider="discord",
            actor_id=request.user.id,
            actor_type=ActorType.USER,
        )
        return render_to_response(
            "sentry/integrations/discord/linked.html",
            request=request,
        )
