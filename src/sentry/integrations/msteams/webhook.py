from __future__ import absolute_import

import logging
import jwt
import json
import time

from django.views.decorators.csrf import csrf_exempt
from rest_framework.exceptions import AuthenticationFailed, NotAuthenticated

from sentry import options
from sentry.api.base import Endpoint
from sentry.models import AuditLogEntryEvent, Integration
from sentry.utils.audit import create_audit_entry
from sentry.utils.compat import filter
from sentry.utils.signing import sign
from sentry.web.decorators import transaction_start

from .client import MsTeamsPreInstallClient, MsTeamsJwtClient, get_token_data, CLOCK_SKEW

logger = logging.getLogger("sentry.integrations.msteams.webhooks")

# 24 hours to finish installation
INSTALL_EXPIRATION_TIME = 60 * 60 * 24


def verify_signature(request):
    # docs for jwt authentication here: https://docs.microsoft.com/en-us/azure/bot-service/rest-api/bot-framework-rest-connector-authentication?view=azure-bot-service-4.0#bot-to-connector
    token = request.META.get("HTTP_AUTHORIZATION", "").replace("Bearer ", "")
    if not token:
        logger.error("msteams.webhook.no-auth-header")
        raise NotAuthenticated("Authorization header required")

    try:
        jwt.decode(token, verify=False)
    except jwt.DecodeError:
        logger.error("msteams.webhook.invalid-token-no-verify")
        raise AuthenticationFailed("Could not decode JWT token")

    # get the open id config and jwks
    client = MsTeamsJwtClient()
    open_id_config = client.get_open_id_config()
    jwks = client.get_cached(open_id_config["jwks_uri"])

    # create a mapping of all the keys
    # taken from: https://renzolucioni.com/verifying-jwts-with-jwks-and-pyjwt/
    public_keys = {}
    for jwk in jwks["keys"]:
        kid = jwk["kid"]
        public_keys[kid] = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(jwk))

    kid = jwt.get_unverified_header(token)["kid"]
    key = public_keys[kid]

    try:
        decoded = jwt.decode(
            token,
            key,
            audience=options.get("msteams.client-id"),
            algorithms=open_id_config["id_token_signing_alg_values_supported"],
        )
    except Exception as err:
        logger.error("msteams.webhook.invalid-token-with-verify")
        raise AuthenticationFailed("Could not validate JWT. Got %s" % err)

    # now validate iss, service url, and expiration
    if decoded.get("iss") != "https://api.botframework.com":
        logger.error("msteams.webhook.invalid-iss")
        raise AuthenticationFailed("The field iss does not match")

    if decoded.get("serviceurl") != request.data.get("serviceUrl"):
        logger.error("msteams.webhook.invalid-service_url")
        raise AuthenticationFailed("The field serviceUrl does not match")

    if int(time.time()) > decoded["exp"] + CLOCK_SKEW:
        logger.error("msteams.webhook.expired-token")
        raise AuthenticationFailed("Token is expired")

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
        # verify_signature will raise the exception corresponding to the error
        verify_signature(request)

        data = request.data
        # only care about conversationUpdate
        if data["type"] != "conversationUpdate":
            return self.respond(status=204)

        channel_data = data["channelData"]
        event = channel_data.get("eventType")

        # TODO: Handle other events
        if event == "teamMemberAdded":
            return self.handle_member_added(request)
        elif event == "teamMemberRemoved":
            return self.handle_member_removed(request)

        return self.respond(status=204)

    def handle_member_added(self, request):
        data = request.data
        channel_data = data["channelData"]
        # only care if our bot is the new member added
        matches = filter(lambda x: x["id"] == data["recipient"]["id"], data["membersAdded"])
        if not matches:
            return self.respond(status=204)

        team = channel_data["team"]

        # TODO: add try/except for request exceptions
        access_token = get_token_data()["access_token"]

        # need to keep track of the service url since we won't get it later
        signed_data = {
            "team_id": team["id"],
            "team_name": team["name"],
            "service_url": data["serviceUrl"],
            "expiration_time": int(time.time()) + INSTALL_EXPIRATION_TIME,
        }

        # sign the params so this can't be forged
        signed_params = sign(**signed_data)

        # send welcome message to the team
        client = MsTeamsPreInstallClient(access_token, data["serviceUrl"])
        client.send_welcome_message(team["id"], signed_params)
        return self.respond(status=201)

    def handle_member_removed(self, request):
        data = request.data
        channel_data = data["channelData"]
        # only care if our bot is the new member removed
        matches = filter(lambda x: x["id"] == data["recipient"]["id"], data["membersRemoved"])
        if not matches:
            return self.respond(status=204)

        team_id = channel_data["team"]["id"]

        try:
            integration = Integration.objects.get(provider=self.provider, external_id=team_id)
        except Integration.DoesNotExist:
            logger.info(
                "msteams.uninstall.missing-integration", extra={"team_id": team_id},
            )
            return self.respond(status=404)

        # no matter how many orgs are using the integration
        # we have to delete the integration because the auth has been revoked
        # an app can only be installed once for a team (unless it's deleted and re-installed)
        # this is different than Vercel, for example, which can have multiple installations
        # for the same team in Vercel with different auth tokens

        for org in integration.organizations.all():
            create_audit_entry(
                request=request,
                organization=org,
                target_object=integration.id,
                event=AuditLogEntryEvent.INTEGRATION_REMOVE,
                actor_label="Teams User",
                data={
                    "provider": integration.provider,
                    "name": integration.name,
                    "team_id": team_id,
                },
            )

        integration.delete()
        return self.respond(status=204)
