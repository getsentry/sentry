from django.core.signing import BadSignature, SignatureExpired
from django.http import HttpResponse
from django.urls import reverse
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework.request import Request

from sentry.models.identity import Identity
from sentry.utils.http import absolute_uri
from sentry.utils.signing import sign, unsign
from sentry.web.decorators import transaction_start
from sentry.web.frontend.base import BaseView, control_silo_view
from sentry.web.helpers import render_to_response

from .card_builder.identity import build_unlinked_card
from .utils import get_preinstall_client


def build_unlinking_url(conversation_id, service_url, teams_user_id):
    signed_params = sign(
        conversation_id=conversation_id,
        service_url=service_url,
        teams_user_id=teams_user_id,
    )

    return absolute_uri(
        reverse(
            "sentry-integration-msteams-unlink-identity", kwargs={"signed_params": signed_params}
        )
    )


@control_silo_view
class MsTeamsUnlinkIdentityView(BaseView):
    @transaction_start("MsTeamsUnlinkIdentityView")
    @method_decorator(never_cache)
    def handle(self, request: Request, signed_params) -> HttpResponse:
        try:
            params = unsign(signed_params)
        except (SignatureExpired, BadSignature):
            return render_to_response(
                "sentry/integrations/msteams/expired-link.html",
                request=request,
            )

        if request.method != "POST":
            return render_to_response(
                "sentry/integrations/msteams/unlink-identity.html",
                request=request,
                context={},
            )

        # find the identities linked to this team user and sentry user
        identity_list = Identity.objects.filter(
            external_id=params["teams_user_id"], user_id=request.user.id
        )
        # if no identities, tell the user that
        if not identity_list:
            return render_to_response(
                "sentry/integrations/msteams/no-identity.html",
                request=request,
                context={},
            )

        # otherwise, delete the identities, send message to the user, and render a success screen
        identity_list.delete()
        client = get_preinstall_client(params["service_url"])
        card = build_unlinked_card()
        client.send_card(params["conversation_id"], card)

        return render_to_response(
            "sentry/integrations/msteams/unlinked.html",
            request=request,
            context={},
        )
