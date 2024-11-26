from __future__ import annotations

import logging
import time
from collections.abc import Callable, Iterable, Mapping
from dataclasses import dataclass
from enum import Enum
from typing import Any, cast

import orjson
from django.http import HttpRequest, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework.exceptions import AuthenticationFailed, NotAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, audit_log, eventstore, options
from sentry.api import client
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, all_silo_endpoint
from sentry.constants import ObjectStatus
from sentry.identity.services.identity import identity_service
from sentry.identity.services.identity.model import RpcIdentity
from sentry.integrations.messaging import commands
from sentry.integrations.messaging.commands import (
    CommandHandler,
    CommandInput,
    CommandNotMatchedError,
    MessagingIntegrationCommand,
    MessagingIntegrationCommandDispatcher,
)
from sentry.integrations.messaging.metrics import (
    MessageCommandHaltReason,
    MessagingInteractionEvent,
    MessagingInteractionType,
)
from sentry.integrations.messaging.spec import MessagingIntegrationSpec
from sentry.integrations.msteams import parsing
from sentry.integrations.msteams.spec import PROVIDER, MsTeamsMessagingSpec
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import EventLifecycleOutcome, IntegrationResponse
from sentry.models.activity import ActivityIntegration
from sentry.models.apikey import ApiKey
from sentry.models.group import Group
from sentry.models.rule import Rule
from sentry.silo.base import SiloMode
from sentry.users.services.user.service import user_service
from sentry.utils import jwt
from sentry.utils.audit import create_audit_entry
from sentry.utils.signing import sign

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
from .constants import SALT
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


class MsTeamsIntegrationArchive(MsTeamsIntegrationAnalytics):
    type = "integrations.msteams.archive"


class MsTeamsIntegrationUnresolve(MsTeamsIntegrationAnalytics):
    type = "integrations.msteams.unresolve"


class MsTeamsIntegrationUnassign(MsTeamsIntegrationAnalytics):
    type = "integrations.msteams.unassign"


analytics.register(MsTeamsIntegrationAssign)
analytics.register(MsTeamsIntegrationResolve)
analytics.register(MsTeamsIntegrationArchive)
analytics.register(MsTeamsIntegrationUnresolve)
analytics.register(MsTeamsIntegrationUnassign)


def verify_signature(request) -> bool:
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
    jwks = cast(Mapping[str, Any], client.get_cached(open_id_config["jwks_uri"]))

    # create a mapping of all the keys
    # taken from: https://renzolucioni.com/verifying-jwts-with-jwks-and-pyjwt/
    public_keys = {}
    for jwk in jwks["keys"]:
        kid = jwk["kid"]
        public_keys[kid] = jwt.rsa_key_from_jwk(orjson.dumps(jwk).decode())

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


class MsTeamsEvents(Enum):
    INSTALLATION_UPDATE = "installationUpdate"
    MESSAGE = "message"
    CONVERSATION_UPDATE = "conversationUpdate"
    UNKNOWN = "unknown"

    @classmethod
    def get_from_value(cls, value: str) -> MsTeamsEvents:
        try:
            return MsTeamsEvents(value)
        except Exception:
            return MsTeamsEvents.UNKNOWN


