from __future__ import absolute_import

import logging

from django.views.decorators.csrf import csrf_exempt
from sentry.api.base import Endpoint
from sentry.utils.compat import filter
from sentry.utils.signing import sign
from sentry.web.decorators import transaction_start

from .client import MsTeamsPreInstallClient, get_token_data

logger = logging.getLogger("sentry.integrations.msteams.webhooks")


# TODO: implement
def verify_signature(request):
    return True


class MsTeamsWebhookEndpoint(Endpoint):
    authentication_classes = ()
    permission_classes = ()
    provider = "msteams"

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
                team_id = channel_data["team"]["id"]

                access_token = get_token_data()["access_token"]

                # need to keep track of the service url since we won't get it later
                signed_data = {"team_id": team_id, "service_url": data["serviceUrl"]}

                # sign the params so this can't be forged
                signed_params = sign(**signed_data)

                # send welcome message to the team
                client = MsTeamsPreInstallClient(access_token, data["serviceUrl"])
                client.send_welcome_message(team_id, signed_params)

        return self.respond(status=200)
