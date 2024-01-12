from __future__ import annotations

import logging
import time
from typing import Any, Callable, Mapping

from django.http import HttpRequest, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework.exceptions import AuthenticationFailed, NotAuthenticated

from sentry import analytics, audit_log, eventstore, features, options
from sentry.api import client
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, all_silo_endpoint
from sentry.models.activity import ActivityIntegration
from sentry.models.apikey import ApiKey
from sentry.models.group import Group
from sentry.models.rule import Rule
from sentry.services.hybrid_cloud.identity import identity_service
from sentry.services.hybrid_cloud.identity.model import RpcIdentity
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.services.hybrid_cloud.integration.model import RpcIntegration
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.silo import SiloMode
from sentry.utils import json, jwt
from sentry.utils.audit import create_audit_entry
from sentry.utils.signing import sign
from sentry.web.decorators import transaction_start

from .card_builder.block import AdaptiveCard
from .card_builder.help import (
    build_help_command_card,
    build_mentioned_card,
    build_unrecognized_command_card,
)
from .card_builder.identity import (
    build_already_linked_identity_command_card,
    build_link_identity_command_card,
    build_linking_card,
    build_unlink_identity_card,
)
from .card_builder.installation import (
    build_personal_installation_message,
    build_team_installation_message,
)
from .card_builder.issues import MSTeamsIssueMessageBuilder
from .client import CLOCK_SKEW, MsTeamsClient, MsTeamsJwtClient
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
        jwt.peek_claims(token)
    except jwt.DecodeError:
        logger.exception("msteams.webhook.invalid-token-no-verify")
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
        public_keys[kid] = jwt.rsa_key_from_jwk(json.dumps(jwk))

    kid = jwt.peek_header(token)["kid"]
    key = public_keys[kid]

    try:
        decoded = jwt.decode(
            token,
            key,
            audience=options.get("msteams.client-id"),
            algorithms=open_id_config["id_token_signing_alg_values_supported"],
        )
    except Exception as err:
        logger.exception("msteams.webhook.invalid-token-with-verify")
        raise AuthenticationFailed(f"Could not validate JWT. Got {err}")

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


class MsTeamsWebhookMixin:
    provider = "msteams"

    def infer_team_id_from_channel_data(self, data: Mapping[str, Any]) -> str | None:
        try:
            channel_data = data["channelData"]
            team_id = channel_data["team"]["id"]
            return team_id
        except Exception:
            pass
        return None

    def get_integration_from_channel_data(self, data: Mapping[str, Any]) -> RpcIntegration | None:
        team_id = self.infer_team_id_from_channel_data(data=data)
        if team_id is None:
            return None
        return integration_service.get_integration(provider=self.provider, external_id=team_id)

    def infer_integration_id_from_card_action(self, data: Mapping[str, Any]) -> int | None:
        # The bot builds and sends Adaptive Cards to the channel, and in it will include card actions and context.
        # The context will include the "integrationId".
        # Whenever a user interacts with the card, MS Teams will send the card action and the context to the bot.
        # Here we parse the "integrationId" from the context.
        #
        # See: https://learn.microsoft.com/en-us/microsoftteams/platform/task-modules-and-cards/cards/cards-actions?tabs=json#actionsubmit
        try:
            payload = data["value"]["payload"]
            integration_id = payload["integrationId"]
            return integration_id
        except Exception:
            pass
        return None

    def get_integration_from_card_action(self, data: Mapping[str, Any]) -> RpcIntegration | None:
        integration_id = self.infer_integration_id_from_card_action(data=data)
        if integration_id is None:
            return None
        return integration_service.get_integration(integration_id=integration_id)

    def can_infer_integration(self, data: Mapping[str, Any]) -> bool:
        return (
            self.infer_integration_id_from_card_action(data=data) is not None
            or self.infer_team_id_from_channel_data(data=data) is not None
        )


