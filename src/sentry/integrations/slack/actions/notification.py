from __future__ import annotations

from collections.abc import Callable, Generator, Sequence
from datetime import datetime
from logging import Logger, getLogger
from typing import Any

import orjson
import sentry_sdk
from slack_sdk.errors import SlackApiError

from sentry import features
from sentry.api.serializers.rest_framework.rule import ACTION_UUID_KEY
from sentry.constants import ISSUE_ALERTS_THREAD_DEFAULT
from sentry.eventstore.models import GroupEvent
from sentry.integrations.messaging.metrics import (
    MessagingInteractionEvent,
    MessagingInteractionType,
)
from sentry.integrations.models.integration import Integration
from sentry.integrations.repository import get_default_issue_alert_repository
from sentry.integrations.repository.base import NotificationMessageValidationError
from sentry.integrations.repository.issue_alert import NewIssueAlertNotificationMessage
from sentry.integrations.repository.notification_action import (
    NewNotificationActionNotificationMessage,
)
from sentry.integrations.services.integration import RpcIntegration
from sentry.integrations.slack.actions.form import SlackNotifyServiceForm
from sentry.integrations.slack.message_builder.issues import SlackIssuesMessageBuilder
from sentry.integrations.slack.metrics import record_lifecycle_termination_level
from sentry.integrations.slack.sdk_client import SlackSdkClient
from sentry.integrations.slack.spec import SlackMessagingSpec
from sentry.integrations.slack.utils.channel import SlackChannelIdData, get_channel_id
from sentry.integrations.slack.utils.threads import NotificationActionThreadUtils
from sentry.integrations.types import IntegrationProviderSlug
from sentry.integrations.utils.metrics import EventLifecycle
from sentry.issues.grouptype import GroupCategory
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.organization import Organization
from sentry.models.rule import Rule
from sentry.notifications.additional_attachment_manager import get_additional_attachment
from sentry.notifications.utils.open_period import open_period_start_for_group
from sentry.rules.actions import IntegrationEventAction
from sentry.rules.base import CallbackFuture
from sentry.types.rules import RuleFuture
from sentry.utils import metrics
from sentry.workflow_engine.models.action import Action

_default_logger: Logger = getLogger(__name__)


