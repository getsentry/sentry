from __future__ import annotations

from typing import Any, List, Mapping, MutableMapping, Sequence

import requests as requests_
import sentry_sdk
from django.urls import reverse
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics
from sentry.api import client
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.client import ApiClient
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
from sentry.integrations.utils.scope import bind_org_context_from_integration
from sentry.models.activity import ActivityIntegration
from sentry.models.group import Group
from sentry.models.organizationmember import InviteStatus, OrganizationMember
from sentry.notifications.utils.actions import MessageAction
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.services.hybrid_cloud.notifications import notifications_service
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.shared_integrations.exceptions import ApiError
from sentry.types.integrations import ExternalProviderEnum
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
        raise client.ApiError(
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

        # sub-status only applies to ignored/archived issues
        if len(status_data) > 1 and status_data[0] == "ignored":
            status["substatus"] = status_data[1]

        resolve_type = status_data[-1]

        if resolve_type == "inNextRelease":
            status.update({"statusDetails": {"inNextRelease": True}})
        elif resolve_type == "inCurrentRelease":
            status.update({"statusDetails": {"inRelease": "latest"}})

        update_group(group, user, status, request)

        analytics.record(
            "integrations.slack.status",
            organization_id=group.project.organization.id,
            status=status["status"],
            resolve_type=resolve_type,
            user_id=user.id,
        )

    def open_resolve_dialog(self, slack_request: SlackActionRequest, group: Group) -> None:
        """
        @deprecated: Used for historic slack messages with dialog triggers, but no more dialogs
        should be issued.
        """
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
        # Handle historic status dialog submission (no more are being issued)
        # inline_slack_data = {
        #     "type": "interactive_message",
        #     "actions": [
        #         {
        #             "name": "resolve_type",
        #             "type": "select",
        #             "selected_options": [{"value": "resolved"}],
        #         }
        #     ],
        #     "callback_id": '{"issue":142}',
        #     "team": {"id": "T023QCMBQG3", "domain": "sentry-ecosystem"},
        #     "channel": {"id": "C02LTLJMYLQ", "name": "leander-team5"},
        #     "user": {"id": "U02KZ27QMAP", "name": "leander.rodrigues"},
        #     "action_ts": "1701880112.304892",
        #     "message_ts": "1701880088.778939",
        #     "attachment_id": "1",
        #     "token": "xS6Mc4OEpd9aayZI8DW8CXFW",
        #     "is_app_unfurl": False,
        #     "enterprise": None,
        #     "is_enterprise_install": False,
        #     "original_message": {
        #         "bot_id": "B050QMQJZNW",
        #         "type": "message",
        #         "text": "",
        #         "user": "U050MP2384V",
        #         "ts": "1701880088.778939",
        #         "app_id": "A05138R1A7K",
        #         "team": "T023QCMBQG3",
        #         "bot_profile": {
        #             "id": "B050QMQJZNW",
        #             "deleted": False,
        #             "name": "leander-sentry",
        #             "updated": 1680040798,
        #             "app_id": "A05138R1A7K",
        #             "icons": {
        #                 "image_36": "https://a.slack-edge.com/80588/img/plugins/app/bot_36.png",
        #                 "image_48": "https://a.slack-edge.com/80588/img/plugins/app/bot_48.png",
        #                 "image_72": "https://a.slack-edge.com/80588/img/plugins/app/service_72.png",
        #             },
        #             "team_id": "T023QCMBQG3",
        #         },
        #         "attachments": [
        #             {
        #                 "id": 1,
        #                 "footer_icon": "https://leeandher.ngrok.io/_static/1701879654/sentry/images/sentry-email-avatar.png",
        #                 "ts": 1701880087,
        #                 "color": "E03E2F",
        #                 "fallback": "[daffy] NameError: name 'test21' is not defined",
        #                 "text": "name 'test21' is not defined",
        #                 "title": "NameError",
        #                 "title_link": "https://leeandher.ngrok.io/organizations/acme/issues/142/?referrer=slack&notification_uuid=cc869fcc-a437-453e-8497-6fcca34711b7&alert_rule_id=32&alert_type=issue",
        #                 "callback_id": '{"issue":142}',
        #                 "footer": "DAFFY-5 via <https://leeandher.ngrok.io/organizations/acme/alerts/rules/daffy/32/details/|Slack Tester (#leander-team5)>",
        #                 "mrkdwn_in": ["text"],
        #                 "actions": [
        #                     {
        #                         "id": "1",
        #                         "name": "resolve_type",
        #                         "text": "Resolve...",
        #                         "type": "select",
        #                         "data_source": "static",
        #                         "option_groups": [
        #                             {
        #                                 "text": "Select a resolution target",
        #                                 "options": [
        #                                     {"text": "Immediately", "value": "resolved"},
        #                                     {
        #                                         "text": "In the next release",
        #                                         "value": "resolved:inNextRelease",
        #                                     },
        #                                     {
        #                                         "text": "In the current release",
        #                                         "value": "resolved:inCurrentRelease",
        #                                     },
        #                                 ],
        #                             }
        #                         ],
        #                     },
        #                     {
        #                         "id": "2",
        #                         "name": "status",
        #                         "text": "Ignore",
        #                         "type": "button",
        #                         "value": "ignored:forever",
        #                         "style": "",
        #                     },
        #                     {
        #                         "id": "3",
        #                         "name": "assign",
        #                         "text": "Select Assignee...",
        #                         "type": "select",
        #                         "data_source": "static",
        #                         "option_groups": [
        #                             {
        #                                 "text": "Teams",
        #                                 "options": [{"text": "#product", "value": "team:21"}],
        #                             },
        #                             {
        #                                 "text": "People",
        #                                 "options": [
        #                                     {
        #                                         "text": "leander.rodrigues+main@sentry.io",
        #                                         "value": "user:1",
        #                                     }
        #                                 ],
        #                             },
        #                         ],
        #                     },
        #                 ],
        #             }
        #         ],
        #     },
        #     "response_url": "https://hooks.slack.com/actions/T023QCMBQG3/6301165511125/ERA5id1jjOhfz51OGbngyLXQ",
        #     "trigger_id": "6316726973185.2126429398547.5932cf0ebd24a501874e532717b57ebc",
        # }
        # dialog_slack_data = {
        #     "type": "dialog_submission",
        #     "token": "xS6Mc4OEpd9aayZI8DW8CXFW",
        #     "action_ts": "1701880517.189955",
        #     "team": {"id": "T023QCMBQG3", "domain": "sentry-ecosystem"},
        #     "user": {"id": "U02KZ27QMAP", "name": "leander.rodrigues"},
        #     "channel": {"id": "C02L10ZF6DB", "name": "leander-team2"},
        #     "is_enterprise_install": False,
        #     "enterprise": None,
        #     "submission": {"resolve_type": "resolved"},
        #     "callback_id": '{"issue":116,"orig_response_url":"https://hooks.slack.com/actions/T023QCMBQG3/6316778272961/cJjhMw6S5Q3zCuR6smBV8iei","is_message":true}',
        #     "response_url": "https://hooks.slack.com/app/T023QCMBQG3/6306599519636/eOhoJGmLVPF3EGFY4R7bSgey",
        #     "state": "",
        # }
        # print(slack_request.data)
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
                group,
                identity=identity,
                actions=[action],
                tags=original_tags_from_request,
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
                elif action.name == "resolve_type":
                    # Convert selected option to static value
                    action.value = action.selected_options[0]["value"]
                    self.on_status(request, identity_user, group, action)
                elif action.name == "assign":
                    self.on_assign(request, identity_user, group, action)
                # TODO: Since historic messages might still send these actions, we cannot remove
                # this code, though we do not issue any new modals/dialogs to Slack. Hybrid Cloud
                # changes cannot ensure the 3s response times mandated by Slack.
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
            group,
            identity=identity,
            actions=action_list,
            tags=original_tags_from_request,
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

        # Set organization scope

        bind_org_context_from_integration(slack_request.integration.id)
        sentry_sdk.set_tag("integration_id", slack_request.integration.id)

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

        notifications_service.enable_all_settings_for_provider(
            external_provider=ExternalProviderEnum.SLACK,
            user_id=identity_user.id,
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
