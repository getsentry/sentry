from __future__ import absolute_import

import logging
import jwt
import time

from django.views.decorators.csrf import csrf_exempt
from rest_framework.exceptions import AuthenticationFailed, NotAuthenticated

from sentry import eventstore, options, analytics
from sentry.api import client
from sentry.api.base import Endpoint
from sentry.models import (
    ApiKey,
    AuditLogEntryEvent,
    Integration,
    IdentityProvider,
    Identity,
    Group,
    Project,
    Rule,
)
from sentry.utils import json
from sentry.utils.audit import create_audit_entry
from sentry.utils.compat import filter
from sentry.utils.signing import sign
from sentry.web.decorators import transaction_start

from .card_builder import (
    build_welcome_card,
    build_linking_card,
    build_group_card,
    build_personal_installation_message,
    build_mentioned_card,
    build_unlink_identity_card,
    build_unrecognized_command_card,
    build_help_command_card,
    build_link_identity_command_card,
    build_already_linked_identity_command_card,
)
from .client import (
    MsTeamsJwtClient,
    MsTeamsClient,
    CLOCK_SKEW,
)
from .link_identity import build_linking_url
from .unlink_identity import build_unlinking_url
from .utils import ACTION_TYPE, get_preinstall_client


logger = logging.getLogger("sentry.integrations.msteams.webhooks")


class MsTeamsIntegrationAnalytics(analytics.Event):
    attributes = (analytics.Attribute("actor_id"), analytics.Attribute("organization_id"))


class MsTeamsIntegrationAssign(MsTeamsIntegrationAnalytics):
    type = "integrations.msteams.assign"


class MsTeamsIntegrationResolve(MsTeamsIntegrationAnalytics):
    type = "integrations.msteams.resolve"


class MsTeamsIntegrationIgnore(MsTeamsIntegrationAnalytics):
    type = "integrations.msteams.ignore"


class MsTeamsIntegrationUnresolve(MsTeamsIntegrationAnalytics):
    type = "integrations.msteams.unresolve"


class MsTeamsIntegrationUnassign(MsTeamsIntegrationAnalytics):
    type = "integrations.msteams.unassign"


