from __future__ import absolute_import

import logging

from django.views.decorators.csrf import csrf_exempt
from sentry.api.base import Endpoint
from sentry.utils.compat import filter
from sentry.web.decorators import transaction_start

from .client import MsTeamsClient

logger = logging.getLogger("sentry.integrations.msteams.webhooks")


# TODO: implement
def verify_signature(request):
    return True


class MsTeamsWebhookEndpoint(Endpoint):
    authentication_classes = ()
    permission_classes = ()

    @csrf_exempt
    def dispatch(self, request, *args, **kwargs):
        return super(MsTeamsWebhookEndpoint, self).dispatch(request, *args, **kwargs)

    @transaction_start("MsTeamsWebhookEndpoint")
    def post(self, request):
        is_valid = verify_signature(request)

        if not is_valid:
            logger.error("msteams.webhook.invalid-signature")
            return self.respond(status=401)

        data = request.data
        channel_data = data["channelData"]
        event = channel_data.get("eventType")
        # TODO: Handle other events
        if event == "teamMemberAdded":
            # only care if our bot is the new member added
            matches = filter(lambda x: x["id"] == data["recipient"]["id"], data["membersAdded"])
            if matches:
                # send welcome message to the team
                team_id = channel_data["team"]["id"]
                client = MsTeamsClient()
                client.send_welcome_message(team_id)

        return self.respond(status=200)
