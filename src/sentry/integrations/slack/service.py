from __future__ import annotations

from collections.abc import Mapping
from copy import copy
from logging import Logger, getLogger
from typing import Any

import orjson
import sentry_sdk
from slack_sdk.errors import SlackApiError

from sentry.constants import ISSUE_ALERTS_THREAD_DEFAULT
from sentry.integrations.messaging.metrics import (
    MessagingInteractionEvent,
    MessagingInteractionType,
)
from sentry.integrations.models.integration import Integration
from sentry.integrations.notifications import get_context
from sentry.integrations.repository import get_default_issue_alert_repository
from sentry.integrations.repository.issue_alert import (
    IssueAlertNotificationMessage,
    IssueAlertNotificationMessageRepository,
)
from sentry.integrations.slack.message_builder.base.block import BlockSlackMessageBuilder
from sentry.integrations.slack.message_builder.notifications import get_message_builder
from sentry.integrations.slack.message_builder.types import SlackBlock
from sentry.integrations.slack.metrics import (
    SLACK_ACTIVITY_THREAD_FAILURE_DATADOG_METRIC,
    SLACK_ACTIVITY_THREAD_SUCCESS_DATADOG_METRIC,
    SLACK_NOTIFY_RECIPIENT_FAILURE_DATADOG_METRIC,
    SLACK_NOTIFY_RECIPIENT_SUCCESS_DATADOG_METRIC,
    record_lifecycle_termination_level,
)
from sentry.integrations.slack.sdk_client import SlackSdkClient
from sentry.integrations.slack.spec import SlackMessagingSpec
from sentry.integrations.slack.threads.activity_notifications import (
    AssignedActivityNotification,
    ExternalIssueCreatedActivityNotification,
)
from sentry.integrations.types import ExternalProviderEnum, ExternalProviders
from sentry.integrations.utils.common import get_active_integration_for_organization
from sentry.models.activity import Activity
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.rule import Rule
from sentry.notifications.additional_attachment_manager import get_additional_attachment
from sentry.notifications.notifications.activity.archive import ArchiveActivityNotification
from sentry.notifications.notifications.activity.base import ActivityNotification
from sentry.notifications.notifications.activity.escalating import EscalatingActivityNotification
from sentry.notifications.notifications.activity.regression import RegressionActivityNotification
from sentry.notifications.notifications.activity.release import ReleaseActivityNotification
from sentry.notifications.notifications.activity.resolved import ResolvedActivityNotification
from sentry.notifications.notifications.activity.resolved_in_release import (
    ResolvedInReleaseActivityNotification,
)
from sentry.notifications.notifications.activity.unassigned import UnassignedActivityNotification
from sentry.notifications.notifications.activity.unresolved import UnresolvedActivityNotification
from sentry.notifications.notifications.base import BaseNotification
from sentry.silo.base import SiloMode
from sentry.types.activity import ActivityType
from sentry.types.actor import Actor
from sentry.utils import metrics

_default_logger = getLogger(__name__)


DEFAULT_SUPPORTED_ACTIVITY_THREAD_NOTIFICATION_HANDLERS: dict[
    ActivityType, type[ActivityNotification]
] = {
    ActivityType.ASSIGNED: AssignedActivityNotification,
    ActivityType.DEPLOY: ReleaseActivityNotification,
    ActivityType.SET_REGRESSION: RegressionActivityNotification,
    ActivityType.SET_RESOLVED: ResolvedActivityNotification,
    ActivityType.SET_RESOLVED_BY_AGE: ResolvedActivityNotification,
    ActivityType.SET_RESOLVED_IN_COMMIT: ResolvedActivityNotification,
    ActivityType.SET_RESOLVED_IN_PULL_REQUEST: ResolvedActivityNotification,
    ActivityType.SET_RESOLVED_IN_RELEASE: ResolvedInReleaseActivityNotification,
    ActivityType.UNASSIGNED: UnassignedActivityNotification,
    ActivityType.SET_ESCALATING: EscalatingActivityNotification,
    ActivityType.SET_IGNORED: ArchiveActivityNotification,
    ActivityType.SET_UNRESOLVED: UnresolvedActivityNotification,
    ActivityType.CREATE_ISSUE: ExternalIssueCreatedActivityNotification,
}


class RuleDataError(Exception):
    pass


