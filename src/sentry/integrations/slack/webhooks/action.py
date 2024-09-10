from __future__ import annotations

import logging
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

from sentry import analytics, options
from sentry.api import client
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.client import ApiClient
from sentry.api.helpers.group_index import update_groups
from sentry.auth.access import from_member
from sentry.exceptions import UnableToAcceptMemberInvitationException
from sentry.integrations.services.integration import integration_service
from sentry.integrations.slack.message_builder.issues import SlackIssuesMessageBuilder
from sentry.integrations.slack.message_builder.types import SlackBody
from sentry.integrations.slack.metrics import (
    SLACK_WEBHOOK_GROUP_ACTIONS_FAILURE_DATADOG_METRIC,
    SLACK_WEBHOOK_GROUP_ACTIONS_SUCCESS_DATADOG_METRIC,
)
from sentry.integrations.slack.requests.action import SlackActionRequest
from sentry.integrations.slack.requests.base import SlackRequestError
from sentry.integrations.slack.sdk_client import SlackSdkClient
from sentry.integrations.slack.utils.errors import MODAL_NOT_FOUND, unpack_slack_api_error
from sentry.integrations.types import ExternalProviderEnum
from sentry.integrations.utils.scope import bind_org_context_from_integration
from sentry.models.activity import ActivityIntegration
from sentry.models.group import Group
from sentry.models.organizationmember import InviteStatus, OrganizationMember
from sentry.models.rule import Rule
from sentry.notifications.services import notifications_service
from sentry.notifications.utils.actions import BlockKitMessageAction, MessageAction
from sentry.shared_integrations.exceptions import ApiError
from sentry.users.services.user import RpcUser
from sentry.utils import metrics

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

    return update_groups(
        request=request,
        group_ids=[group.id],
        projects=[group.project],
        organization_id=group.organization.id,
        search_fn=None,
        user=user,
        data=data,
    )


