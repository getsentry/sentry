from __future__ import annotations

from collections.abc import Generator, Sequence
from datetime import datetime
from logging import Logger, getLogger
from typing import Any

import orjson
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
from sentry.integrations.repository.issue_alert import (
    IssueAlertNotificationMessageRepository,
    NewIssueAlertNotificationMessage,
)
from sentry.integrations.services.integration import RpcIntegration
from sentry.integrations.slack.actions.form import SlackNotifyServiceForm
from sentry.integrations.slack.message_builder.issues import SlackIssuesMessageBuilder
from sentry.integrations.slack.message_builder.notifications.rule_save_edit import (
    SlackRuleSaveEditMessageBuilder,
)
from sentry.integrations.slack.metrics import (
    SLACK_ISSUE_ALERT_FAILURE_DATADOG_METRIC,
    SLACK_ISSUE_ALERT_SUCCESS_DATADOG_METRIC,
)
from sentry.integrations.slack.sdk_client import SlackSdkClient
from sentry.integrations.slack.spec import SlackMessagingSpec
from sentry.integrations.slack.utils.channel import SlackChannelIdData, get_channel_id
from sentry.integrations.slack.utils.errors import (
    SLACK_SDK_HALT_ERROR_CATEGORIES,
    unpack_slack_api_error,
)
from sentry.integrations.utils.metrics import EventLifecycle
from sentry.issues.grouptype import GroupCategory
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.rule import Rule
from sentry.notifications.additional_attachment_manager import get_additional_attachment
from sentry.notifications.utils.open_period import open_period_start_for_group
from sentry.rules.actions import IntegrationEventAction
from sentry.rules.base import CallbackFuture
from sentry.types.rules import RuleFuture
from sentry.utils import metrics

_default_logger: Logger = getLogger(__name__)


class SlackNotifyServiceAction(IntegrationEventAction):
    id = "sentry.integrations.slack.notify_action.SlackNotifyServiceAction"
    form_cls = SlackNotifyServiceForm
    prompt = "Send a Slack notification"
    provider = "slack"
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

        self._repository: IssueAlertNotificationMessageRepository = (
            get_default_issue_alert_repository()
        )

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
            rules = [f.rule for f in futures]
            additional_attachment = get_additional_attachment(
                integration, self.project.organization
            )
            blocks = SlackIssuesMessageBuilder(
                group=event.group,
                event=event,
                tags=tags,
                rules=rules,
                notes=self.get_option("notes", ""),
            ).build(notification_uuid=notification_uuid)

            if additional_attachment:
                for block in additional_attachment:
                    blocks["blocks"].append(block)

            if payload_blocks := blocks.get("blocks"):
                json_blocks = orjson.dumps(payload_blocks).decode()

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
            if (
                features.has(
                    "organizations:slack-threads-refactor-uptime", self.project.organization
                )
                and event.group.issue_category == GroupCategory.UPTIME
            ):
                open_period_start = open_period_start_for_group(event.group)
                # Save in the notification message object so it can be used in the repository
                new_notification_message_object.open_period_start = open_period_start

            def get_thread_ts(lifecycle: EventLifecycle) -> str | None:
                """Find the thread in which to post this notification as a reply.

                Return None to post the notification as a top-level message.
                """

                # We need to search by rule action uuid and rule id, so only search if they exist
                if not (
                    rule_action_uuid
                    and rule_id
                    and OrganizationOption.objects.get_value(
                        organization=self.project.organization,
                        key="sentry:issue_alerts_thread_flag",
                        default=ISSUE_ALERTS_THREAD_DEFAULT,
                    )
                ):
                    return None

                try:
                    parent_notification_message = self._repository.get_parent_notification_message(
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

            with MessagingInteractionEvent(
                MessagingInteractionType.GET_PARENT_NOTIFICATION, SlackMessagingSpec()
            ).capture() as lifecycle:
                thread_ts = get_thread_ts(lifecycle)

            # If this flow is triggered again for the same issue, we want it to be seen in the main channel
            reply_broadcast = thread_ts is not None

            client = SlackSdkClient(integration_id=integration.id)
            text = str(blocks.get("text"))
            # Wrap the Slack API call with lifecycle tracking
            with MessagingInteractionEvent(
                interaction_type=MessagingInteractionType.SEND_ISSUE_ALERT_NOTIFICATION,
                spec=SlackMessagingSpec(),
            ).capture() as lifecycle:
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
                except SlackApiError as e:
                    # Record the error code and details from the exception
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
                        "payload": json_blocks,
                    }
                    if self.get_option("channel"):
                        log_params["channel_name"] = self.get_option("channel")

                    lifecycle.add_extras(log_params)
                    # If the error is a channel not found or archived, we can halt the flow
                    if (
                        (reason := unpack_slack_api_error(e))
                        and reason is not None
                        and reason in SLACK_SDK_HALT_ERROR_CATEGORIES
                    ):
                        lifecycle.record_halt(reason.message)
                    else:
                        lifecycle.record_failure(e)
                else:
                    ts = response.get("ts")
                    new_notification_message_object.message_identifier = (
                        str(ts) if ts is not None else None
                    )

            if rule_action_uuid and rule_id:
                try:
                    self._repository.create_notification_message(
                        data=new_notification_message_object
                    )
                except NotificationMessageValidationError as err:
                    extra = (
                        new_notification_message_object.__dict__
                        if new_notification_message_object
                        else None
                    )
                    _default_logger.info(
                        "Validation error for new notification message", exc_info=err, extra=extra
                    )
                except Exception:
                    # if there's an error trying to save a notification message, don't let that error block this flow
                    # we already log at the repository layer, no need to log again here
                    pass

            self.record_notification_sent(event, channel, rule, notification_uuid)

        key = f"slack:{integration.id}:{channel}"

        metrics.incr("notifications.sent", instance="slack.notification", skip_internal=False)
        yield self.future(send_notification, key=key)

    def send_confirmation_notification(
        self, rule: Rule, new: bool, changed: dict[str, Any] | None = None
    ):
        integration = self.get_integration()
        if not integration:
            # Integration removed, rule still active.
            return

        channel = self.get_option("channel_id")
        blocks = SlackRuleSaveEditMessageBuilder(rule=rule, new=new, changed=changed).build()
        json_blocks = orjson.dumps(blocks.get("blocks")).decode()
        client = SlackSdkClient(integration_id=integration.id)

        try:
            client.chat_postMessage(
                blocks=json_blocks,
                text=blocks.get("text"),
                channel=channel,
                unfurl_links=False,
                unfurl_media=False,
            )
            metrics.incr(
                SLACK_ISSUE_ALERT_SUCCESS_DATADOG_METRIC,
                sample_rate=1.0,
                tags={"action": "send_confirmation"},
            )
        except SlackApiError as e:
            log_params = {
                "error": str(e),
                "project_id": rule.project.id,
                "channel_name": self.get_option("channel"),
            }
            self.logger.info(
                "slack.issue_alert.confirmation.fail",
                extra=log_params,
            )
            metrics.incr(
                SLACK_ISSUE_ALERT_FAILURE_DATADOG_METRIC,
                sample_rate=1.0,
                tags={
                    "action": "send_confirmation",
                    "ok": e.response.get("ok", False),
                    "status": e.response.status_code,
                },
            )

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

    def get_form_instance(self) -> Any:
        return self.form_cls(
            self.data, integrations=self.get_integrations(), channel_transformer=self.get_channel_id
        )

    def get_channel_id(self, integration: Integration, name: str) -> SlackChannelIdData:
        return get_channel_id(integration, name)