@all_silo_endpoint
class MsTeamsWebhookEndpoint(Endpoint, MsTeamsWebhookMixin):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "POST": ApiPublishStatus.UNKNOWN,
    }
    authentication_classes = ()
    permission_classes = ()
    provider = "msteams"

    @csrf_exempt
    def dispatch(self, request: HttpRequest, *args, **kwargs) -> HttpResponse:
        return super().dispatch(request, *args, **kwargs)

    @transaction_start("MsTeamsWebhookEndpoint")
    def post(self, request: HttpRequest) -> HttpResponse:
        # verify_signature will raise the exception corresponding to the error
        self.verify_webhook_request(request)

        data = request.data
        conversation_type = data.get("conversation", {}).get("conversationType")
        event_type = data["type"]

        # only care about conversationUpdate and message
        if event_type == "message":
            # the only message events we care about are those which
            # are from a user submitting an option on a card, which
            # will always contain an "payload.actionType" in the data.
            if data.get("value", {}).get("payload", {}).get("actionType"):
                # Processing card actions can only occur in the Region silo.
                if SiloMode.get_current_mode() == SiloMode.CONTROL:
                    return self.respond(status=400)
                return self.handle_action_submitted(request)
            elif conversation_type == "channel":
                return self.handle_channel_message(request)
            else:
                return self.handle_personal_message(request)
        elif event_type == "conversationUpdate":
            channel_data = data["channelData"]
            event = channel_data.get("eventType")
            # TODO: Handle other events
            if event == "teamMemberAdded":
                return self.handle_team_member_added(request)
            elif event == "teamMemberRemoved":
                if SiloMode.get_current_mode() == SiloMode.CONTROL:
                    return self.respond(status=400)
                return self.handle_team_member_removed(request)
            elif (
                data.get("membersAdded") and conversation_type == "personal"
            ):  # no explicit event for user adding app unfortunately
                return self.handle_personal_member_add(request)

        return self.respond(status=204)

    def verify_webhook_request(self, request: HttpRequest) -> bool:
        return verify_signature(request)

    def handle_personal_member_add(self, request: HttpRequest):
        data = request.data
        data["conversation_id"] = data["conversation"]["id"]
        tenant_id = data["conversation"]["tenantId"]

        params = {
            "external_id": tenant_id,
            "external_name": f"{tenant_id} (Microsoft Tenant)",
            "installation_type": "tenant",
        }

        return self.handle_member_add(data, params, build_personal_installation_message)

    def handle_team_member_added(self, request: HttpRequest):
        data = request.data
        team = data["channelData"]["team"]
        data["conversation_id"] = team["id"]

        params = {
            "external_id": team["id"],
            "external_name": team["name"],
            "installation_type": "team",
        }

        return self.handle_member_add(data, params, build_team_installation_message)

    def handle_member_add(
        self,
        data: Mapping[str, str],
        params: Mapping[str, str],
        build_installation_card: Callable[[str], AdaptiveCard],
    ) -> HttpResponse:
        # only care if our bot is the new member added
        matches = list(filter(lambda x: x["id"] == data["recipient"]["id"], data["membersAdded"]))
        if not matches:
            return self.respond(status=204)

        # need to keep track of the service url since we won't get it later
        params.update(
            {
                "service_url": data["serviceUrl"],
                "user_id": data["from"]["id"],
                "conversation_id": data["conversation_id"],
                "tenant_id": data["channelData"]["tenant"]["id"],
            }
        )

        # sign the params so this can't be forged
        signed_params = sign(**params)

        # send welcome message to the team
        client = get_preinstall_client(data["serviceUrl"])
        conversation_id = data["conversation_id"]
        card = build_installation_card(signed_params)
        client.send_card(conversation_id, card)

        return self.respond(status=201)

    def handle_team_member_removed(self, request: HttpRequest):
        data = request.data
        channel_data = data["channelData"]
        # only care if our bot is the new member removed
        matches = list(filter(lambda x: x["id"] == data["recipient"]["id"], data["membersRemoved"]))
        if not matches:
            return self.respond(status=204)

        team_id = channel_data["team"]["id"]

        integration = self.get_integration_from_channel_data(data=data)
        if integration is None:
            logger.info(
                "msteams.uninstall.missing-integration",
                extra={"team_id": team_id},
            )
            return self.respond(status=404)

        # no matter how many orgs are using the integration
        # we have to delete the integration because the auth has been revoked
        # an app can only be installed once for a team (unless it's deleted and re-installed)
        # this is different than Vercel, for example, which can have multiple installations
        # for the same team in Vercel with different auth tokens

        org_integrations = integration_service.get_organization_integrations(
            integration_id=integration.id
        )
        if len(org_integrations) > 0:
            for org_integration in org_integrations:
                create_audit_entry(
                    request=request,
                    organization_id=org_integration.organization_id,
                    target_object=integration.id,
                    event=audit_log.get_event_id("INTEGRATION_REMOVE"),
                    actor_label="Teams User",
                    data={
                        "provider": integration.provider,
                        "name": integration.name,
                        "team_id": team_id,
                    },
                )

        integration_service.delete_integration(integration_id=integration.id)
        return self.respond(status=204)

    def make_action_data(self, data, user_id, has_escalating_issues=False):
        action_data = {}
        action_type = data["payload"]["actionType"]
        if action_type == ACTION_TYPE.UNRESOLVE:
            action_data = {"status": "unresolved"}
        elif action_type == ACTION_TYPE.RESOLVE:
            status = data.get("resolveInput")
            if status:
                # status might look something like "resolved:inCurrentRelease" or just "resolved"
                status_data = status.split(":", 1)
                resolve_type = status_data[-1]

                action_data = {"status": "resolved"}
                if resolve_type == "inNextRelease":
                    action_data.update({"statusDetails": {"inNextRelease": True}})
                elif resolve_type == "inCurrentRelease":
                    action_data.update({"statusDetails": {"inRelease": "latest"}})
        elif action_type == ACTION_TYPE.IGNORE:
            ignore_count = data.get("ignoreInput")
            if ignore_count:
                action_data = {"status": "ignored"}
                if has_escalating_issues:
                    action_data.update({"substatus": "archived_until_condition_met"})
                if int(ignore_count) > 0:
                    action_data.update({"statusDetails": {"ignoreCount": int(ignore_count)}})
        elif action_type == ACTION_TYPE.ASSIGN:
            assignee = data["assignInput"]
            if assignee == "ME":
                assignee = f"user:{user_id}"
            action_data = {"assignedTo": assignee, "integration": ActivityIntegration.MSTEAMS.value}
        elif action_type == ACTION_TYPE.UNASSIGN:
            action_data = {"assignedTo": ""}
        return action_data

    def issue_state_change(self, group: Group, identity: RpcIdentity, data):
        event_write_key = ApiKey(
            organization_id=group.project.organization_id, scope_list=["event:write"]
        )

        has_escalating_issues = features.has(
            "organizations:escalating-issues-msteams", group.project.organization
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
        action_data = self.make_action_data(data, identity.user_id, has_escalating_issues)
        status = action_types[data["payload"]["actionType"]]
        analytics_event = f"integrations.msteams.{status}"
        analytics.record(
            analytics_event,
            actor_id=identity.user_id,
            organization_id=group.project.organization.id,
        )

        return client.put(
            path=f"/projects/{group.project.organization.slug}/{group.project.slug}/issues/",
            params={"id": group.id},
            data=action_data,
            user=user_service.get_user(user_id=identity.user_id),
            auth=event_write_key,
        )

    def handle_action_submitted(self, request: HttpRequest):
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

        integration = self.get_integration_from_card_action(data=data)
        if integration is None:
            logger.info(
                "msteams.action.missing-integration", extra={"integration_id": integration_id}
            )
            return self.respond(status=404)

        team_id = integration.external_id
        client = MsTeamsClient(integration)

        group = Group.objects.select_related("project__organization").filter(id=group_id).first()
        if group:
            integration = integration_service.get_integration(integration_id=integration.id)
            if integration is None:
                group = None

        if not group:
            logger.info(
                "msteams.action.invalid-issue",
                extra={"team_id": team_id, "integration_id": integration.id},
            )
            return self.respond(status=404)

        idp = identity_service.get_provider(provider_type="msteams", provider_ext_id=team_id)
        if idp is None:
            logger.info(
                "msteams.action.invalid-team-id",
                extra={
                    "team_id": team_id,
                    "integration_id": integration.id,
                    "organization_id": group.organization.id,
                },
            )
            return self.respond(status=404)

        identity = identity_service.get_identity(
            filter={"provider_id": idp.id, "identity_ext_id": user_id}
        )
        if identity is None:
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
        event = eventstore.backend.get_event_by_id(group.project_id, payload["eventId"])
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
        card = MSTeamsIssueMessageBuilder(group, event, rules, integration).build_group_card()
        client.update_card(conversation_id, activity_id, card)

        return issue_change_response

    def handle_channel_message(self, request: HttpRequest):
        data = request.data

        # check to see if we are mentioned
        recipient_id = data.get("recipient", {}).get("id")
        if recipient_id:
            # check the ids of the mentions in the entities
            mentioned = (
                len(
                    list(
                        filter(
                            lambda x: x.get("mentioned", {}).get("id") == recipient_id,
                            data.get("entities", []),
                        )
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

    def handle_personal_message(self, request: HttpRequest):
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
            has_linked_identity = (
                identity_service.get_identity(filter={"identity_ext_id": teams_user_id}) is not None
            )
            if has_linked_identity:
                card = build_already_linked_identity_command_card()
            else:
                card = build_link_identity_command_card()
        else:
            card = build_unrecognized_command_card(command_text)

        client = get_preinstall_client(data["serviceUrl"])
        client.send_card(conversation_id, card)
        return self.respond(status=204)
