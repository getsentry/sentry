from __future__ import annotations

from typing import Any, Mapping, MutableMapping

import requests as requests_
from django.urls import reverse
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics
from sentry.api import ApiClient, client
from sentry.api.base import Endpoint
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
from sentry.models import (
    Group,
    Identity,
    IdentityProvider,
    Integration,
    InviteStatus,
    OrganizationMember,
    Project,
)
from sentry.notifications.utils.actions import MessageAction
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils import json
from sentry.utils.http import absolute_uri
from sentry.web.decorators import transaction_start

from ..utils import logger

LINK_IDENTITY_MESSAGE = (
    "Looks like you haven't linked your Sentry account with your Slack identity yet! "
    "<{associate_url}|Link your identity now> to perform actions in Sentry through Slack. "
)
UNLINK_IDENTITY_MESSAGE = (
    "Looks like this Slack identity is linked to the Sentry user *{user_email}* "
    "who is not a member of organization *{org_name}* used with this Slack integration. "
    "<{associate_url}|Unlink your identity now>. "
)
DEFAULT_ERROR_MESSAGE = "Sentry can't perform that action right now on your behalf!"

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
    identity: Identity,
    data: Mapping[str, str],
    request: Request,
) -> Response:
    if not group.organization.has_access(identity.user):
        raise ApiClient.ApiError(
            status_code=403, body="The user does not have access to the organization."
        )

    return update_groups(
        request=request,
        group_ids=[group.id],
        projects=[group.project],
        organization_id=group.organization.id,
        search_fn=None,
        user=identity.user,
        data=data,
    )


