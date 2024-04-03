from __future__ import annotations

from logging import Logger, getLogger

from sentry.integrations.repository import get_default_issue_alert_repository
from sentry.integrations.repository.issue_alert import (
    IssueAlertNotificationMessage,
    IssueAlertNotificationMessageRepository,
)
from sentry.integrations.slack import BlockSlackMessageBuilder, SlackClient
from sentry.models.activity import Activity
from sentry.models.organization import OrganizationStatus
from sentry.models.rule import Rule
from sentry.notifications.notifications.activity import EMAIL_CLASSES_BY_TYPE
from sentry.services.hybrid_cloud.integration import integration_service

_default_logger = getLogger(__name__)


class RuleDataError(Exception):
    pass


class SlackService:
    def __init__(
        self,
        notification_message_repository: IssueAlertNotificationMessageRepository,
        message_block_builder: BlockSlackMessageBuilder,
        logger: Logger,
    ) -> None:
        self._notification_message_repository = notification_message_repository
        self._slack_block_builder = message_block_builder
        self._logger = logger

    @classmethod
    def default(cls) -> SlackService:
        return SlackService(
            notification_message_repository=get_default_issue_alert_repository(),
            message_block_builder=BlockSlackMessageBuilder(),
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

        try:
            integration = integration_service.get_integration(
                organization_id=activity.project.organization_id,
                status=OrganizationStatus.ACTIVE,
                provider="slack",
            )
        except Exception as err:
            self._logger.info(
                "error getting integration",
                exc_info=err,
                extra={
                    "activity_id": activity.id,
                },
            )
            return None

        if integration is None:
            self._logger.info(
                "no integration found for activity",
                extra={
                    "activity_id": activity.id,
                    "organization_id": activity.project.organization_id,
                    "project_id": activity.project.id,
                },
            )
            return None

        slack_client = SlackClient(integration_id=integration.id)

        # Get all parent notifications, which will have the message identifier to use to reply in a thread
        parent_notifications = (
            self._notification_message_repository.get_all_parent_notification_messages_by_filters(
                group_ids=[activity.group.id],
                project_ids=[activity.project.id],
            )
        )
        for parent_notification in parent_notifications:
            try:
                self._handle_parent_notification(
                    parent_notification=parent_notification,
                    notification_to_send=notification_to_send,
                    client=slack_client,
                )
            except Exception as err:
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
        client: SlackClient,
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
        client.post("/chat.postMessage", data=payload, timeout=5)

    def _get_notification_message_to_send(self, activity: Activity) -> str | None:
        """
        Get the notification message that we need to send in a slack thread based on the activity type.

        Apparently the get_context is a very computation heavy call, so make sure to only call this once.
        """
        notification_cls = EMAIL_CLASSES_BY_TYPE.get(activity.type, None)
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
