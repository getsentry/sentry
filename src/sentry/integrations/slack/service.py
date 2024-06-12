from __future__ import annotations

from logging import Logger, getLogger

import orjson
from slack_sdk.errors import SlackApiError

from sentry import features
from sentry.constants import ISSUE_ALERTS_THREAD_DEFAULT
from sentry.integrations.repository import get_default_issue_alert_repository
from sentry.integrations.repository.issue_alert import (
    IssueAlertNotificationMessage,
    IssueAlertNotificationMessageRepository,
)
from sentry.integrations.slack import BlockSlackMessageBuilder, SlackClient
from sentry.integrations.slack.sdk_client import SlackSdkClient
from sentry.integrations.slack.threads.activity_notifications import (
    AssignedActivityNotification,
    ExternalIssueCreatedActivityNotification,
)
from sentry.integrations.types import ExternalProviderEnum
from sentry.integrations.utils.common import get_active_integration_for_organization
from sentry.models.activity import Activity
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.rule import Rule
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
from sentry.types.activity import ActivityType

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

        slack_client: SlackClient | SlackSdkClient = SlackClient(integration_id=integration.id)
        if features.has(
            "organizations:slack-sdk-activity-threads", organization=activity.group.organization
        ):
            slack_client = SlackSdkClient(integration_id=integration.id)

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
        client: SlackClient | SlackSdkClient,
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

        if isinstance(client, SlackClient):
            try:
                client.post("/chat.postMessage", data=payload, timeout=5)
            except Exception as err:
                self._logger.info(
                    "failed to post message to slack",
                    extra={"error": str(err), "payload": payload, **extra},
                )
                raise
        else:
            try:
                client.chat_postMessage(
                    channel=channel_id,
                    thread_ts=parent_notification.message_identifier,
                    text=notification_to_send,
                    blocks=json_blocks,
                )
            except SlackApiError as err:
                self._logger.info(
                    "failed to post message to slack",
                    extra={"error": str(err), "blocks": json_blocks, **extra},
                )
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
