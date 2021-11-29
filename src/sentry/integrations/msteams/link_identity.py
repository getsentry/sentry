from django.core.signing import BadSignature, SignatureExpired
from django.db import IntegrityError
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.cache import never_cache

from sentry.integrations.utils import get_identity_or_404
from sentry.models import Identity, IdentityStatus
from sentry.types.integrations import ExternalProviders
from sentry.utils.http import absolute_uri
from sentry.utils.signing import sign, unsign
from sentry.web.decorators import transaction_start
from sentry.web.frontend.base import BaseView
from sentry.web.helpers import render_to_response

from .card_builder import build_linked_card
from .client import MsTeamsClient


def build_linking_url(integration, organization, teams_user_id, team_id, tenant_id):
    signed_params = sign(
        integration_id=integration.id,
        organization_id=organization.id,
        teams_user_id=teams_user_id,
        team_id=team_id,
        tenant_id=tenant_id,
    )

    return absolute_uri(
        reverse("sentry-integration-msteams-link-identity", kwargs={"signed_params": signed_params})
    )


class MsTeamsLinkIdentityView(BaseView):
    @transaction_start("MsTeamsLinkIdentityView")
    @never_cache
    def handle(self, request, signed_params):
        try:
            params = unsign(signed_params)
        except (SignatureExpired, BadSignature):
            return render_to_response(
                "sentry/integrations/msteams/expired-link.html",
                request=request,
            )

        organization, integration, idp = get_identity_or_404(
            ExternalProviders.MSTEAMS,
            request.user,
            integration_id=params["integration_id"],
            organization_id=params["organization_id"],
        )

        if request.method != "POST":
            return render_to_response(
                "sentry/auth-link-identity.html",
                request=request,
                context={"organization": organization, "provider": integration.get_provider()},
            )

        defaults = {"status": IdentityStatus.VALID, "date_verified": timezone.now()}
        try:
            identity, created = Identity.objects.get_or_create(
                idp=idp,
                user=request.user,
                external_id=params["teams_user_id"],
                defaults=defaults,
            )
            if not created:
                identity.update(**defaults)
        except IntegrityError:
            Identity.objects.reattach(idp, params["teams_user_id"], request.user, defaults)

        card = build_linked_card()
        client = MsTeamsClient(integration)
        user_conversation_id = client.get_user_conversation_id(
            params["teams_user_id"], params["tenant_id"]
        )
        client.send_card(user_conversation_id, card)

        return render_to_response(
            "sentry/integrations/msteams/linked.html",
            request=request,
            context={"team_id": params["team_id"]},
        )
