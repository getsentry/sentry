from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from collections.abc import Mapping, MutableMapping, Sequence
from typing import Any

import orjson
import requests as requests_
import sentry_sdk
from django.urls import reverse
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from slack_sdk.errors import SlackApiError
from slack_sdk.models.views import View
from slack_sdk.webhook import WebhookClient

from sentry import analytics
from sentry.api import client
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.client import ApiClient
from sentry.api.helpers.group_index import update_groups
from sentry.auth.access import from_member
from sentry.exceptions import UnableToAcceptMemberInvitationException
from sentry.integrations.messaging.metrics import (
    MessageInteractionFailureReason,
    MessagingInteractionEvent,
    MessagingInteractionType,
)
from sentry.integrations.services.integration import integration_service
from sentry.integrations.slack.analytics import (
    SlackIntegrationApproveMemberInvitation,
    SlackIntegrationAssign,
    SlackIntegrationChartUnfurlAction,
    SlackIntegrationRejectMemberInvitation,
    SlackIntegrationStatus,
)
from sentry.integrations.slack.message_builder.issues import SlackIssuesMessageBuilder
from sentry.integrations.slack.message_builder.routing import decode_action_id
from sentry.integrations.slack.message_builder.types import SlackAction
from sentry.integrations.slack.requests.action import SlackActionRequest
from sentry.integrations.slack.requests.base import SlackRequestError
from sentry.integrations.slack.sdk_client import SlackSdkClient
from sentry.integrations.slack.spec import SlackMessagingSpec
from sentry.integrations.slack.utils.errors import MODAL_NOT_FOUND, unpack_slack_api_error
from sentry.integrations.types import ExternalProviderEnum, IntegrationProviderSlug
from sentry.integrations.utils.scope import bind_org_context_from_integration
from sentry.models.activity import ActivityIntegration
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.organizationmember import InviteStatus, OrganizationMember
from sentry.models.rule import Rule
from sentry.notifications.services import notifications_service
from sentry.notifications.utils.actions import BlockKitMessageAction, MessageAction
from sentry.shared_integrations.exceptions import ApiError
from sentry.users.models import User
from sentry.users.services.user import RpcUser

_logger = logging.getLogger(__name__)

UNFURL_ACTION_OPTIONS = ["link", "ignore"]
NOTIFICATION_SETTINGS_ACTION_OPTIONS = ["all_slack"]

LINK_IDENTITY_MESSAGE = (
    "Looks like you haven't linked your Sentry account with your Slack identity yet! "
    "<{associate_url}|Link your identity now> to perform actions in Sentry through Slack. "
)
UNLINK_IDENTITY_MESSAGE = (
    "Looks like this Slack identity is linked to the Sentry user *{user_email}* "
    "who is not a member of organization *{org_name}* used with this Slack integration. "
    "<{associate_url}|Unlink your identity now>. "
)

NO_ACCESS_MESSAGE = "You do not have access to the organization for the invitation."
NO_PERMISSION_MESSAGE = "You do not have permission to approve member invitations."
NO_IDENTITY_MESSAGE = "Identity not linked for user."
ENABLE_SLACK_SUCCESS_MESSAGE = "Slack notifications have been enabled."

DEFAULT_ERROR_MESSAGE = "Sentry can't perform that action right now on your behalf!"
SUCCESS_MESSAGE = (
    "{invite_type} request for {email} has been {verb}. <{url}|See Members and Requests>."
)

RESOLVE_OPTIONS = {
    "Immediately": "resolved",
    "In the next release": "resolved:inNextRelease",
    "In the current release": "resolved:inCurrentRelease",
}

ARCHIVE_OPTIONS = {
    "Until escalating": "ignored:archived_until_escalating",
    "Until 10 events": "ignored:archived_until_condition_met:10",
    "Until 100 events": "ignored:archived_until_condition_met:100",
    "Until 1000 events": "ignored:archived_until_condition_met:1000",
    "Forever": "ignored:archived_forever",
}


def update_group(
    group: Group,
    user: RpcUser,
    data: Mapping[str, str],
    request: Request,
) -> Response:
    if not group.organization.has_access(user):
        raise client.ApiError(
            status_code=403, body="The user does not have access to the organization."
        )

    resp = update_groups(request=request, groups=[group], user=user, data=data)
    if resp.status_code != 200:
        _logger.error(
            "slack.action.update-group-error",
            extra={
                "group_id": group.id,
                "user_id": user.id,
                "data": data,
                "response": str(resp),
            },
        )

    return resp


