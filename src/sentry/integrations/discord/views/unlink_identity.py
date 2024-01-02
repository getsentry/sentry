from django.core.signing import BadSignature, SignatureExpired
from django.db import IntegrityError
from django.http import Http404, HttpResponse
from django.urls import reverse
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework.request import Request

from sentry import analytics
from sentry.integrations.utils.identities import get_identity_or_404
from sentry.models.identity import Identity
from sentry.services.hybrid_cloud.actor import ActorType
from sentry.services.hybrid_cloud.integration.model import RpcIntegration
from sentry.types.integrations import ExternalProviders
from sentry.utils.http import absolute_uri
from sentry.utils.signing import sign, unsign
from sentry.web.decorators import transaction_start
from sentry.web.frontend.base import BaseView, control_silo_view
from sentry.web.helpers import render_to_response

from ..utils import logger


def build_unlinking_url(integration: RpcIntegration, discord_id: str) -> str:
    endpoint = "sentry-integration-discord-unlink-identity"
    kwargs = {
        "discord_id": discord_id,
        "integration_id": integration.id,
    }
    return absolute_uri(reverse(endpoint, kwargs={"signed_params": sign(**kwargs)}))


@control_silo_view
class DiscordUnlinkIdentityView(BaseView):
    """
    Django view for unlinking user from Discord account.
    """

    @transaction_start("DiscordUnlinkIdentityView")
    @method_decorator(never_cache)
    def handle(self, request: Request, signed_params: str) -> HttpResponse:
        try:
            params = unsign(signed_params)
        except (SignatureExpired, BadSignature):
            return render_to_response("sentry/integrations/discord/expired-link.html")

        organization, integration, idp = get_identity_or_404(
            ExternalProviders.DISCORD,
            request.user,
            integration_id=params["integration_id"],
        )

        if request.method != "POST":
            return render_to_response(
                "sentry/auth-unlink-identity.html",
                request=request,
                context={"organization": organization, "provider": integration.get_provider()},
            )

        try:
            Identity.objects.filter(idp_id=idp.id, external_id=params["discord_id"]).delete()
        except IntegrityError:
            logger.exception("discord.unlink.integrity-error")
            raise Http404

        analytics.record(
            "integrations.discord.identity_unlinked",
            provider="discord",
            actor_id=request.user.id,
            actor_type=ActorType.USER,
        )
        return render_to_response(
            "sentry/integrations/discord/unlinked.html",
            request=request,
        )