class SlackActionEndpoint(Endpoint):  # type: ignore
    authentication_classes = ()
    permission_classes = ()

    def respond_ephemeral(self, text: str) -> Response:
        return self.respond({"response_type": "ephemeral", "replace_original": False, "text": text})

    def api_error(
        self,
        slack_request: SlackActionRequest,
        group: Group,
        identity: Identity,
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
                user_email=identity.user,
                org_name=group.organization.name,
            )
        else:
            text = DEFAULT_ERROR_MESSAGE

        return self.respond_ephemeral(text)

    def on_assign(
        self, request: Request, identity: Identity, group: Group, action: MessageAction
    ) -> None:
        if not (action.selected_options and len(action.selected_options)):
            # Short-circuit if action is invalid
            return
        assignee = action.selected_options[0]["value"]
        if assignee == "none":
            assignee = None

        update_group(group, identity, {"assignedTo": assignee}, request)
        analytics.record("integrations.slack.assign", actor_id=identity.user_id)

    def on_status(
        self,
        request: Request,
        identity: Identity,
        group: Group,
        action: MessageAction,
        data: Mapping[str, Any],
        integration: Integration,
    ) -> None:
        status_data = (action.value or "").split(":", 1)
        if not len(status_data):
            return

        status: MutableMapping[str, Any] = {"status": status_data[0]}

        resolve_type = status_data[-1]

        if resolve_type == "inNextRelease":
            status.update({"statusDetails": {"inNextRelease": True}})
        elif resolve_type == "inCurrentRelease":
            status.update({"statusDetails": {"inRelease": "latest"}})

        update_group(group, identity, status, request)

        analytics.record(
            "integrations.slack.status",
            status=status["status"],
            resolve_type=resolve_type,
            actor_id=identity.user_id,
        )

    def open_resolve_dialog(
        self, data: Mapping[str, Any], group: Group, integration: Integration
    ) -> None:
        # XXX(epurkhiser): In order to update the original message we have to
        # keep track of the response_url in the callback_id. Definitely hacky,
        # but seems like there's no other solutions [1]:
        #
        # [1]: https://stackoverflow.com/questions/46629852/update-a-bot-message-after-responding-to-a-slack-dialog#comment80795670_46629852
        callback_id = json.dumps(
            {
                "issue": group.id,
                "orig_response_url": data["response_url"],
                "is_message": self.is_message(data),
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
            "trigger_id": data["trigger_id"],
            "token": integration.metadata["access_token"],
        }

        slack_client = SlackClient()
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

    def is_message(self, data: Mapping[str, Any]) -> bool:
        """
        XXX(epurkhiser): Used in coordination with construct_reply.
         Bot posted messages will not have the type at all.
        """
        # Explicitly typing to satisfy mypy.
        is_message_: bool = data.get("original_message", {}).get("type") == "message"
        return is_message_

    @transaction_start("SlackActionEndpoint")
    def post(self, request: Request) -> Response:
        try:
            slack_request = SlackActionRequest(request)
            slack_request.validate()
        except SlackRequestError as e:
            return self.respond(status=e.status)

        action_option = slack_request.action_option

        if action_option in ["approve_member", "reject_member"]:
            return self.handle_member_approval(slack_request)

        # if a user is just clicking our auto response in the messages tab we just return a 200
        if action_option == "sentry_docs_link_clicked":
            return self.respond()

        # Actions list may be empty when receiving a dialog response
        data = slack_request.data
        action_list_raw = data.get("actions", [])
        action_list = [MessageAction(**action_data) for action_data in action_list_raw]

        organizations = slack_request.integration.organizations.all()

        if action_option in ["link", "ignore"]:
            analytics.record(
                "integrations.slack.chart_unfurl_action",
                organization_id=organizations[0].id,
                action=action_option,
            )
            payload = {"delete_original": "true"}
            try:
                requests_.post(slack_request.response_url, json=payload)
            except ApiError as e:
                logger.error("slack.action.response-error", extra={"error": str(e)})
                return self.respond(status=403)

            return self.respond()

        # Determine the issue group action is being taken on
        group_id = slack_request.callback_data["issue"]
        logging_data = {**slack_request.logging_data, "group_id": group_id}

        try:
            group = Group.objects.select_related("project__organization").get(
                project__in=Project.objects.filter(organization__in=organizations),
                id=group_id,
            )
        except Group.DoesNotExist:
            logger.info("slack.action.invalid-issue", extra={**logging_data})
            return self.respond(status=403)

        logging_data["organization_id"] = group.organization.id

        # Determine the acting user by slack identity
        try:
            identity = slack_request.get_identity()
        except IdentityProvider.DoesNotExist:
            return self.respond(status=403)

        if not identity:
            associate_url = build_linking_url(
                integration=slack_request.integration,
                slack_id=slack_request.user_id,
                channel_id=slack_request.channel_id,
                response_url=slack_request.response_url,
            )
            return self.respond_ephemeral(LINK_IDENTITY_MESSAGE.format(associate_url=associate_url))

        # Handle status dialog submission
        if slack_request.type == "dialog_submission" and "resolve_type" in data["submission"]:
            # Masquerade a status action
            action = MessageAction(
                name="status",
                value=data["submission"]["resolve_type"],
            )

            try:
                self.on_status(request, identity, group, action, data, slack_request.integration)
            except client.ApiError as error:
                return self.api_error(slack_request, group, identity, error, "status_dialog")

            group = Group.objects.get(id=group.id)
            attachment = SlackIssuesMessageBuilder(
                group, identity=identity, actions=[action]
            ).build()

            body = self.construct_reply(
                attachment, is_message=slack_request.callback_data["is_message"]
            )

            # use the original response_url to update the link attachment
            slack_client = SlackClient()
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
            action_type = action.name
            try:
                if action_type == "status":
                    self.on_status(
                        request, identity, group, action, data, slack_request.integration
                    )
                elif action_type == "assign":
                    self.on_assign(request, identity, group, action)
                elif action_type == "resolve_dialog":
                    self.open_resolve_dialog(data, group, slack_request.integration)
                    defer_attachment_update = True
            except client.ApiError as error:
                return self.api_error(slack_request, group, identity, error, action_type)

        if defer_attachment_update:
            return self.respond()

        # Reload group as it may have been mutated by the action
        group = Group.objects.get(id=group.id)

        attachment = SlackIssuesMessageBuilder(
            group, identity=identity, actions=action_list
        ).build()
        body = self.construct_reply(attachment, is_message=self.is_message(data))

        return self.respond(body)

    def handle_member_approval(self, slack_request: SlackActionRequest) -> Response:
        try:
            # get_identity can return nobody
            identity = slack_request.get_identity()
        except IdentityProvider.DoesNotExist:
            identity = None

        if not identity:
            return self.respond_with_text("Identity not linked for user.")

        member_id = slack_request.callback_data["member_id"]

        try:
            member = OrganizationMember.objects.get_member_invite_query(member_id).get()
        except OrganizationMember.DoesNotExist:
            # member request is gone, likely someone else rejected it
            member_email = slack_request.callback_data["member_email"]
            return self.respond_with_text(f"Member invitation for {member_email} no longer exists.")

        organization = member.organization

        if not organization.has_access(identity.user):
            return self.respond_with_text(
                "You don't have access to the organization for the invitation."
            )

        # row should exist because we have access
        member_of_approver = OrganizationMember.objects.get(
            user=identity.user, organization=organization
        )
        access = from_member(member_of_approver)
        if not access.has_scope("member:admin"):
            return self.respond_with_text(
                "You don't have permission to approve member invitations."
            )

        # validate the org options and check against allowed_roles
        allowed_roles = member_of_approver.get_allowed_roles_to_invite()
        try:
            member.validate_invitation(identity.user, allowed_roles)
        except UnableToAcceptMemberInvitationException as err:
            return self.respond_with_text(str(err))

        original_status = member.invite_status
        member_email = member.email
        try:
            if slack_request.action_option == "approve_member":
                member.approve_member_invitation(identity.user, referrer="slack")
            else:
                member.reject_member_invitation(identity.user)
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

        # record analytics and respond with success
        approve_member = slack_request.action_option == "approve_member"
        event_name = (
            "integrations.slack.approve_member_invitation"
            if approve_member
            else "integrations.slack.reject_member_invitation"
        )
        invite_type = (
            "Invite" if original_status == InviteStatus.REQUESTED_TO_BE_INVITED.value else "Join"
        )
        analytics.record(
            event_name,
            actor_id=identity.user_id,
            organization_id=member.organization_id,
            invitation_type=invite_type.lower(),
            invited_member_id=member_id,
        )

        verb = "approved" if approve_member else "rejected"

        manage_url = absolute_uri(
            reverse("sentry-organization-members", args=[member.organization.slug])
        )
        body = {
            "text": f"{invite_type} request for {member_email} has been {verb}. <{manage_url}|See Members and Requests>.",
        }
        return self.respond(body)