def get_rule(
    slack_request: SlackActionRequest, organization: Organization, group_type: int
) -> Rule | None:
    from sentry.notifications.notification_action.utils import should_fire_workflow_actions

    """Get the rule that fired"""
    rule_id = slack_request.callback_data.get("rule")
    if not rule_id:
        return None
    try:
        rule = Rule.objects.get(id=rule_id)
        if should_fire_workflow_actions(organization, group_type):
            # We need to add the legacy_rule_id field to the rule data since the message builder will use it to build the link to the rule
            rule.data["actions"][0]["legacy_rule_id"] = rule.id
    except Rule.DoesNotExist:
        return None
    return rule


def get_group(slack_request: SlackActionRequest) -> Group | None:
    """Determine the issue group on which an action is being taken."""
    group_id = slack_request.callback_data["issue"]
    group = Group.objects.select_related("project__organization").filter(id=group_id).first()
    if group:
        if not integration_service.get_organization_integration(
            organization_id=group.project.organization_id,
            integration_id=slack_request.integration.id,
        ):
            group = None

    if not group:
        _logger.info(
            "slack.action.invalid-issue",
            extra={
                **slack_request.logging_data,
                "group_id": group_id,
            },
        )
        return None

    return group


def _is_message(data: Mapping[str, Any]) -> bool:
    """
    Bot posted messages will not have the type at all.
    """
    return data.get("original_message", {}).get("type") == "message"