analytics.register(MsTeamsIntegrationAssign)
analytics.register(MsTeamsIntegrationResolve)
analytics.register(MsTeamsIntegrationIgnore)
analytics.register(MsTeamsIntegrationUnresolve)
analytics.register(MsTeamsIntegrationUnassign)


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
        conversation_type = data.get("conversation", {}).get("conversationType")

        # only care about conversationUpdate and message
        if data["type"] == "message":
            # the only message events we care about are those which
            # are from a user submitting an option on a card, which
            # will always contain an "payload.actionType" in the data.
            if data.get("value", {}).get("payload", {}).get("actionType"):
                return self.handle_action_submitted(request)
            elif conversation_type == "channel":
                return self.handle_channel_message(request)
            else:
                return self.handle_personal_message(request)
        elif data["type"] == "conversationUpdate":
            channel_data = data["channelData"]
            event = channel_data.get("eventType")
            # TODO: Handle other events
            if event == "teamMemberAdded":
                return self.handle_team_member_added(request)
            elif event == "teamMemberRemoved":
                return self.handle_team_member_removed(request)
            elif (
                data.get("membersAdded") and conversation_type == "personal"
            ):  # no explicit event for user adding app unfortunately
                return self.handle_personal_member_add(request)

        return self.respond(status=204)

    def handle_personal_member_add(self, request):
        data = request.data
        # only care if our bot is the new member added
        matches = filter(lambda x: x["id"] == data["recipient"]["id"], data["membersAdded"])
        if not matches:
            return self.respond(status=204)

        client = get_preinstall_client(data["serviceUrl"])

        user_conversation_id = data["conversation"]["id"]
        card = build_personal_installation_message()
        client.send_card(user_conversation_id, card)
        return self.respond(status=204)

    def handle_team_member_added(self, request):
        data = request.data
        channel_data = data["channelData"]
        # only care if our bot is the new member added
        matches = filter(lambda x: x["id"] == data["recipient"]["id"], data["membersAdded"])
        if not matches:
            return self.respond(status=204)

        team = channel_data["team"]

        # need to keep track of the service url since we won't get it later
        signed_data = {
            "team_id": team["id"],
            "team_name": team["name"],
            "service_url": data["serviceUrl"],
        }

        # sign the params so this can't be forged
        signed_params = sign(**signed_data)

        # send welcome message to the team
        client = get_preinstall_client(data["serviceUrl"])
        card = build_welcome_card(signed_params)
        client.send_card(team["id"], card)
        return self.respond(status=201)

    def handle_team_member_removed(self, request):
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

    def make_action_data(self, data, user_id):
        action_data = {}
        action_type = data["payload"]["actionType"]
        if action_type == ACTION_TYPE.UNRESOLVE:
            action_data = {"status": "unresolved"}
        elif action_type == ACTION_TYPE.RESOLVE:
            status = data["resolveInput"]
            # status might look something like "resolved:inCurrentRelease" or just "resolved"
            status_data = status.split(":", 1)
            resolve_type = status_data[-1]

            action_data = {"status": "resolved"}
            if resolve_type == "inNextRelease":
                action_data.update({"statusDetails": {"inNextRelease": True}})
            elif resolve_type == "inCurrentRelease":
                action_data.update({"statusDetails": {"inRelease": "latest"}})
        elif action_type == ACTION_TYPE.IGNORE:
            action_data = {"status": "ignored"}
            ignore_count = int(data["ignoreInput"])
            if ignore_count > 0:
                action_data.update({"statusDetails": {"ignoreCount": ignore_count}})
        elif action_type == ACTION_TYPE.ASSIGN:
            assignee = data["assignInput"]
            if assignee == "ME":
                assignee = u"user:{}".format(user_id)
            action_data = {"assignedTo": assignee}
        elif action_type == ACTION_TYPE.UNASSIGN:
            action_data = {"assignedTo": ""}
        return action_data

    def issue_state_change(self, group, identity, data):
        event_write_key = ApiKey(
            organization=group.project.organization, scope_list=["event:write"]
        )

        # undoing the enum structure of ACTION_TYPE to
        # get a more sensible analytics_event
        action_types = {
            ACTION_TYPE.RESOLVE: "resolve",
            ACTION_TYPE.IGNORE: "ignore",
            ACTION_TYPE.ASSIGN: "assign",
            ACTION_TYPE.UNRESOLVE: "unresolve",
            ACTION_TYPE.UNASSIGN: "unassign",
        }
        action_data = self.make_action_data(data, identity.user_id)
        status = action_types[data["payload"]["actionType"]]
        analytics_event = "integrations.msteams.%s" % status
        analytics.record(
            analytics_event,
            actor_id=identity.user_id,
            organization_id=group.project.organization.id,
        )

        return client.put(
            path=u"/projects/{}/{}/issues/".format(
                group.project.organization.slug, group.project.slug
            ),
            params={"id": group.id},
            data=action_data,
            user=identity.user,
            auth=event_write_key,
        )

    def handle_action_submitted(self, request):
        # pull out parameters
        data = request.data
        channel_data = data["channelData"]
        tenant_id = channel_data["tenant"]["id"]
        payload = data["value"]["payload"]
        group_id = payload["groupId"]
        integration_id = payload["integrationId"]
        user_id = data["from"]["id"]
        activity_id = data["replyToId"]
        conversation = data["conversation"]
        if conversation["conversationType"] == "personal":
            conversation_id = conversation["id"]
        else:
            conversation_id = channel_data["channel"]["id"]

        try:
            integration = Integration.objects.get(id=integration_id)
        except Integration.DoesNotExist:
            logger.info(
                "msteams.action.missing-integration", extra={"integration_id": integration_id}
            )
            return self.respond(status=404)

        team_id = integration.external_id
        client = MsTeamsClient(integration)

        try:
            group = Group.objects.select_related("project__organization").get(
                project__in=Project.objects.filter(
                    organization__in=integration.organizations.all()
                ),
                id=group_id,
            )
        except Group.DoesNotExist:
            logger.info(
                "msteams.action.invalid-issue",
                extra={"team_id": team_id, "integration_id": integration.id},
            )
            return self.respond(status=404)

        try:
            idp = IdentityProvider.objects.get(type="msteams", external_id=team_id)
        except IdentityProvider.DoesNotExist:
            logger.info(
                "msteams.action.invalid-team-id",
                extra={
                    "team_id": team_id,
                    "integration_id": integration.id,
                    "organization_id": group.organization.id,
                },
            )
            return self.respond(status=404)

        try:
            identity = Identity.objects.get(idp=idp, external_id=user_id)
        except Identity.DoesNotExist:
            associate_url = build_linking_url(
                integration, group.organization, user_id, team_id, tenant_id
            )

            card = build_linking_card(associate_url)
            user_conversation_id = client.get_user_conversation_id(user_id, tenant_id)
            client.send_card(user_conversation_id, card)
            return self.respond(status=201)

        # update the state of the issue
        issue_change_response = self.issue_state_change(group, identity, data["value"])

        # get the rules from the payload
        rules = Rule.objects.filter(id__in=payload["rules"])

        # pull the event based off our payload
        event = eventstore.get_event_by_id(group.project_id, payload["eventId"])
        if event is None:
            logger.info(
                "msteams.action.event-missing",
                extra={
                    "team_id": team_id,
                    "integration_id": integration.id,
                    "organization_id": group.organization.id,
                    "event_id": payload["eventId"],
                    "project_id": group.project_id,
                },
            )
            return self.respond(status=404)

        # refresh issue and update card
        group.refresh_from_db()
        card = build_group_card(group, event, rules, integration)
        client.update_card(conversation_id, activity_id, card)

        return issue_change_response

    def handle_channel_message(self, request):
        data = request.data

        # check to see if we are mentioned
        recipient_id = data.get("recipient", {}).get("id")
        if recipient_id:
            # check the ids of the mentions in the entities
            mentioned = (
                len(
                    filter(
                        lambda x: x.get("mentioned", {}).get("id") == recipient_id,
                        data.get("entities", []),
                    )
                )
                > 0
            )
            if mentioned:
                client = get_preinstall_client(data["serviceUrl"])
                card = build_mentioned_card()
                conversation_id = data["conversation"]["id"]
                client.send_card(conversation_id, card)

        return self.respond(status=204)

    def handle_personal_message(self, request):
        data = request.data
        command_text = data.get("text", "").strip()
        lowercase_command = command_text.lower()
        conversation_id = data["conversation"]["id"]
        teams_user_id = data["from"]["id"]

        # only supporting unlink for now
        if "unlink" in lowercase_command:
            unlink_url = build_unlinking_url(conversation_id, data["serviceUrl"], teams_user_id)
            card = build_unlink_identity_card(unlink_url)
        elif "help" in lowercase_command:
            card = build_help_command_card()
        elif "link" == lowercase_command:  # don't to match other types of link commands
            has_linked_identity = Identity.objects.filter(external_id=teams_user_id).exists()
            if has_linked_identity:
                card = build_already_linked_identity_command_card()
            else:
                card = build_link_identity_command_card()
        else:
            card = build_unrecognized_command_card(command_text)

        client = get_preinstall_client(data["serviceUrl"])
        client.send_card(conversation_id, card)
        return self.respond(status=204)
