from django.db import IntegrityError
from django.utils import timezone
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.models import Identity, IdentityStatus, Integration, Organization
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils.signing import unsign
from sentry.web.decorators import transaction_start
from sentry.web.frontend.base import BaseView
from sentry.web.helpers import render_to_response

from ..client import SlackClient
from ..utils import get_identity, logger
from . import build_linking_url as base_build_linking_url
from . import never_cache

SUCCESS_LINKED_MESSAGE = (
    "Your Slack identity has been linked to your Sentry account. You're good to go!"
)


def build_linking_url(
    integration: Integration,
    organization: Organization,
    slack_id: str,
    channel_id: str,
    response_url: str,
) -> str:
    return base_build_linking_url(
        "sentry-integration-slack-link-identity",
        integration_id=integration.id,
        organization_id=organization.id,
        slack_id=slack_id,
        channel_id=channel_id,
        response_url=response_url,
    )


class SlackLinkIdentityView(BaseView):  # type: ignore
    @transaction_start("SlackLinkIdentityView")
    @never_cache
    def handle(self, request: Request, signed_params: str) -> Response:
        params = unsign(signed_params)

        organization, integration, idp = get_identity(
            request.user, params["organization_id"], params["integration_id"]
        )

        if request.method != "POST":
            return render_to_response(
                "sentry/auth-link-identity.html",
                request=request,
                context={"organization": organization, "provider": integration.get_provider()},
            )

        # TODO(epurkhiser): We could do some fancy slack querying here to
        # render a nice linking page with info about the user their linking.

        # Link the user with the identity. Handle the case where the user is linked to a
        # different identity or the identity is linked to a different user.
        defaults = {"status": IdentityStatus.VALID, "date_verified": timezone.now()}
        try:
            identity, created = Identity.objects.get_or_create(
                idp=idp, user=request.user, external_id=params["slack_id"], defaults=defaults
            )
            if not created:
                identity.update(**defaults)
        except IntegrityError:
            Identity.reattach(idp, params["slack_id"], request.user, defaults)

        payload = {
            "replace_original": False,
            "response_type": "ephemeral",
            "text": SUCCESS_LINKED_MESSAGE,
        }

        client = SlackClient()
        try:
            client.post(params["response_url"], data=payload, json=True)
        except ApiError as e:
            message = str(e)
            # If the user took their time to link their slack account, we may no
            # longer be able to respond, and we're not guaranteed able to post into
            # the channel. Ignore Expired url errors.
            #
            # XXX(epurkhiser): Yes the error string has a space in it.
            if message != "Expired url":
                logger.error("slack.link-notify.response-error", extra={"error": message})

        return render_to_response(
            "sentry/integrations/slack-linked.html",
            request=request,
            context={"channel_id": params["channel_id"], "team_id": integration.external_id},
        )