@region_silo_endpoint
class SlackActionEndpoint(Endpoint):
    owner = ApiOwner.ECOSYSTEM
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    authentication_classes = ()
    permission_classes = ()
    slack_request_class = SlackActionRequest

    def respond_ephemeral(self, text: str) -> Response:
        return self.respond({"response_type": "ephemeral", "replace_original": False, "text": text})

    def api_error(
        self,
        slack_request: SlackActionRequest,
        group: Group,
        user: RpcUser,
        error: ApiClient.ApiError,
        action_type: str,
    ) -> Response:
        from sentry.integrations.slack.views.unlink_identity import build_unlinking_url

        _logger.info(
            "slack.action.api-error",
            extra={
                **slack_request.get_logging_data(group),
                "response": str(error.body),
                "action_type": action_type,
            },
        )
        channel_id = None
        response_url = None
        # the channel ID and response URL are in a different place if it's coming from a modal
        view = slack_request.data.get("view")
        if view:
            private_metadata = view.get("private_metadata")
            if private_metadata:
                data = orjson.loads(private_metadata)
                channel_id = data.get("channel_id")
                response_url = data.get("orig_response_url")

        user_id = slack_request.user_id
        channel = channel_id or slack_request.channel_id
        resp_url = response_url or slack_request.response_url

        if user_id is None or channel is None or resp_url is None:
            text = DEFAULT_ERROR_MESSAGE
        # keeping this separate from above since its a different condition
        elif error.status_code != 403:
            text = DEFAULT_ERROR_MESSAGE
        else:
            text = UNLINK_IDENTITY_MESSAGE.format(
                associate_url=build_unlinking_url(
                    slack_request.integration.id,
                    slack_id=user_id,
                    channel_id=channel,
                    response_url=resp_url,
                ),
                user_email=user.email,
                org_name=group.organization.name,
            )

        return self.respond_ephemeral(text)

    @staticmethod
    def _unpack_error_text(validation_error: serializers.ValidationError) -> str:
        detail = validation_error.detail
        while True:
            if isinstance(detail, dict):
                detail = list(detail.values())
            element = detail[0]
            if isinstance(element, str):
                return element
            detail = element

    def record_event(
        self, interaction_type: MessagingInteractionType, group: Group, request: Request
    ) -> MessagingInteractionEvent:
        user = request.user
        return MessagingInteractionEvent(
            interaction_type,
            SlackMessagingSpec(),
            user=(user if isinstance(user, User) else None),
            organization=(group.project.organization if group else None),
        )

    def validation_error(
        self,
        slack_request: SlackActionRequest,
        group: Group,
        error: serializers.ValidationError,
        action_type: str,
    ) -> Response:
        _logger.info(
            "slack.action.validation-error",
            extra={
                **slack_request.get_logging_data(group),
                "response": str(error.detail),
                "action_type": action_type,
            },
        )

        text: str = self._unpack_error_text(error)
        return self.respond_ephemeral(text)

    def on_assign(
        self,
        request: Request,
        user: RpcUser,
        group: Group,
        action: MessageAction | BlockKitMessageAction,
    ) -> None:
        if not (action.selected_options and len(action.selected_options)):
            # Short-circuit if action is invalid
            return
        assignee = action.selected_options[0]["value"]
        if assignee == "none":
            assignee = None

        update_group(
            group,
            user,
            {
                "assignedTo": assignee,
                "integration": ActivityIntegration.SLACK.value,
            },
            request,
        )
        analytics.record(SlackIntegrationAssign(actor_id=user.id))

    def on_status(
        self,
        request: Request,
        user: RpcUser,
        group: Group,
        action: MessageAction | BlockKitMessageAction,
    ) -> None:
        status_data = (action.value or "").split(":", 2)
        if not len(status_data):
            return

        status: MutableMapping[str, Any] = {
            "status": status_data[0],
        }

        # sub-status only applies to ignored/archived issues
        if len(status_data) > 1 and status_data[0] == "ignored":
            status["substatus"] = status_data[1]
            if status["substatus"] == "archived_until_condition_met":
                status.update({"statusDetails": {"ignoreCount": int(status_data[2])}})

        resolve_type = status_data[-1]

        if resolve_type == "inNextRelease":
            status.update({"statusDetails": {"inNextRelease": True}})
        elif resolve_type == "inCurrentRelease":
            status.update({"statusDetails": {"inRelease": "latest"}})

        update_group(group, user, status, request)

        analytics.record(
            SlackIntegrationStatus(
                organization_id=group.project.organization.id,
                status=status["status"],
                resolve_type=resolve_type,
                user_id=user.id,
            )
        )

    def _handle_group_actions(
        self,
        slack_request: SlackActionRequest,
        request: Request,
        action_list: Sequence[BlockKitMessageAction],
    ) -> Response:
        from sentry.integrations.slack.views.link_identity import build_linking_url

        group = get_group(slack_request)
        if not group:
            return self.respond(status=403)

        rule = get_rule(slack_request, group.organization, group.type)
        identity = slack_request.get_identity()
        # Determine the acting user by Slack identity.
        identity_user = slack_request.get_identity_user()

        if not identity or not identity_user:
            # if we don't have user_id or channel_id, we can't link the identity
            if not slack_request.user_id or not slack_request.channel_id:
                return self.respond_ephemeral(NO_IDENTITY_MESSAGE)

            associate_url = build_linking_url(
                integration=slack_request.integration,
                slack_id=slack_request.user_id,
                channel_id=slack_request.channel_id,
                response_url=slack_request.response_url,
            )
            return self.respond_ephemeral(LINK_IDENTITY_MESSAGE.format(associate_url=associate_url))

        original_tags_from_request = slack_request.get_tags()

        if slack_request.type == "view_submission":
            # TODO: if we use modals for something other than resolve and archive, this will need to be more specific
            with self.record_event(
                MessagingInteractionType.VIEW_SUBMISSION, group, request
            ).capture() as lifecycle:
                lifecycle.add_extras(
                    {
                        "integration_id": slack_request.integration.id,
                        "organization_id": group.project.organization_id,
                    }
                )

                # Masquerade a status action
                selection = None
                view = slack_request.data.get("view")
                if view:
                    state = view.get("state")
                if state:
                    values = state.get("values")
                if values:
                    for value in values:
                        for val in values[value]:
                            selection = values[value][val]["selected_option"]["value"]
                            if selection:
                                break

                if not selection:
                    lifecycle.record_failure(MessageInteractionFailureReason.MISSING_ACTION)
                    return self.respond()

                lifecycle.add_extra("selection", selection)
                status_action = MessageAction(name="status", value=selection)

                try:
                    self.on_status(request, identity_user, group, status_action)
                except client.ApiError as error:
                    lifecycle.record_failure(error)
                    return self.api_error(
                        slack_request, group, identity_user, error, "status_dialog"
                    )

                view = View(**slack_request.data["view"])
                assert view.private_metadata is not None
                private_metadata = orjson.loads(view.private_metadata)
                original_tags_from_request = set(private_metadata.get("tags", {}))

                blocks = SlackIssuesMessageBuilder(
                    group,
                    identity=identity,
                    actions=[status_action],
                    tags=original_tags_from_request,
                    rules=[rule] if rule else None,
                    issue_details=True,
                    skip_fallback=True,
                ).build()

                # use the original response_url to update the link attachment
                try:
                    webhook_client = WebhookClient(private_metadata["orig_response_url"])
                    webhook_client.send(
                        blocks=blocks.get("blocks"), delete_original=False, replace_original=True
                    )
                except SlackApiError as e:
                    lifecycle.record_failure(e)

                return self.respond()

        # Usually we'll want to respond with the updated attachment including
        # the list of actions taken. However, when opening a dialog we do not
        # have anything to update the message with and will use the
        # response_url later to update it.
        defer_attachment_update = False

        # Handle interaction actions
        for action in action_list:
            try:
                if action.name in ("status", "unresolved:ongoing"):
                    with self.record_event(
                        MessagingInteractionType.STATUS, group, request
                    ).capture():
                        self.on_status(request, identity_user, group, action)
                elif (
                    action.name == "assign"
                ):  # TODO: remove this as it is replaced by the options-load endpoint
                    with self.record_event(
                        MessagingInteractionType.ASSIGN, group, request
                    ).capture():
                        self.on_assign(request, identity_user, group, action)
                elif action.name == "resolve_dialog":
                    with self.record_event(
                        MessagingInteractionType.RESOLVE_DIALOG, group, request
                    ).capture():
                        _ResolveDialog().open_dialog(slack_request, group)
                    defer_attachment_update = True
                elif action.name == "archive_dialog":
                    with self.record_event(
                        MessagingInteractionType.ARCHIVE_DIALOG, group, request
                    ).capture():
                        _ArchiveDialog().open_dialog(slack_request, group)
                    defer_attachment_update = True
                elif action.name == SlackAction.SEER_AUTOFIX_START:
                    with self.record_event(
                        MessagingInteractionType.SEER_AUTOFIX_START, group, request
                    ).capture():
                        # TODO(Leander): Implement this
                        pass
                    defer_attachment_update = True
            except client.ApiError as error:
                return self.api_error(slack_request, group, identity_user, error, action.name)
            except serializers.ValidationError as error:
                return self.validation_error(slack_request, group, error, action.name)

        if defer_attachment_update:
            return self.respond()

        # Reload group as it may have been mutated by the action
        group = Group.objects.get(id=group.id)

        response = SlackIssuesMessageBuilder(
            group,
            identity=identity,
            actions=action_list,
            tags=original_tags_from_request,
            rules=[rule] if rule else None,
        ).build()
        # XXX(isabella): for actions on link unfurls, we omit the fallback text from the
        # response so the unfurling endpoint understands the payload
        if (
            slack_request.data.get("container")
            and slack_request.data["container"].get("is_app_unfurl")
            and "text" in response
        ):
            del response["text"]

        if not slack_request.data.get("response_url"):
            # XXX: when you click an option in a modal dropdown it submits the request even though "Submit" has not been clicked
            return self.respond()

        response_url = slack_request.data["response_url"]
        webhook_client = WebhookClient(response_url)
        try:
            webhook_client.send(
                blocks=response.get("blocks"),
                text=response.get("text"),
                delete_original=False,
                replace_original=True,
            )
        except SlackApiError:
            _logger.info(
                "slack.webhook.update_status.response-error",
                extra={
                    "integration_id": slack_request.integration.id,
                    "blocks": response.get("blocks"),
                },
            )

        return self.respond(response)

    def handle_unfurl(self, slack_request: SlackActionRequest, action: str) -> Response:
        organization_integrations = integration_service.get_organization_integrations(
            integration_id=slack_request.integration.id, limit=1
        )
        if len(organization_integrations) > 0:
            analytics.record(
                SlackIntegrationChartUnfurlAction(
                    organization_id=organization_integrations[0].id,
                    action=action,
                )
            )
        payload = {"delete_original": "true"}
        try:
            requests_.post(slack_request.response_url, json=payload)
        except ApiError:
            _logger.exception("slack.action.response-error")
            return self.respond(status=403)

        return self.respond()

    def handle_seer_context_input(self, slack_request: SlackActionRequest) -> Response:
        actions_list = slack_request.data.get("actions", [])
        if not actions_list:
            return self.respond(status=400)

        # TODO(Leander): Implement this
        return self.respond()

    @classmethod
    def get_action_option(cls, slack_request: SlackActionRequest) -> tuple[str | None, str | None]:
        action_option, action_id = None, None
        for action_data in slack_request.data.get("actions", []):
            # Get the _first_ value in the action list.
            value = action_data.get("value")
            if value:
                action_id = action_data.get("action_id")
                action_option = value
                break

        return action_option, action_id

    @classmethod
    def get_action_list(cls, slack_request: SlackActionRequest) -> list[BlockKitMessageAction]:
        action_data = slack_request.data.get("actions")
        if not action_data or not isinstance(action_data, list):
            return []

        action_list = []
        for action_data in action_data:
            routing_data = decode_action_id(action_data.get("action_id", ""))
            action_name = routing_data.action

            if not action_name:
                continue

            if action_data.get("type") in ("static_select", "external_select"):
                action = BlockKitMessageAction(
                    name=action_name,
                    label=action_data["selected_option"]["text"]["text"],
                    type=action_data["type"],
                    value=action_data["selected_option"]["value"],
                    action_id=action_data["action_id"],
                    block_id=action_data["block_id"],
                    selected_options=[
                        {"value": action_data.get("selected_option", {}).get("value")}
                    ],
                )
                # TODO: selected_options is kinda ridiculous, I think this is built to handle multi-select?
            else:
                action = BlockKitMessageAction(
                    name=action_name,
                    label=action_data["text"]["text"],
                    type=action_data["type"],
                    value=action_data["value"],
                    action_id=action_data["action_id"],
                    block_id=action_data["block_id"],
                )
            action_list.append(action)

        return action_list

    def post(self, request: Request) -> Response:
        try:
            slack_request = self.slack_request_class(request)
            slack_request.validate()
        except SlackRequestError as e:
            _logger.info(
                "slack.action.request-error", extra={"error": str(e), "status_code": e.status}
            )
            return self.respond(status=e.status)

        _logger.info(
            "slack.action.request",
            extra={
                "trigger_id": slack_request.data.get("trigger_id"),
                "integration_id": slack_request.integration.id,
                "request_data": slack_request.data,
            },
        )

        # Set organization scope

        bind_org_context_from_integration(slack_request.integration.id)
        sentry_sdk.set_tag("integration_id", slack_request.integration.id)

        # Actions list may be empty when receiving a dialog response.

        action_option, action_id = self.get_action_option(slack_request=slack_request)

        # If a user is just clicking a button link we return a 200
        if action_option in (
            "sentry_docs_link_clicked",
            "grace_period_warning",
            "integration_disabled_slack",
            "trial_end_warning",
            "link_clicked",
        ):
            return self.respond()

        if action_option in UNFURL_ACTION_OPTIONS:
            return self.handle_unfurl(slack_request, action_option)

        if action_option in ["approve_member", "reject_member"]:
            return self.handle_member_approval(slack_request, action_option)

        if action_option in NOTIFICATION_SETTINGS_ACTION_OPTIONS:
            return self.handle_enable_notifications(slack_request)

        if action_id == SlackAction.SEER_CONTEXT_INPUT.value:
            return self.handle_seer_context_input(slack_request=slack_request)

        action_list = self.get_action_list(slack_request=slack_request)
        return self._handle_group_actions(slack_request, request, action_list)

    def handle_enable_notifications(self, slack_request: SlackActionRequest) -> Response:
        identity_user = slack_request.get_identity_user()

        if not identity_user:
            return self.respond_with_text(NO_IDENTITY_MESSAGE)

        notifications_service.enable_all_settings_for_provider(
            external_provider=ExternalProviderEnum.SLACK,
            user_id=identity_user.id,
        )
        return self.respond_with_text(ENABLE_SLACK_SUCCESS_MESSAGE)

    def handle_member_approval(self, slack_request: SlackActionRequest, action: str) -> Response:
        identity_user = slack_request.get_identity_user()

        response_url = slack_request.data["response_url"]
        webhook_client = WebhookClient(response_url)

        if not identity_user:
            webhook_client.send(
                text=NO_IDENTITY_MESSAGE, response_type="in_channel", replace_original=False
            )
            return self.respond()

        member_id = slack_request.callback_data["member_id"]

        try:
            member = OrganizationMember.objects.get_member_invite_query(member_id).get()
        except OrganizationMember.DoesNotExist:
            # member request is gone, likely someone else rejected it
            member_email = slack_request.callback_data["member_email"]
            webhook_client.send(
                text=f"Member invitation for {member_email} no longer exists.",
                response_type="in_channel",
                replace_original=False,
            )
            return self.respond()

        organization = member.organization

        if not organization.has_access(identity_user):
            webhook_client.send(
                text=NO_ACCESS_MESSAGE,
                response_type="in_channel",
                replace_original=False,
            )
            return self.respond()

        # row should exist because we have access
        member_of_approver = OrganizationMember.objects.get(
            user_id=identity_user.id, organization=organization
        )
        access = from_member(member_of_approver)
        if not access.has_scope("member:admin"):
            webhook_client.send(
                text=NO_PERMISSION_MESSAGE, replace_original=False, response_type="in_channel"
            )
            return self.respond()

        # validate the org options and check against allowed_roles
        allowed_roles = member_of_approver.get_allowed_org_roles_to_invite()
        try:
            member.validate_invitation(identity_user, allowed_roles)
        except UnableToAcceptMemberInvitationException as err:
            webhook_client.send(text=str(err), replace_original=False, response_type="in_channel")
            return self.respond()

        original_status = InviteStatus(member.invite_status)
        try:
            if action == "approve_member":
                member.approve_member_invitation(
                    identity_user, referrer=IntegrationProviderSlug.SLACK.value
                )
            else:
                member.reject_member_invitation(identity_user)
        except Exception:
            # shouldn't error but if it does, respond to the user
            _logger.exception(
                "slack.action.member-invitation-error",
                extra={
                    "organization_id": organization.id,
                    "member_id": member.id,
                },
            )
            webhook_client.send(
                text=DEFAULT_ERROR_MESSAGE, replace_original=False, response_type="in_channel"
            )
            return self.respond()

        if original_status == InviteStatus.REQUESTED_TO_BE_INVITED:
            invite_type = "Invite"
        else:
            invite_type = "Join"

        if action == "approve_member":
            event = SlackIntegrationApproveMemberInvitation(
                actor_id=identity_user.id,
                organization_id=member.organization_id,
                invitation_type=invite_type.lower(),
                invited_member_id=member.id,
            )
            verb = "approved"
        else:
            event = SlackIntegrationRejectMemberInvitation(
                actor_id=identity_user.id,
                organization_id=member.organization_id,
                invitation_type=invite_type.lower(),
                invited_member_id=member.id,
            )
            verb = "rejected"

        analytics.record(event)

        manage_url = member.organization.absolute_url(
            reverse("sentry-organization-members", args=[member.organization.slug])
        )

        message = SUCCESS_MESSAGE.format(
            email=member.email,
            invite_type=invite_type,
            url=manage_url,
            verb=verb,
        )

        webhook_client.send(text=message, replace_original=False, response_type="in_channel")
        return self.respond()


