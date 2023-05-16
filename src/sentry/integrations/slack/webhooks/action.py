from __future__ import annotations

from typing import Any, List, Mapping, MutableMapping, Sequence

import requests as requests_
from django.urls import reverse
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics
from sentry.api import ApiClient, client
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.helpers.group_index import update_groups
from sentry.auth.access import from_member
from sentry.exceptions import UnableToAcceptMemberInvitationException
from sentry.integrations.slack.client import SlackClient
from sentry.integrations.slack.message_builder import SlackBody
from sentry.integrations.slack.message_builder.issues import SlackIssuesMessageBuilder
from sentry.integrations.slack.requests.action import SlackActionRequest
from sentry.integrations.slack.requests.base import SlackRequestError
from sentry.integrations.slack.views.link_identity import build_linking_url
from sentry.integrations.slack.views.unlink_identity import build_unlinking_url
from sentry.models import Group, InviteStatus, OrganizationMember
from sentry.models.activity import ActivityIntegration
from sentry.notifications.defaults import NOTIFICATION_SETTINGS_ALL_SOMETIMES
from sentry.notifications.utils.actions import MessageAction
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.services.hybrid_cloud.notifications import notifications_service
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.shared_integrations.exceptions import ApiError
from sentry.types.integrations import ExternalProviders
from sentry.utils import json
from sentry.web.decorators import transaction_start

from ..utils import logger

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

RESOLVE_SELECTOR = {
    "label": "Resolve issue",
    "type": "select",
    "name": "resolve_type",
    "placeholder": "Select the resolution target",
    "value": "resolved",
    "options": [
        {"label": "Immediately", "value": "resolved"},
        {"label": "In the next release", "value": "resolved:inNextRelease"},
        {"label": "In the current release", "value": "resolved:inCurrentRelease"},
    ],
}