def get_rule(slack_request: SlackActionRequest) -> Rule | None:
    """Get the rule that fired"""
    rule_id = slack_request.callback_data.get("rule")
    if not rule_id:
        return None
    try:
        rule = Rule.objects.get(id=rule_id)
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

        if error.status_code == 403:
            text = UNLINK_IDENTITY_MESSAGE.format(
                associate_url=build_unlinking_url(
                    slack_request.integration.id,
                    slack_request.user_id,
                    channel_id or slack_request.channel_id,
                    response_url or slack_request.response_url,
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
        _logger.info(
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
            "integrations.slack.status",
            organization_id=group.project.organization.id,
            status=status["status"],
            resolve_type=resolve_type,
            user_id=user.id,
        )

    def build_format_options(self, options: dict[str, str]) -> list[dict[str, Any]]:
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
        formatted_options = self.build_format_options(options)

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

    def build_resolve_modal_payload(self, callback_id: str, metadata: str) -> View:
        return self.build_modal_payload(
            title="Resolve",
            action_text="Resolve",
            options=RESOLVE_OPTIONS,
            initial_option_text="Immediately",
            initial_option_value="resolved",
            callback_id=callback_id,
            metadata=metadata,
        )

    def build_archive_modal_payload(self, callback_id: str, metadata: str) -> View:
        return self.build_modal_payload(
            title="Archive",
            action_text="Archive",
            options=ARCHIVE_OPTIONS,
            initial_option_text="Until escalating",
            initial_option_value="ignored:archived_until_escalating",
            callback_id=callback_id,
            metadata=metadata,
        )

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
                metrics.incr(
                    SLACK_WEBHOOK_GROUP_ACTIONS_FAILURE_DATADOG_METRIC,
                    sample_rate=1.0,
                    tags={"type": "update_modal"},
                )
                _logger.exception(
                    "slack.action.update-modal-not-found",
                    extra={
                        "organization_id": slack_request.organization.id,
                        "integration_id": slack_request.integration.id,
                        "trigger_id": slack_request.data["trigger_id"],
                        "dialog": "resolve",
                    },
                )
                # The modal was not found, so we need to open a new one
                self._open_view(slack_client, modal_payload, slack_request)
            else:
                raise

    def _open_view(
        self, slack_client: SlackSdkClient, modal_payload: View, slack_request: SlackActionRequest
    ) -> None:
        # Error handling is done in the calling function
        slack_client.views_open(
            trigger_id=slack_request.data["trigger_id"],
            view=modal_payload,
        )

    def open_resolve_dialog(self, slack_request: SlackActionRequest, group: Group) -> None:
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
        }
        if slack_request.data.get("channel"):
            callback_id_dict["channel_id"] = slack_request.data["channel"]["id"]
            callback_id_dict["rule"] = slack_request.callback_data.get("rule")
        callback_id = orjson.dumps(callback_id_dict).decode()

        # only add tags to metadata
        metadata_dict = callback_id_dict.copy()
        metadata_dict["tags"] = list(slack_request.get_tags())
        metadata = orjson.dumps(metadata_dict).decode()

        # XXX(CEO): the second you make a selection (without hitting Submit) it sends a slightly different request
        modal_payload = self.build_resolve_modal_payload(callback_id, metadata=metadata)
        slack_client = SlackSdkClient(integration_id=slack_request.integration.id)
        try:
            # We need to use the action_ts as the external_id to update the modal
            # We passed this in control when we sent the loading modal to beat the 3 second timeout
            external_id = slack_request.get_action_ts()

            if options.get("send-slack-response-from-control-silo"):
                self._update_modal(slack_client, external_id, modal_payload, slack_request)
            else:
                self._open_view(slack_client, modal_payload, slack_request)

            metrics.incr(
                SLACK_WEBHOOK_GROUP_ACTIONS_SUCCESS_DATADOG_METRIC,
                sample_rate=1.0,
                tags={"type": "resolve_modal_open"},
            )
        except SlackApiError:
            metrics.incr(
                SLACK_WEBHOOK_GROUP_ACTIONS_FAILURE_DATADOG_METRIC,
                sample_rate=1.0,
                tags={"type": "resolve_modal_open"},
            )
            _logger.exception(
                "slack.action.response-error",
                extra={
                    "organization_id": org.id,
                    "integration_id": slack_request.integration.id,
                    "trigger_id": slack_request.data["trigger_id"],
                    "dialog": "resolve",
                },
            )

    def open_archive_dialog(self, slack_request: SlackActionRequest, group: Group) -> None:
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

        modal_payload = self.build_archive_modal_payload(callback_id, metadata=metadata)
        slack_client = SlackSdkClient(integration_id=slack_request.integration.id)
        try:
            # We need to use the action_ts as the external_id to update the modal
            # We passed this in control when we sent the loading modal to beat the 3 second timeout
            external_id = slack_request.get_action_ts()

            if options.get("send-slack-response-from-control-silo"):
                self._update_modal(slack_client, external_id, modal_payload, slack_request)
            else:
                self._open_view(slack_client, modal_payload, slack_request)

            metrics.incr(
                SLACK_WEBHOOK_GROUP_ACTIONS_SUCCESS_DATADOG_METRIC,
                sample_rate=1.0,
                tags={"type": "archive_modal_open"},
            )
        except SlackApiError:
            metrics.incr(
                SLACK_WEBHOOK_GROUP_ACTIONS_FAILURE_DATADOG_METRIC,
                sample_rate=1.0,
                tags={"type": "archive_modal_open"},
            )
            _logger.exception(
                "slack.action.response-error",
                extra={
                    "organization_id": org.id,
                    "integration_id": slack_request.integration.id,
                    "trigger_id": slack_request.data["trigger_id"],
                    "dialog": "archive",
                },
            )

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
        from sentry.integrations.slack.views.link_identity import build_linking_url

        group = get_group(slack_request)
        if not group:
            return self.respond(status=403)

        rule = get_rule(slack_request)

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

        if slack_request.type == "view_submission":
            # TODO: if we use modals for something other than resolve and archive, this will need to be more specific

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
                return self.respond()

            action = MessageAction(name="status", value=selection)

            try:
                self.on_status(request, identity_user, group, action)
            except client.ApiError as error:
                return self.api_error(slack_request, group, identity_user, error, "status_dialog")

            view = View(**slack_request.data["view"])
            private_metadata = orjson.loads(view.private_metadata)
            original_tags_from_request = set(private_metadata.get("tags", {}))

            blocks = SlackIssuesMessageBuilder(
                group,
                identity=identity,
                actions=[action],
                tags=original_tags_from_request,
                rules=[rule] if rule else None,
                issue_details=True,
                skip_fallback=True,
            ).build()

            # use the original response_url to update the link attachment
            json_blocks = orjson.dumps(blocks.get("blocks")).decode()
            try:
                webhook_client = WebhookClient(private_metadata["orig_response_url"])
                webhook_client.send(
                    blocks=json_blocks, delete_original=False, replace_original=True
                )
                metrics.incr(
                    SLACK_WEBHOOK_GROUP_ACTIONS_SUCCESS_DATADOG_METRIC,
                    sample_rate=1.0,
                    tags={"type": "submit_modal"},
                )
            except SlackApiError as e:
                metrics.incr(
                    SLACK_WEBHOOK_GROUP_ACTIONS_FAILURE_DATADOG_METRIC,
                    sample_rate=1.0,
                    tags={"type": "submit_modal"},
                )
                _logger.exception(
                    "slack.webhook.view_submission.response-error",
                    extra={
                        "error": str(e),
                        "integration_id": slack_request.integration.id,
                        "organization_id": group.project.organization_id,
                    },
                )

            return self.respond()

        # Usually we'll want to respond with the updated attachment including
        # the list of actions taken. However, when opening a dialog we do not
        # have anything to update the message with and will use the
        # response_url later to update it.
        defer_attachment_update = False

        # Handle interaction actions
        for action in action_list:
            try:
                if action.name in (
                    "status",
                    "unresolved:ongoing",
                ):
                    self.on_status(request, identity_user, group, action)
                elif (
                    action.name == "assign"
                ):  # TODO: remove this as it is replaced by the options-load endpoint
                    self.on_assign(request, identity_user, group, action)
                elif action.name == "resolve_dialog":
                    self.open_resolve_dialog(slack_request, group)
                    defer_attachment_update = True
                elif action.name == "archive_dialog":
                    self.open_archive_dialog(slack_request, group)
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
        json_blocks = orjson.dumps(response.get("blocks")).decode()
        webhook_client = WebhookClient(response_url)
        try:
            webhook_client.send(
                blocks=json_blocks,
                text=response.get("text"),
                delete_original=False,
                replace_original=True,
            )
            _logger.info(
                "slack.webhook.update_status.success",
                extra={"integration_id": slack_request.integration.id, "blocks": json_blocks},
            )
            metrics.incr(
                SLACK_WEBHOOK_GROUP_ACTIONS_SUCCESS_DATADOG_METRIC,
                sample_rate=1.0,
                tags={"type": "update_message"},
            )
        except SlackApiError:
            metrics.incr(
                SLACK_WEBHOOK_GROUP_ACTIONS_FAILURE_DATADOG_METRIC,
                sample_rate=1.0,
                tags={"type": "update_message"},
            )
            _logger.exception("slack.webhook.update_status.response-error")

        return self.respond(response)

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
        except ApiError:
            _logger.exception("slack.action.response-error")
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
    def get_action_list(cls, slack_request: SlackActionRequest) -> list[MessageAction]:
        action_data = slack_request.data.get("actions")
        if action_data:
            # XXX(CEO): this is here for backwards compatibility - if a user performs an action with an "older"
            # style issue alert but the block kit flag is enabled, we don't want to fall into this code path
            if action_data[0].get("action_id"):
                action_list = []
                for action_data in action_data:
                    if action_data.get("type") in ("static_select", "external_select"):
                        action = BlockKitMessageAction(
                            name=action_data["action_id"],
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
                            name=action_data["action_id"],
                            label=action_data["text"]["text"],
                            type=action_data["type"],
                            value=action_data["value"],
                            action_id=action_data["action_id"],
                            block_id=action_data["block_id"],
                        )
                    action_list.append(action)

                return action_list
        return [
            MessageAction(**action_data)
            for action_data in action_data or []
            if "name" in action_data
        ]

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

        action_option = self.get_action_option(slack_request=slack_request)

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
        except Exception:
            # shouldn't error but if it does, respond to the user
            _logger.exception(
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