class SlackNotifyServiceAction(IntegrationEventAction):
    id = "sentry.integrations.slack.notify_action.SlackNotifyServiceAction"
    prompt = "Send a Slack notification"
    provider = IntegrationProviderSlug.SLACK.value
    integration_key = "workspace"
    label = "Send a notification to the {workspace} Slack workspace to {channel} (optionally, an ID: {channel_id}) and show tags {tags} and notes {notes} in notification"

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.form_fields = {
            "workspace": {
                "type": "choice",
                "choices": [(i.id, i.name) for i in self.get_integrations()],
            },
            "channel": {"type": "string", "placeholder": "e.g., #critical, Jane Schmidt"},
            "channel_id": {"type": "string", "placeholder": "e.g., CA2FRA079 or UA1J9RTE1"},
            "tags": {"type": "string", "placeholder": "e.g., environment,user,my_tag"},
            "notes": {"type": "string", "placeholder": "e.g., @jane, @on-call-team"},
        }

    def _build_notification_blocks(
        self,
        event: GroupEvent,
        rules: Sequence[Rule],
        tags: set,
        integration: RpcIntegration,
        notification_uuid: str | None = None,
    ) -> tuple[dict[str, Any], str | None]:
        """Build the notification blocks and return the blocks and JSON representation."""
        additional_attachment = get_additional_attachment(integration, self.project.organization)
        blocks = SlackIssuesMessageBuilder(
            group=event.group,
            event=event,
            tags=tags,
            rules=list(rules),
            notes=self.get_option("notes", ""),
        ).build(notification_uuid=notification_uuid)

        if additional_attachment:
            for block in additional_attachment:
                blocks["blocks"].append(block)

        json_blocks = None
        if payload_blocks := blocks.get("blocks"):
            json_blocks = orjson.dumps(payload_blocks).decode()

        return blocks, json_blocks

    @classmethod
    def _send_slack_message(
        cls,
        client: SlackSdkClient,
        json_blocks: str | None,
        text: str,
        channel: str,
        thread_ts: str | None,
        reply_broadcast: bool,
        event: GroupEvent,
        lifecycle: EventLifecycle,
        new_notification_message_object: (
            NewIssueAlertNotificationMessage | NewNotificationActionNotificationMessage
        ) | None,
    ) -> str | None:
        """Send a message to Slack and handle any errors."""
        try:
            response = client.chat_postMessage(
                blocks=json_blocks,
                text=text,
                channel=channel,
                unfurl_links=False,
                unfurl_media=False,
                thread_ts=thread_ts,
                reply_broadcast=reply_broadcast,
            )
            ts = response.get("ts")
            message_identifier = str(ts) if ts is not None else None
            if message_identifier is None:
                sentry_sdk.capture_message(
                    "Received no thread_ts from Slack",
                    level="info",
                )

            if new_notification_message_object:
                new_notification_message_object.message_identifier = message_identifier

            return message_identifier
        except SlackApiError as e:
            # Record the error code and details from the exception
            if new_notification_message_object:
                new_notification_message_object.error_code = e.response.status_code
                new_notification_message_object.error_details = {
                    "msg": str(e),
                    "data": e.response.data,
                    "url": e.response.api_url,
                }

            log_params: dict[str, str | int] = {
                "error": str(e),
                "project_id": event.project_id,
                "event_id": event.event_id,
                "integration_id": client.integration_id,
            }

            lifecycle.add_extras(log_params)
            record_lifecycle_termination_level(lifecycle, e)
            return None

    @classmethod
    def _save_issue_alert_notification_message(
        cls,
        data: NewIssueAlertNotificationMessage,
    ) -> None:
        """Save an issue alert notification message to the repository."""
        try:
            issue_repository = get_default_issue_alert_repository()
            issue_repository.create_notification_message(data=data)
        except NotificationMessageValidationError as err:
            extra = data.__dict__ if data else None
            _default_logger.info(
                "Validation error for new issue alert notification message",
                exc_info=err,
                extra=extra,
            )
        except Exception:
            # if there's an error trying to save a notification message, don't let that error block this flow
            # we already log at the repository layer, no need to log again here
            pass

    @classmethod
    def _get_issue_alert_thread_ts(
        cls,
        organization: Organization,
        lifecycle: EventLifecycle,
        rule_id: int | None,
        rule_action_uuid: str | None,
        event: GroupEvent,
        open_period_start: datetime | None,
        new_notification_message_object: NewIssueAlertNotificationMessage,
    ) -> str | None:
        """Find the thread in which to post an issue alert notification as a reply.

        Return None to post the notification as a top-level message.
        """
        # We need to search by rule action uuid and rule id, so only search if they exist
        if not (
            rule_action_uuid
            and rule_id
            and OrganizationOption.objects.get_value(
                organization=organization,
                key="sentry:issue_alerts_thread_flag",
                default=ISSUE_ALERTS_THREAD_DEFAULT,
            )
        ):
            return None

        try:
            issue_repository = get_default_issue_alert_repository()
            parent_notification_message = issue_repository.get_parent_notification_message(
                rule_id=rule_id,
                group_id=event.group.id,
                rule_action_uuid=rule_action_uuid,
                open_period_start=open_period_start,
            )
        except Exception as e:
            lifecycle.record_halt(e)
            # if there's an error trying to grab a parent notification, don't let that error block this flow
            # we already log at the repository layer, no need to log again here
            return None

        if parent_notification_message is None:
            return None

        # If a parent notification exists for this rule and action, then we can reply in a thread
        # Make sure we track that this reply will be in relation to the parent row
        new_notification_message_object.parent_notification_message_id = (
            parent_notification_message.id
        )
        # To reply to a thread, use the specific key in the payload as referenced by the docs
        # https://api.slack.com/methods/chat.postMessage#arg_thread_ts
        return parent_notification_message.message_identifier

    def _send_notification(
        self,
        event: GroupEvent,
        futures: Sequence[RuleFuture],
        tags: set,
        integration: RpcIntegration,
        channel: str,
        notification_uuid: str | None = None,
        notification_message_object: (
            NewIssueAlertNotificationMessage | NewNotificationActionNotificationMessage
        ) | None = None,
        save_notification_method: Callable | None = None,
        thread_ts: str | None = None,
    ) -> None:
        """Common logic for sending Slack notifications."""
        rules = [f.rule for f in futures]
        blocks, json_blocks = self._build_notification_blocks(
            event, rules, tags, integration, notification_uuid
        )

        # If this flow is triggered again for the same issue, we want it to be seen in the main channel
        reply_broadcast = thread_ts is not None

        client = SlackSdkClient(integration_id=integration.id)
        text = str(blocks.get("text"))
        # Wrap the Slack API call with lifecycle tracking
        with MessagingInteractionEvent(
            interaction_type=MessagingInteractionType.SEND_ISSUE_ALERT_NOTIFICATION,
            spec=SlackMessagingSpec(),
        ).capture() as lifecycle:
            SlackNotifyServiceAction._send_slack_message(
                client=client,
                json_blocks=json_blocks,
                text=text,
                channel=channel,
                thread_ts=thread_ts,
                reply_broadcast=reply_broadcast,
                event=event,
                lifecycle=lifecycle,
                new_notification_message_object=notification_message_object,
            )

        # Save notification message if needed
        if save_notification_method:
            save_notification_method(data=notification_message_object)

    def _send_issue_alert_notification(
        self,
        event: GroupEvent,
        futures: Sequence[RuleFuture],
        tags: set,
        integration: RpcIntegration,
        channel: str,
        notification_uuid: str | None = None,
    ) -> None:
        """Send an issue alert notification to Slack."""
        rules = [f.rule for f in futures]
        rule = rules[0] if rules else None
        rule_to_use = self.rule if self.rule else rule
        rule_id = rule_to_use.id if rule_to_use else None
        rule_action_uuid = self.data.get(ACTION_UUID_KEY, None)

        if not rule_action_uuid:
            # We are logging because this should never happen, all actions should have an uuid
            # We can monitor for this, and create an alert if this ever appears
            _default_logger.info(
                "No action uuid",
                extra={
                    "rule_id": rule_id,
                    "notification_uuid": notification_uuid,
                },
            )

        new_notification_message_object = NewIssueAlertNotificationMessage(
            rule_fire_history_id=self.rule_fire_history.id if self.rule_fire_history else None,
            rule_action_uuid=rule_action_uuid,
        )

        open_period_start: datetime | None = None
        if event.group.issue_category == GroupCategory.UPTIME:
            open_period_start = open_period_start_for_group(event.group)
            new_notification_message_object.open_period_start = open_period_start

        # Get thread timestamp using the provided method and args
        with MessagingInteractionEvent(
            MessagingInteractionType.GET_PARENT_NOTIFICATION, SlackMessagingSpec()
        ).capture() as lifecycle:
            thread_ts = SlackNotifyServiceAction._get_issue_alert_thread_ts(
                lifecycle=lifecycle,
                event=event,
                new_notification_message_object=new_notification_message_object,
                organization=self.project.organization,
                rule_id=rule_id,
                rule_action_uuid=rule_action_uuid,
                open_period_start=open_period_start,
            )

        save_method = None
        if rule_action_uuid and rule_id:
            save_method = SlackNotifyServiceAction._save_issue_alert_notification_message

        self._send_notification(
            event=event,
            futures=futures,
            tags=tags,
            integration=integration,
            channel=channel,
            notification_uuid=notification_uuid,
            notification_message_object=new_notification_message_object,
            save_notification_method=save_method,
            thread_ts=thread_ts,
        )
        self.record_notification_sent(event, channel, rule, notification_uuid)

    def _send_notification_action_notification(
        self,
        event: GroupEvent,
        futures: Sequence[RuleFuture],
        tags: set,
        integration: RpcIntegration,
        channel: str,
        notification_uuid: str | None = None,
    ) -> None:
        """Send a notification action notification to Slack."""
        rules = [f.rule for f in futures]
        rule = rules[0] if rules else None
        rule_to_use = self.rule if self.rule else rule
        # In the NOA, we will store the action id in the rule id field
        action_id = rule_to_use.id if rule_to_use else None

        if not action_id:
            # We are logging because this should never happen, all actions should have an uuid
            # We can monitor for this, and create an alert if this ever appears
            _default_logger.info(
                "No action id found in the rule future",
            )
            return

        if str(action_id) == "-1":
            self._send_notification(
                event=event,
                futures=futures,
                tags=tags,
                integration=integration,
                channel=channel,
            )

        try:
            action = Action.objects.get(id=action_id)
        except Action.DoesNotExist:
            _default_logger.info(
                "Action not found",
                extra={
                    "action_id": action_id,
                },
            )
            return

        new_notification_message_object = NewNotificationActionNotificationMessage(
            action_id=action_id,
            group_id=event.group.id,
        )

        open_period_start: datetime | None = None
        if (
            event.group.issue_category == GroupCategory.UPTIME
            or event.group.issue_category == GroupCategory.METRIC_ALERT
        ):
            open_period_start = open_period_start_for_group(event.group)
            new_notification_message_object.open_period_start = open_period_start

        thread_ts = None
        with MessagingInteractionEvent(
            MessagingInteractionType.GET_PARENT_NOTIFICATION, SlackMessagingSpec()
        ).capture() as lifecycle:
            parent_notification_message = (
                NotificationActionThreadUtils._get_notification_action_for_notification_action(
                    lifecycle=lifecycle,
                    action=action,
                    group=event.group,
                    organization=self.project.organization,
                    open_period_start=open_period_start,
                    thread_option_default=ISSUE_ALERTS_THREAD_DEFAULT,
                )
            )

            if parent_notification_message is not None:
                new_notification_message_object.parent_notification_message_id = (
                    parent_notification_message.id
                )
                thread_ts = parent_notification_message.message_identifier

        self._send_notification(
            event=event,
            futures=futures,
            tags=tags,
            integration=integration,
            channel=channel,
            notification_uuid=notification_uuid,
            notification_message_object=new_notification_message_object,
            save_notification_method=NotificationActionThreadUtils._save_notification_action_message,
            thread_ts=thread_ts,
        )
        self.record_notification_sent(event, channel, rule, notification_uuid)

    def after(
        self, event: GroupEvent, notification_uuid: str | None = None
    ) -> Generator[CallbackFuture]:
        channel = self.get_option("channel_id")
        tags = set(self.get_tags_list())

        i = self.get_integration()
        if not i:
            # Integration removed, rule still active.
            return

        # integration is captured in a closure, type assert the None case is handled.
        integration: RpcIntegration = i

        def send_notification(event: GroupEvent, futures: Sequence[RuleFuture]) -> None:
            self._send_issue_alert_notification(
                event=event,
                futures=futures,
                tags=tags,
                integration=integration,
                channel=channel,
                notification_uuid=notification_uuid,
            )

        def send_notification_noa(event: GroupEvent, futures: Sequence[RuleFuture]) -> None:
            self._send_notification_action_notification(
                event=event,
                futures=futures,
                tags=tags,
                integration=integration,
                channel=channel,
                notification_uuid=notification_uuid,
            )

        key = f"slack:{integration.id}:{channel}"

        metrics.incr(
            "notifications.sent",
            instance="slack.notification",
            tags={
                "issue_type": event.group.issue_type.slug,
            },
            skip_internal=False,
        )
        if features.has("organizations:workflow-engine-trigger-actions", self.project.organization):
            yield self.future(send_notification_noa, key=key)
        else:
            yield self.future(send_notification, key=key)

    def render_label(self) -> str:
        tags = self.get_tags_list()
        channel = self.get_option("channel").lstrip("#")
        workspace = self.get_integration_name()
        notes = self.get_option("notes")

        label = f"Send a notification to the {workspace} Slack workspace to #{channel}"
        has_tags = True if tags and tags != [""] else False
        # by default we have a list of empty single quotes if no tags are entered

        if has_tags:
            formatted_tags = "[{}]".format(", ".join(tags))
            label += f" and show tags {formatted_tags}"

        if notes:
            if has_tags:
                label += f' and notes "{notes}"'
            else:
                label += f' and show notes "{notes}"'

        if notes or has_tags:
            label += " in notification"

        return label

    def get_tags_list(self) -> Sequence[str]:
        return [s.strip() for s in self.get_option("tags", "").split(",")]

    def get_form_instance(self) -> SlackNotifyServiceForm:
        return SlackNotifyServiceForm(
            self.data, integrations=self.get_integrations(), channel_transformer=self.get_channel_id
        )

    def get_channel_id(self, integration: Integration, name: str) -> SlackChannelIdData:
        return get_channel_id(integration, name)