@all_silo_endpoint
class MsTeamsWebhookEndpoint(Endpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    authentication_classes = ()
    permission_classes = ()
    provider = PROVIDER

    def __init__(self, **kwargs) -> None:
        super().__init__(**kwargs)
        self._event_handlers: dict[MsTeamsEvents, Callable[[Request], Response]] = {
            MsTeamsEvents.MESSAGE: self._handle_message_event,
            MsTeamsEvents.CONVERSATION_UPDATE: self._handle_conversation_update_event,
            MsTeamsEvents.INSTALLATION_UPDATE: self._handle_installation_update_event,
            MsTeamsEvents.UNKNOWN: self._handle_unknown_event,
        }

    @csrf_exempt
    def dispatch(self, request: HttpRequest, *args, **kwargs) -> HttpResponse:
        return super().dispatch(request, *args, **kwargs)

    def post(self, request: Request) -> Response:
        """
        POST webhook handler for MSTeams bot.
        The events are broadcast to MSTeams from Microsoft, and are documented at https://learn.microsoft.com/en-us/microsoftteams/platform/resources/bot-v3/bots-notifications
        """

        # verify_signature will raise the exception corresponding to the error
        self._verify_webhook_request(request)

        data = request.data
        raw_event_type = data["type"]
        event_type = MsTeamsEvents.get_from_value(value=raw_event_type)

        event_handler_func = self._event_handlers[event_type]
        response = event_handler_func(request)

        logger.info("sentry.integrations.msteams.webhook", extra={"request_data": data})
        return response if response else self.respond(status=204)

    @classmethod
    def _get_team_installation_request_data(cls, data: dict[str, Any]) -> dict[str, Any]:
        """
        Helper method that will construct the installation request for a MsTeams team channel.
        We want the KeyError exception to be raised if the key does not exist.
        """
        channel_data = data["channelData"]

        new_team_info = channel_data["team"]
        team_id = new_team_info["id"]
        team_name = new_team_info["name"]

        service_url = data["serviceUrl"]
        from_data = data["from"]
        user_id = from_data["id"]

        tenant_info = channel_data["tenant"]
        tenant_id = tenant_info["id"]
        params = {
            "service_url": service_url,
            "user_id": user_id,
            "tenant_id": tenant_id,
            "conversation_id": team_id,
            "external_id": team_id,
            "external_name": team_name,
            "installation_type": "team",
        }
        return params

    def _handle_installation_update_event(self, request: Request) -> Response:
        data = request.data
        action = data.get("action", None)
        if action is None or action != "add":
            logger.info(
                "sentry.integrations.msteams.webhooks: Action not supported",
                extra={"request_data": data},
            )
            return self.respond({"details": f"{action} is currently not supported"}, status=204)

        try:
            installation_params = self._get_team_installation_request_data(data=data)
        except Exception as err:
            logger.info(
                "sentry.integrations.msteams.webhooks: Installation param error",
                exc_info=err,
                extra={"request_data": data},
            )
            return self.respond(
                {"details": "required request format or keys are missing"}, status=400
            )

        # sign the params so this can't be forged
        signed_params = sign(salt=SALT, **installation_params)

        # send welcome message to the team
        preinstall_client = get_preinstall_client(installation_params["service_url"])
        card = build_team_installation_message(signed_params)
        preinstall_client.send_card(installation_params["conversation_id"], card)

        return self.respond(status=201)

    def _handle_message_event(self, request: Request) -> Response:
        data = request.data
        conversation = data.get("conversation", {})
        conversation_type = conversation.get("conversationType")

        # the only message events we care about are those which
        # are from a user submitting an option on a card, which
        # will always contain an "payload.actionType" in the data.
        if data.get("value", {}).get("payload", {}).get("actionType"):
            # Processing card actions can only occur in the Region silo.
            if SiloMode.get_current_mode() == SiloMode.CONTROL:
                return self.respond(status=400)
            return self._handle_action_submitted(request)
        elif conversation_type == "channel":
            return self._handle_channel_message(request)

        return self._handle_personal_message(request)

    def _handle_conversation_update_event(self, request: Request) -> Response:
        data = request.data
        conversation = data.get("conversation", {})
        conversation_type = conversation.get("conversationType")
        channel_data = data["channelData"]
        event = channel_data.get("eventType")

        if event == "teamMemberAdded":
            return self._handle_team_member_added(request)
        elif event == "teamMemberRemoved":
            if SiloMode.get_current_mode() == SiloMode.CONTROL:
                return self.respond(status=400)
            return self._handle_team_member_removed(request)
        elif (
            data.get("membersAdded") and conversation_type == "personal"
        ):  # no explicit event for user adding app unfortunately
            return self._handle_personal_member_add(request)

        return self.respond(status=204)

    def _handle_unknown_event(self, request: Request) -> Response:
        return self.respond(status=204)

    def _verify_webhook_request(self, request: Request) -> bool:
        return verify_signature(request)

    def _handle_personal_member_add(self, request: Request):
        data = request.data
        data["conversation_id"] = data["conversation"]["id"]
        tenant_id = data["conversation"]["tenantId"]

        params = {
            "external_id": tenant_id,
            "external_name": f"{tenant_id} (Microsoft Tenant)",
            "installation_type": "tenant",
        }
        return self._handle_member_add(data, params, build_personal_installation_message)

    def _handle_team_member_added(self, request: Request) -> Response:
        data = request.data
        team = data["channelData"]["team"]
        data["conversation_id"] = team["id"]

        params = {
            "external_id": team["id"],
            "external_name": team["name"],
            "installation_type": "team",
        }

        return self._handle_member_add(data, params, build_team_installation_message)

    def _handle_member_add(
        self,
        data: Mapping[str, Any],
        params: dict[str, str],
        build_installation_card: Callable[[str], AdaptiveCard],
    ) -> Response:
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

        logger.info(
            "sentry.integrations.msteams.webhook.handle_member_add",
            extra={
                **params,
                "member_type_handler": build_installation_card.__name__,
            },
        )
        # sign the params so this can't be forged
        signed_params = sign(salt=SALT, **params)

        # send welcome message to the team
        client = get_preinstall_client(data["serviceUrl"])
        conversation_id = data["conversation_id"]
        card = build_installation_card(signed_params)
        client.send_card(conversation_id, card)

        return self.respond(status=201)

    def _handle_team_member_removed(self, request: Request) -> Response:
        data = request.data
        channel_data = data["channelData"]
        # only care if our bot is the new member removed
        matches = list(filter(lambda x: x["id"] == data["recipient"]["id"], data["membersRemoved"]))
        if not matches:
            return self.respond(status=204)

        team_id = channel_data["team"]["id"]

        integration = parsing.get_integration_from_channel_data(data=data)
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

    def _make_action_data(self, data: Mapping[str, Any], user_id: int) -> dict[str, Any]:
        action_data: dict[str, Any] = {}
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
        # ignore has been renamed to archive, but ignore is still used in the payload
        elif action_type == ACTION_TYPE.ARCHIVE:
            ignore_count = data.get("archiveInput")
            if ignore_count:
                action_data = {"status": "ignored"}
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

    _ACTION_TYPES = {
        ACTION_TYPE.RESOLVE: ("resolve", MessagingInteractionType.RESOLVE),
        ACTION_TYPE.ARCHIVE: ("archive", MessagingInteractionType.ARCHIVE),
        ACTION_TYPE.ASSIGN: ("assign", MessagingInteractionType.ASSIGN),
        ACTION_TYPE.UNRESOLVE: ("unresolve", MessagingInteractionType.UNRESOLVE),
        ACTION_TYPE.UNASSIGN: ("unassign", MessagingInteractionType.UNASSIGN),
    }

    def _issue_state_change(self, group: Group, identity: RpcIdentity, data) -> Response:
        event_write_key = ApiKey(
            organization_id=group.project.organization_id, scope_list=["event:write"]
        )

        action_data = self._make_action_data(data, identity.user_id)
        status, interaction_type = self._ACTION_TYPES[data["payload"]["actionType"]]
        analytics_event = f"integrations.msteams.{status}"
        analytics.record(
            analytics_event,
            actor_id=identity.user_id,
            organization_id=group.project.organization.id,
        )

        with MessagingInteractionEvent(
            interaction_type, MsTeamsMessagingSpec()
        ).capture() as lifecycle:
            response = client.put(
                path=f"/projects/{group.project.organization.slug}/{group.project.slug}/issues/",
                params={"id": group.id},
                data=action_data,
                user=user_service.get_user(user_id=identity.user_id),
                auth=event_write_key,
            )
            if response.status_code >= 400:
                lifecycle.record_failure()
            return response

    def _handle_action_submitted(self, request: Request) -> Response:
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

        integration = parsing.get_integration_from_card_action(data=data)
        if integration is None:
            logger.info(
                "msteams.action.missing-integration", extra={"integration_id": integration_id}
            )
            return self.respond(status=404)

        team_id = integration.external_id
        client = MsTeamsClient(integration)

        group = Group.objects.select_related("project__organization").filter(id=group_id).first()
        if group:
            integration = integration_service.get_integration(
                integration_id=integration.id, status=ObjectStatus.ACTIVE
            )
            if integration is None:
                group = None

        if integration is None or group is None:
            logger.info(
                "msteams.action.invalid-issue",
                extra={
                    "team_id": team_id,
                    "integration_id": (integration.id if integration else None),
                },
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
        issue_change_response = self._issue_state_change(group, identity, data["value"])

        # get the rules from the payload
        rules = tuple(Rule.objects.filter(id__in=payload["rules"]))

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

    def _handle_channel_message(self, request: Request) -> Response:
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

    def _handle_personal_message(self, request: Request) -> Response:
        data = request.data
        command_text = data.get("text", "").strip()

        dispatcher = MsTeamsCommandDispatcher(data)
        try:
            card = dispatcher.dispatch(CommandInput(command_text))
        except CommandNotMatchedError:
            card = build_unrecognized_command_card(command_text)

        client = get_preinstall_client(data["serviceUrl"])
        client.send_card(dispatcher.conversation_id, card)
        return self.respond(status=204)


@dataclass(frozen=True)
class MsTeamsCommandDispatcher(MessagingIntegrationCommandDispatcher[AdaptiveCard]):
    data: dict[str, Any]

    @property
    def integration_spec(self) -> MessagingIntegrationSpec:
        return MsTeamsMessagingSpec()

    @property
    def conversation_id(self) -> str:
        return self.data["conversation"]["id"]

    @property
    def teams_user_id(self) -> str:
        return self.data["from"]["id"]

    def help_handler(self, input: CommandInput) -> IntegrationResponse[AdaptiveCard]:
        return IntegrationResponse(
            interaction_result=EventLifecycleOutcome.SUCCESS,
            response=build_help_command_card(),
        )

    def link_user_handler(self, input: CommandInput) -> IntegrationResponse[AdaptiveCard]:
        linked_identity = identity_service.get_identity(
            filter={"identity_ext_id": self.teams_user_id}
        )
        has_linked_identity = linked_identity is not None

        if has_linked_identity:
            return IntegrationResponse(
                interaction_result=EventLifecycleOutcome.SUCCESS,
                response=build_already_linked_identity_command_card(),
                outcome_reason=str(MessageCommandHaltReason.ALREADY_LINKED),
                context_data={
                    "user_id": self.teams_user_id,
                    "identity_id": linked_identity.id if linked_identity else None,
                },
            )
        else:
            return IntegrationResponse(
                interaction_result=EventLifecycleOutcome.SUCCESS,
                response=build_link_identity_command_card(),
            )

    def unlink_user_handler(self, input: CommandInput) -> IntegrationResponse[AdaptiveCard]:
        unlink_url = build_unlinking_url(
            self.conversation_id, self.data["serviceUrl"], self.teams_user_id
        )
        # TODO: check if the user is already unlinked
        return IntegrationResponse(
            response=build_unlink_identity_card(unlink_url),
            interaction_result=EventLifecycleOutcome.SUCCESS,
        )

    @property
    def command_handlers(
        self,
    ) -> Iterable[tuple[MessagingIntegrationCommand, CommandHandler[AdaptiveCard]]]:

        yield commands.HELP, self.help_handler
        yield commands.LINK_IDENTITY, self.link_user_handler
        yield commands.UNLINK_IDENTITY, self.unlink_user_handler