class _ModalDialog(ABC):
    @property
    @abstractmethod
    def dialog_type(self) -> str:
        raise NotImplementedError

    def _build_format_options(self, options: dict[str, str]) -> list[dict[str, Any]]:
        return [
            {
                "text": {
                    "type": "plain_text",
                    "text": text,
                    "emoji": True,
                },
                "value": value,
            }
            for text, value in options.items()
        ]

    def build_modal_payload(
        self,
        title: str,
        action_text: str,
        options: dict[str, str],
        initial_option_text: str,
        initial_option_value: str,
        callback_id: str,
        metadata: str,
    ) -> View:
        formatted_options = self._build_format_options(options)

        return View(
            type="modal",
            title={"type": "plain_text", "text": f"{title} Issue"},
            blocks=[
                {
                    "type": "section",
                    "text": {"type": "mrkdwn", "text": action_text},
                    "accessory": {
                        "type": "static_select",
                        "initial_option": {
                            "text": {
                                "type": "plain_text",
                                "text": initial_option_text,
                                "emoji": True,
                            },
                            "value": initial_option_value,
                        },
                        "options": formatted_options,
                        "action_id": "static_select-action",
                    },
                }
            ],
            close={"type": "plain_text", "text": "Cancel"},
            submit={"type": "plain_text", "text": title},
            private_metadata=metadata,
            callback_id=callback_id,
        )

    @abstractmethod
    def get_modal_payload(self, callback_id: str, metadata: str) -> View:
        raise NotImplementedError

    def _update_modal(
        self,
        slack_client: SlackSdkClient,
        external_id: str,
        modal_payload: View,
        slack_request: SlackActionRequest,
    ) -> None:
        try:
            slack_client.views_update(
                external_id=external_id,
                view=modal_payload,
            )
        except SlackApiError as e:
            # If the external_id is not found, Slack we send `not_found` error
            # https://api.slack.com/methods/views.update
            if unpack_slack_api_error(e) == MODAL_NOT_FOUND:
                logging_data = slack_request.get_logging_data()
                _logger.info(
                    "slack.action.update-modal-not-found",
                    extra={
                        **logging_data,
                        "dialog": self.dialog_type,
                    },
                )
                # The modal was not found, so we need to open a new one
                self._open_modal(slack_client, modal_payload, slack_request)
            else:
                raise

    def _open_modal(
        self, slack_client: SlackSdkClient, modal_payload: View, slack_request: SlackActionRequest
    ) -> None:
        # Error handling is done in the calling function
        slack_client.views_open(
            trigger_id=slack_request.data["trigger_id"],
            view=modal_payload,
        )

    def open_dialog(self, slack_request: SlackActionRequest, group: Group) -> None:
        # XXX(epurkhiser): In order to update the original message we have to
        # keep track of the response_url in the callback_id. Definitely hacky,
        # but seems like there's no other solutions [1]:
        #
        # [1]: https://stackoverflow.com/questions/46629852/update-a-bot-message-after-responding-to-a-slack-dialog#comment80795670_46629852
        org = group.project.organization
        callback_id_dict = {
            "issue": group.id,
            "orig_response_url": slack_request.data["response_url"],
            "is_message": _is_message(slack_request.data),
            "rule": slack_request.callback_data.get("rule"),
        }

        if slack_request.data.get("channel"):
            callback_id_dict["channel_id"] = slack_request.data["channel"]["id"]
        callback_id = orjson.dumps(callback_id_dict).decode()

        # only add tags to metadata
        metadata_dict = callback_id_dict.copy()
        metadata_dict["tags"] = list(slack_request.get_tags())
        metadata = orjson.dumps(metadata_dict).decode()

        # XXX(CEO): the second you make a selection (without hitting Submit) it sends a slightly different request
        modal_payload = self.get_modal_payload(callback_id, metadata=metadata)
        slack_client = SlackSdkClient(integration_id=slack_request.integration.id)
        try:
            # We need to use the action_ts as the external_id to update the modal
            # We passed this in control when we sent the loading modal to beat the 3 second timeout
            external_id = slack_request.get_action_ts()

            if not external_id:
                # If we don't have an external_id or option is disabled we need to open a new modal
                self._open_modal(slack_client, modal_payload, slack_request)
            else:
                self._update_modal(slack_client, external_id, modal_payload, slack_request)

        except SlackApiError as e:
            _logger.info(
                "slack.action.response-error",
                extra={
                    "organization_id": org.id,
                    "integration_id": slack_request.integration.id,
                    "exec_summary": repr(e),
                },
            )


class _ResolveDialog(_ModalDialog):
    @property
    def dialog_type(self) -> str:
        return "resolve"

    def get_modal_payload(self, callback_id: str, metadata: str) -> View:
        return self.build_modal_payload(
            title="Resolve",
            action_text="Resolve",
            options=RESOLVE_OPTIONS,
            initial_option_text="Immediately",
            initial_option_value="resolved",
            callback_id=callback_id,
            metadata=metadata,
        )


class _ArchiveDialog(_ModalDialog):
    @property
    def dialog_type(self) -> str:
        return "archive"

    def get_modal_payload(self, callback_id: str, metadata: str) -> View:
        return self.build_modal_payload(
            title="Archive",
            action_text="Archive",
            options=ARCHIVE_OPTIONS,
            initial_option_text="Until escalating",
            initial_option_value="ignored:archived_until_escalating",
            callback_id=callback_id,
            metadata=metadata,
        )
