from django.db import IntegrityError
from django.http import Http404
from django.urls import reverse
from django.views.decorators.cache import never_cache

from sentry.models import Identity
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils.http import absolute_uri
from sentry.utils.signing import sign, unsign
from sentry.web.decorators import transaction_start
from sentry.web.frontend.base import BaseView
from sentry.web.helpers import render_to_response

from .client import SlackClient
from .utils import get_identity, logger


def build_unlinking_url(integration_id, organization_id, slack_id, channel_id, response_url):
    signed_params = sign(
        integration_id=integration_id,
        organization_id=organization_id,
        slack_id=slack_id,
        channel_id=channel_id,
        response_url=response_url,
    )

    return absolute_uri(
        reverse("sentry-integration-slack-unlink-identity", kwargs={"signed_params": signed_params})
    )


class SlackUnlinkIdentityView(BaseView):
    @transaction_start("SlackUnlinkIdentityView")
    @never_cache
    def handle(self, request, signed_params):
        params = unsign(signed_params)

        organization, integration, idp = get_identity(
            request.user, params["organization_id"], params["integration_id"]
        )

        if request.method != "POST":
            return render_to_response(
                "sentry/auth-unlink-identity.html",
                request=request,
                context={"organization": organization, "provider": integration.get_provider()},
            )

        # Delete the wrong slack identity.
        try:
            identity = Identity.objects.get(idp=idp, external_id=params["slack_id"])
            identity.delete()
        except IntegrityError as e:
            logger.error("slack.unlink.integrity-error", extra=e)
            raise Http404

        payload = {
            "replace_original": False,
            "response_type": "ephemeral",
            "text": "Your Slack identity has been unlinked from your Sentry account.",
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
                logger.error("slack.unlink-notify.response-error", extra={"error": message})

        return render_to_response(
            "sentry/slack-unlinked.html",
            request=request,
            context={"channel_id": params["channel_id"], "team_id": integration.external_id},
        )
