import logging
from collections.abc import Iterable
from dataclasses import dataclass

from sentry.eventstore.models import GroupEvent
from sentry.mail import mail_adapter
from sentry.mail.forms.notify_email import NotifyEmailForm
from sentry.notifications.types import (
    ACTION_CHOICES,
    FALLTHROUGH_CHOICES,
    ActionTargetType,
    FallthroughChoiceType,
)
from sentry.notifications.utils.participants import determine_eligible_recipients
from sentry.rules.actions.base import EventAction
from sentry.types.actor import Actor
from sentry.utils import metrics

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class NotifyEmailTarget:
    target_type: ActionTargetType
    target_identifier: str | None
    skip_digests: bool
    fallthrough_type: FallthroughChoiceType

    @classmethod
    def unpack(cls, event_action: EventAction) -> "NotifyEmailTarget":
        data = event_action.data
        target_type = ActionTargetType(data["targetType"])
        target_identifier = data.get("targetIdentifier", None)
        skip_digests = data.get("skipDigests", False)

        fallthrough_choice = data.get("fallthroughType", None)
        fallthrough_type = (
            FallthroughChoiceType(fallthrough_choice)
            if fallthrough_choice
            else FallthroughChoiceType.ACTIVE_MEMBERS
        )

        return cls(target_type, target_identifier, skip_digests, fallthrough_type)

    def get_eligible_recipients(self, event: GroupEvent) -> Iterable[Actor]:
        return determine_eligible_recipients(
            event.group.project,
            self.target_type,
            self.target_identifier,
            event,
            self.fallthrough_type,
        )


class NotifyEmailAction(EventAction):
    id = "sentry.mail.actions.NotifyEmailAction"
    label = "Send a notification to {targetType} and if none can be found then send a notification to {fallthroughType}"
    prompt = "Send a notification"
    metrics_slug = "EmailAction"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.form_fields = {
            "targetType": {"type": "mailAction", "choices": ACTION_CHOICES},
            "fallthroughType": {"type": "choice", "choices": FALLTHROUGH_CHOICES},
        }

    def render_label(self) -> str:
        if "fallthroughType" not in self.data:
            self.data = {**self.data, "fallthroughType": FallthroughChoiceType.ACTIVE_MEMBERS.value}
        return self.label.format(**self.data)

    def after(self, event: GroupEvent, notification_uuid: str | None = None):
        group = event.group
        extra = {
            "event_id": event.event_id,
            "group_id": group.id,
            "notification_uuid": notification_uuid,
        }

        target = NotifyEmailTarget.unpack(self)

        if not target.get_eligible_recipients(event):
            self.logger.info("rule.fail.should_notify", extra=extra)
            return

        metrics.incr(
            "notifications.sent",
            instance=self.metrics_slug,
            tags={
                "issue_type": group.issue_type.slug,
            },
            skip_internal=False,
        )
        yield self.future(
            lambda event, futures: mail_adapter.rule_notify(
                event,
                futures,
                target.target_type,
                target.target_identifier,
                target.fallthrough_type,
                target.skip_digests,
                notification_uuid,
            )
        )

    def get_form_instance(self) -> NotifyEmailForm:
        return NotifyEmailForm(self.project, self.data)