def update_group(
    group: Group,
    user: RpcUser,
    data: Mapping[str, str],
    request: Request,
) -> Response:
    if not group.organization.has_access(user):
        raise ApiClient.ApiError(
            status_code=403, body="The user does not have access to the organization."
        )

    return update_groups(
        request=request,
        group_ids=[group.id],
        projects=[group.project],
        organization_id=group.organization.id,
        search_fn=None,
        user=user,
        data=data,
    )


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
        logger.info(
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
    XXX(epurkhiser): Used in coordination with construct_reply.
     Bot posted messages will not have the type at all.
    """
    # Explicitly typing to satisfy mypy.
    is_message: bool = data.get("original_message", {}).get("type") == "message"
    return is_message


@region_silo_endpoint
class SlackActionEndpoint(Endpoint):  # type: ignore
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
        logger.info(
            "slack.action.api-error",
            extra={
                **slack_request.get_logging_data(group),
                "response": str(error.body),
                "action_type": action_type,
            },
        )

        if error.status_code == 403:
            text = UNLINK_IDENTITY_MESSAGE.format(
                associate_url=build_unlinking_url(
                    slack_request.integration.id,
                    slack_request.user_id,
                    slack_request.channel_id,
                    slack_request.response_url,
                ),
                user_email=user.email,
                org_name=group.organization.name,
            )
        else:
            text = DEFAULT_ERROR_MESSAGE

        return self.respond_ephemeral(text)

    def validation_error(
        self,
        slack_request: SlackActionRequest,
        group: Group,
        error: serializers.ValidationError,
        action_type: str,
    ) -> Response:
        logger.info(
            "slack.action.validation-error",
            extra={
                **slack_request.get_logging_data(group),
                "response": str(error.detail),
                "action_type": action_type,
            },
        )

        text: str = list(*error.detail.values())[0]
        return self.respond_ephemeral(text)

    def on_assign(
        self, request: Request, user: RpcUser, group: Group, action: MessageAction
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
        analytics.record("integrations.slack.assign", actor_id=user.id)

    def on_status(
        self,
        request: Request,
        user: RpcUser,
        group: Group,
        action: MessageAction,
    ) -> None:
        status_data = (action.value or "").split(":", 1)
        if not len(status_data):
            return

        status: MutableMapping[str, Any] = {
            "status": status_data[0],
        }

        if len(status_data) > 1:
            status["substatus"] = status_data[1]

        resolve_type = status_data[-1]

        if resolve_type == "inNextRelease":
            status.update({"statusDetails": {"inNextRelease": True}})
        elif resolve_type == "inCurrentRelease":
            status.update({"statusDetails": {"inRelease": "latest"}})

        update_group(group, user, status, request)

        analytics.record(
            "integrations.slack.status",
            status=status["status"],
            resolve_type=resolve_type,
            actor_id=user.id,
        )

    def open_resolve_dialog(self, slack_request: SlackActionRequest, group: Group) -> None:
        # XXX(epurkhiser): In order to update the original message we have to
        # keep track of the response_url in the callback_id. Definitely hacky,
        # but seems like there's no other solutions [1]:
        #
        # [1]: https://stackoverflow.com/questions/46629852/update-a-bot-message-after-responding-to-a-slack-dialog#comment80795670_46629852
        callback_id = json.dumps(
            {
                "issue": group.id,
                "orig_response_url": slack_request.data["response_url"],
                "is_message": _is_message(slack_request.data),
            }
        )

        dialog = {
            "callback_id": callback_id,
            "title": "Resolve Issue",
            "submit_label": "Resolve",
            "elements": [RESOLVE_SELECTOR],
        }

        payload = {
            "dialog": json.dumps(dialog),
            "trigger_id": slack_request.data["trigger_id"],
        }
        slack_client = SlackClient(integration_id=slack_request.integration.id)
        try:
            slack_client.post("/dialog.open", data=payload)
        except ApiError as e:
            logger.error("slack.action.response-error", extra={"error": str(e)})

    def construct_reply(self, attachment: SlackBody, is_message: bool = False) -> SlackBody:
        # XXX(epurkhiser): Slack is inconsistent about it's expected responses
        # for interactive action requests.
        #
        #  * For _unfurled_ action responses, slack expects the entire
        #    attachment body used to replace the unfurled attachment to be at
        #    the top level of the json response body.
        #
        #  * For _bot posted message_ action responses, slack expects the
        #    attachment body used to replace the attachment to be within an
        #    `attachments` array.
        if is_message:
            attachment = {"attachments": [attachment]}

        return attachment

    def _handle_group_actions(
        self,
        slack_request: SlackActionRequest,
        request: Request,
        action_list: Sequence[MessageAction],
    ) -> Response:
        group = get_group(slack_request)
        if not group:
            return self.respond(status=403)

        identity = slack_request.get_identity()
        # Determine the acting user by Slack identity.
        identity_user = slack_request.get_identity_user()

        if not identity or not identity_user:
            associate_url = build_linking_url(
                integration=slack_request.integration,
                slack_id=slack_request.user_id,
                channel_id=slack_request.channel_id,
                response_url=slack_request.response_url,
            )
            return self.respond_ephemeral(LINK_IDENTITY_MESSAGE.format(associate_url=associate_url))

        original_tags_from_request = slack_request.get_tags()
        # Handle status dialog submission
        if (
            slack_request.type == "dialog_submission"
            and "resolve_type" in slack_request.data["submission"]
        ):
            # Masquerade a status action
            action = MessageAction(
                name="status",
                value=slack_request.data["submission"]["resolve_type"],
            )

            try:
                self.on_status(request, identity_user, group, action)
            except client.ApiError as error:
                return self.api_error(slack_request, group, identity_user, error, "status_dialog")

            attachment = SlackIssuesMessageBuilder(
                group, identity=identity, actions=[action], tags=original_tags_from_request
            ).build()
            body = self.construct_reply(
                attachment, is_message=slack_request.callback_data["is_message"]
            )

            # use the original response_url to update the link attachment
            slack_client = SlackClient(integration_id=slack_request.integration.id)
            try:
                slack_client.post(
                    slack_request.callback_data["orig_response_url"], data=body, json=True
                )
            except ApiError as e:
                logger.error("slack.action.response-error", extra={"error": str(e)})

            return self.respond()

        # Usually we'll want to respond with the updated attachment including
        # the list of actions taken. However, when opening a dialog we do not
        # have anything to update the message with and will use the
        # response_url later to update it.
        defer_attachment_update = False

        # Handle interaction actions
        for action in action_list:
            try:
                if action.name == "status":
                    self.on_status(request, identity_user, group, action)
                elif action.name == "assign":
                    self.on_assign(request, identity_user, group, action)
                elif action.name == "resolve_dialog":
                    self.open_resolve_dialog(slack_request, group)
                    defer_attachment_update = True
            except client.ApiError as error:
                return self.api_error(slack_request, group, identity_user, error, action.name)
            except serializers.ValidationError as error:
                return self.validation_error(slack_request, group, error, action.name)

        if defer_attachment_update:
            return self.respond()

        # Reload group as it may have been mutated by the action
        group = Group.objects.get(id=group.id)

        attachment = SlackIssuesMessageBuilder(
            group, identity=identity, actions=action_list, tags=original_tags_from_request
        ).build()
        body = self.construct_reply(attachment, is_message=_is_message(slack_request.data))

        return self.respond(body)

    def handle_unfurl(self, slack_request: SlackActionRequest, action: str) -> Response:
        organization_integrations = integration_service.get_organization_integrations(
            integration_id=slack_request.integration.id, limit=1
        )
        if len(organization_integrations) > 0:
            analytics.record(
                "integrations.slack.chart_unfurl_action",
                organization_id=organization_integrations[0].id,
                action=action,
            )
        payload = {"delete_original": "true"}
        try:
            requests_.post(slack_request.response_url, json=payload)
        except ApiError as e:
            logger.error("slack.action.response-error", extra={"error": str(e)})
            return self.respond(status=403)

        return self.respond()

    @classmethod
    def get_action_option(cls, slack_request: SlackActionRequest) -> str | None:
        action_option = None
        for action_data in slack_request.data.get("actions", []):
            # Get the _first_ value in the action list.
            value = action_data.get("value")
            if value and not action_option:
                action_option = value
        return action_option

    @classmethod
    def get_action_list(cls, slack_request: SlackActionRequest) -> List[MessageAction]:
        return [
            MessageAction(**action_data)
            for action_data in slack_request.data.get("actions", [])
            if "name" in action_data
        ]

    @transaction_start("SlackActionEndpoint")
    def post(self, request: Request) -> Response:
        try:
            slack_request = self.slack_request_class(request)
            slack_request.validate()
        except SlackRequestError as e:
            return self.respond(status=e.status)

        # Actions list may be empty when receiving a dialog response.

        action_option = self.get_action_option(slack_request=slack_request)

        # If a user is just clicking our auto response in the messages tab we just return a 200
        if action_option == "sentry_docs_link_clicked":
            return self.respond()

        if action_option in UNFURL_ACTION_OPTIONS:
            return self.handle_unfurl(slack_request, action_option)

        if action_option in ["approve_member", "reject_member"]:
            return self.handle_member_approval(slack_request, action_option)

        if action_option in NOTIFICATION_SETTINGS_ACTION_OPTIONS:
            return self.handle_enable_notifications(slack_request)

        action_list = self.get_action_list(slack_request=slack_request)
        return self._handle_group_actions(slack_request, request, action_list)

    def handle_enable_notifications(self, slack_request: SlackActionRequest) -> Response:
        identity_user = slack_request.get_identity_user()

        if not identity_user:
            return self.respond_with_text(NO_IDENTITY_MESSAGE)

        notifications_service.bulk_update_settings(
            external_provider=ExternalProviders.SLACK,
            actor=RpcActor.from_object(identity_user),
            notification_type_to_value_map=NOTIFICATION_SETTINGS_ALL_SOMETIMES,
        )
        return self.respond_with_text(ENABLE_SLACK_SUCCESS_MESSAGE)

    def handle_member_approval(self, slack_request: SlackActionRequest, action: str) -> Response:
        identity_user = slack_request.get_identity_user()

        if not identity_user:
            return self.respond_with_text(NO_IDENTITY_MESSAGE)

        member_id = slack_request.callback_data["member_id"]

        try:
            member = OrganizationMember.objects.get_member_invite_query(member_id).get()
        except OrganizationMember.DoesNotExist:
            # member request is gone, likely someone else rejected it
            member_email = slack_request.callback_data["member_email"]
            return self.respond_with_text(f"Member invitation for {member_email} no longer exists.")

        organization = member.organization

        if not organization.has_access(identity_user):
            return self.respond_with_text(NO_ACCESS_MESSAGE)

        # row should exist because we have access
        member_of_approver = OrganizationMember.objects.get(
            user_id=identity_user.id, organization=organization
        )
        access = from_member(member_of_approver)
        if not access.has_scope("member:admin"):
            return self.respond_with_text(NO_PERMISSION_MESSAGE)

        # validate the org options and check against allowed_roles
        allowed_roles = member_of_approver.get_allowed_org_roles_to_invite()
        try:
            member.validate_invitation(identity_user, allowed_roles)
        except UnableToAcceptMemberInvitationException as err:
            return self.respond_with_text(str(err))

        original_status = InviteStatus(member.invite_status)
        try:
            if action == "approve_member":
                member.approve_member_invitation(identity_user, referrer="slack")
            else:
                member.reject_member_invitation(identity_user)
        except Exception as err:
            # shouldn't error but if it does, respond to the user
            logger.error(
                err,
                extra={
                    "organization_id": organization.id,
                    "member_id": member.id,
                },
            )
            return self.respond_ephemeral(DEFAULT_ERROR_MESSAGE)

        if action == "approve_member":
            event_name = "integrations.slack.approve_member_invitation"
            verb = "approved"
        else:
            event_name = "integrations.slack.reject_member_invitation"
            verb = "rejected"

        if original_status == InviteStatus.REQUESTED_TO_BE_INVITED:
            invite_type = "Invite"
        else:
            invite_type = "Join"

        analytics.record(
            event_name,
            actor_id=identity_user.id,
            organization_id=member.organization_id,
            invitation_type=invite_type.lower(),
            invited_member_id=member_id,
        )

        manage_url = member.organization.absolute_url(
            reverse("sentry-organization-members", args=[member.organization.slug])
        )

        message = SUCCESS_MESSAGE.format(
            email=member.email,
            invite_type=invite_type,
            url=manage_url,
            verb=verb,
        )

        return self.respond({"text": message})