class SlackService:
    """
    Slack service is the main entry point for all business logic related to Slack.
    We will consolidate the Slack logic in here to create an easier interface to interact with, and not worry about
    figuring out which specific class or object you need, how to create them, in which order, and what to call.

    This service will have plentiful logging, error catching and handling, and be mindful of performance impacts.
    There will also be monitoring and alerting in place to give more visibility to the main business logic methods.
    """

    def __init__(
        self,
        notification_message_repository: IssueAlertNotificationMessageRepository,
        message_block_builder: BlockSlackMessageBuilder,
        activity_thread_notification_handlers: dict[ActivityType, type[ActivityNotification]],
        logger: Logger,
    ) -> None:
        self._notification_message_repository = notification_message_repository
        self._slack_block_builder = message_block_builder
        self._activity_thread_notification_handlers = activity_thread_notification_handlers
        self._logger = logger

    @classmethod
    def default(cls) -> SlackService:
        return SlackService(
            notification_message_repository=get_default_issue_alert_repository(),
            message_block_builder=BlockSlackMessageBuilder(),
            activity_thread_notification_handlers=DEFAULT_SUPPORTED_ACTIVITY_THREAD_NOTIFICATION_HANDLERS,
            logger=_default_logger,
        )

    def notify_all_threads_for_activity(self, activity: Activity) -> None:
        """
        For an activity related to an issue group, send notifications in a Slack thread to all parent notifications for
        that specific group and project.

        If the group is not associated with an activity, return early as there's nothing to do.
        If the user is not associated with an activity, return early as we only care about user activities.
        """
        if activity.group is None:
            self._logger.info(
                "no group associated on the activity, nothing to do",
                extra={
                    "activity_id": activity.id,
                },
            )
            return None

        if activity.user_id is None:
            self._logger.info(
                "machine/system updates are ignored at this time, nothing to do",
                extra={
                    "activity_id": activity.id,
                },
            )
            return None

        organization_id = activity.group.organization.id
        # If the feature is turned off for the organization, exit early as there's nothing to do
        if not OrganizationOption.objects.get_value(
            organization=activity.group.organization,
            key="sentry:issue_alerts_thread_flag",
            default=ISSUE_ALERTS_THREAD_DEFAULT,
        ):
            self._logger.info(
                "feature is turned off for this organization",
                extra={
                    "activity_id": activity.id,
                    "organization_id": organization_id,
                    "project_id": activity.project.id,
                },
            )
            return None
        # The same message is sent to all the threads, so this needs to only happen once
        notification_to_send = self._get_notification_message_to_send(activity=activity)
        if not notification_to_send:
            self._logger.info(
                "notification to send is invalid",
                extra={
                    "activity_id": activity.id,
                },
            )
            return None

        integration = get_active_integration_for_organization(
            organization_id=organization_id,
            provider=ExternalProviderEnum.SLACK,
        )
        if integration is None:
            self._logger.info(
                "no integration found for activity",
                extra={
                    "activity_id": activity.id,
                    "organization_id": organization_id,
                    "project_id": activity.project.id,
                },
            )
            return None

        slack_client = SlackSdkClient(integration_id=integration.id)

        # Get all parent notifications, which will have the message identifier to use to reply in a thread
        with MessagingInteractionEvent(
            interaction_type=MessagingInteractionType.GET_PARENT_NOTIFICATION,
            spec=SlackMessagingSpec(),
        ).capture() as lifecycle:
            lifecycle.add_extras(
                {
                    "activity_id": activity.id,
                    "group_id": activity.group.id,
                    "project_id": activity.project.id,
                }
            )
            parent_notifications = self._notification_message_repository.get_all_parent_notification_messages_by_filters(
                group_ids=[activity.group.id],
                project_ids=[activity.project.id],
            )

        # We don't wrap this in a lifecycle because _handle_parent_notification is already wrapped in a lifecycle
        for parent_notification in parent_notifications:
            try:
                self._handle_parent_notification(
                    parent_notification=parent_notification,
                    notification_to_send=notification_to_send,
                    client=slack_client,
                )
            except Exception as err:
                # TODO(iamrajjoshi): We can probably swallow this error once we audit the lifecycle
                self._logger.info(
                    "failed to send notification",
                    exc_info=err,
                    extra={
                        "activity_id": activity.id,
                        "parent_notification_id": parent_notification.id,
                        "notification_to_send": notification_to_send,
                        "integration_id": integration.id,
                    },
                )

    def _handle_parent_notification(
        self,
        parent_notification: IssueAlertNotificationMessage,
        notification_to_send: str,
        client: SlackSdkClient,
    ) -> None:
        # For each parent notification, we need to get the channel that the notification is replied to
        # Get the channel by using the action uuid
        if not parent_notification.rule_fire_history:
            raise RuleDataError(
                f"parent notification {parent_notification.id} does not have a rule_fire_history"
            )

        if not parent_notification.rule_action_uuid:
            raise RuleDataError(
                f"parent notification {parent_notification.id} does not have a rule_action_uuid"
            )

        rule: Rule = parent_notification.rule_fire_history.rule
        rule_action = rule.get_rule_action_details_by_uuid(parent_notification.rule_action_uuid)
        if not rule_action:
            raise RuleDataError(
                f"failed to find rule action {parent_notification.rule_action_uuid} for rule {rule.id}"
            )

        channel_id: str | None = rule_action.get("channel_id", None)
        if not channel_id:
            raise RuleDataError(
                f"failed to get channel_id for rule {rule.id} and rule action {parent_notification.rule_action_uuid}"
            )

        block = self._slack_block_builder.get_markdown_block(text=notification_to_send)
        payload = {"channel": channel_id, "thread_ts": parent_notification.message_identifier}
        slack_payload = self._slack_block_builder._build_blocks(
            block, fallback_text=notification_to_send
        )
        payload.update(slack_payload)
        # TODO (Yash): Users should not have to remember to do this, interface should handle serializing the field
        json_blocks = orjson.dumps(payload.get("blocks")).decode()
        payload["blocks"] = json_blocks

        extra = {
            "channel": channel_id,
            "thread_ts": parent_notification.message_identifier,
            "rule_action_uuid": parent_notification.rule_action_uuid,
        }

        with MessagingInteractionEvent(
            interaction_type=MessagingInteractionType.SEND_ACTIVITY_NOTIFICATION,
            spec=SlackMessagingSpec(),
        ).capture() as lifecycle:
            try:
                client.chat_postMessage(
                    channel=channel_id,
                    thread_ts=parent_notification.message_identifier,
                    text=notification_to_send,
                    blocks=json_blocks,
                )
                # TODO(iamrajjoshi): Remove this after we validate lifecycle
                metrics.incr(SLACK_ACTIVITY_THREAD_SUCCESS_DATADOG_METRIC, sample_rate=1.0)
            except SlackApiError as e:
                # TODO(iamrajjoshi): Remove this after we validate lifecycle
                self._logger.info(
                    "failed to post message to slack",
                    extra={"error": str(e), "blocks": json_blocks, **extra},
                )
                metrics.incr(
                    SLACK_ACTIVITY_THREAD_FAILURE_DATADOG_METRIC,
                    sample_rate=1.0,
                    tags={"ok": e.response.get("ok", False), "status": e.response.status_code},
                )
                lifecycle.add_extras({"rule_action_uuid": parent_notification.rule_action_uuid})
                record_lifecycle_termination_level(lifecycle, e)
                raise

    def _get_notification_message_to_send(self, activity: Activity) -> str | None:
        """
        Get the notification message that we need to send in a slack thread based on the activity type.

        Apparently the get_context is a very computation heavy call, so make sure to only call this once.
        """
        try:
            activity_type: ActivityType = ActivityType(activity.type)
        except ValueError as err:
            self._logger.info(
                "there was an error trying to get activity type, assuming activity is unsupported",
                exc_info=err,
                extra={
                    "error": str(err),
                    "activity_id": activity.id,
                    "activity_type": activity.type,
                },
            )
            return None

        notification_cls = self._activity_thread_notification_handlers.get(activity_type, None)
        if not notification_cls:
            self._logger.info(
                "activity type is not currently supported",
                extra={
                    "activity_id": activity.id,
                    "activity_type": activity.type,
                },
            )
            return None

        notification_obj = notification_cls(activity=activity)
        context = notification_obj.get_context()
        text_description = context.get("text_description", None)
        if not text_description:
            self._logger.info(
                "context did not contain text_description",
                extra={
                    "activity_id": activity.id,
                    "notification_type": activity.type,
                    "notification_cls": notification_cls.__name__,
                    "context": context,
                },
            )
            return None

        return text_description

    def notify_recipient(
        self,
        notification: BaseNotification,
        recipient: Actor,
        attachments: SlackBlock,
        channel: str,
        integration: Integration,
        shared_context: Mapping[str, Any],
    ) -> None:
        from sentry.integrations.slack.tasks.post_message import post_message, post_message_control

        """Send an "activity" or "alert rule" notification to a Slack user or team, but NOT to a channel directly.
        This is used in the send_notification_as_slack function."""
        with sentry_sdk.start_span(op="notification.send_slack", name="notify_recipient"):
            # Make a local copy to which we can append.
            local_attachments = copy(attachments)

            text = notification.get_notification_title(ExternalProviders.SLACK, shared_context)

            blocks: list[SlackBlock] = []
            if text:
                blocks.append(BlockSlackMessageBuilder.get_markdown_block(text))
            attachment_blocks = local_attachments.get("blocks")
            if attachment_blocks:
                for attachment in attachment_blocks:
                    blocks.append(attachment)
            if len(blocks) >= 2 and blocks[1].get("block_id"):
                # block id needs to be in the first block
                first_block = blocks[0]
                first_block["block_id"] = blocks[1]["block_id"]
                del blocks[1]["block_id"]
            additional_attachment = get_additional_attachment(
                integration, notification.organization
            )
            if additional_attachment:
                for block in additional_attachment:
                    blocks.append(block)
            if (
                not text
            ):  # if there isn't a notification title, try using message description as fallback
                text = notification.get_message_description(recipient, ExternalProviders.SLACK)
            payload = {
                "channel": channel,
                "unfurl_links": False,
                "unfurl_media": False,
                "text": text if text else "",
                "blocks": orjson.dumps(blocks).decode(),
            }
            callback_id = local_attachments.get("callback_id")
            if callback_id:
                # callback_id is now at the same level as blocks, rather than within attachments
                if isinstance(callback_id, str):
                    payload["callback_id"] = callback_id
                else:
                    payload["callback_id"] = orjson.dumps(
                        local_attachments.get("callback_id")
                    ).decode()

            post_message_task = post_message
            if SiloMode.get_current_mode() == SiloMode.CONTROL:
                post_message_task = post_message_control

            log_params = {
                "notification": str(notification),
                "recipient": recipient.id,
                "channel_id": channel,
            }
            post_message_task.apply_async(
                kwargs={
                    "integration_id": integration.id,
                    "payload": payload,
                    "log_error_message": "slack.notify_recipient.fail",
                    "log_params": log_params,
                }
            )
        # recording data outside of span
        notification.record_notification_sent(recipient, ExternalProviders.SLACK)

    def get_attachments(
        self,
        notification: BaseNotification,
        recipient: Actor,
        shared_context: Mapping[str, Any],
        extra_context_by_actor: Mapping[Actor, Mapping[str, Any]] | None,
    ) -> SlackBlock:
        """Get the message to send in notify_recipient"""

        extra_context = (
            extra_context_by_actor[recipient] if extra_context_by_actor and recipient else {}
        )
        context = get_context(notification, recipient, shared_context, extra_context)
        cls = get_message_builder(notification.message_builder)
        attachments = cls(notification, context, recipient).build()
        return attachments

    def send_message_to_slack_channel(
        self,
        integration_id: int,
        payload: Mapping[str, Any],
        log_error_message: str,
        log_params: Mapping[str, Any],
    ) -> None:
        """Execution of send_notification_as_slack."""

        client = SlackSdkClient(integration_id=integration_id)
        with MessagingInteractionEvent(
            interaction_type=MessagingInteractionType.SEND_GENERIC_NOTIFICATION,
            spec=SlackMessagingSpec(),
        ).capture() as lifecycle:
            try:
                lifecycle.add_extras({"integration_id": integration_id})
                client.chat_postMessage(
                    blocks=str(payload.get("blocks", "")),
                    text=str(payload.get("text", "")),
                    channel=str(payload.get("channel", "")),
                    unfurl_links=False,
                    unfurl_media=False,
                    callback_id=str(payload.get("callback_id", "")),
                )
                # TODO(iamrajjoshi): Remove this after we validate lifecycle
                metrics.incr(SLACK_NOTIFY_RECIPIENT_SUCCESS_DATADOG_METRIC, sample_rate=1.0)
            except SlackApiError as e:
                # TODO(iamrajjoshi): Remove this after we validate lifecycle
                extra = {"error": str(e), **log_params}
                self._logger.info(log_error_message, extra=extra)
                metrics.incr(
                    SLACK_NOTIFY_RECIPIENT_FAILURE_DATADOG_METRIC,
                    sample_rate=1.0,
                    tags={"ok": e.response.get("ok", False), "status": e.response.status_code},
                )
                lifecycle.add_extras(
                    {k: str(v) for k, v in log_params.items() if isinstance(v, (int, str))}
                )
                record_lifecycle_termination_level(lifecycle, e)
