import logging

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
from sentry.utils import metrics

logger = logging.getLogger(__name__)


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

    def after(self, event, notification_uuid: str | None = None):
        group = event.group
        extra = {
            "event_id": event.event_id,
            "group_id": group.id,
            "notification_uuid": notification_uuid,
        }
        group = event.group

        target_type = ActionTargetType(self.data["targetType"])
        target_identifier = self.data.get("targetIdentifier", None)
        skip_digests = self.data.get("skipDigests", False)

        fallthrough_choice = self.data.get("fallthroughType", None)
        fallthrough_type = (
            FallthroughChoiceType(fallthrough_choice)
            if fallthrough_choice
            else FallthroughChoiceType.ACTIVE_MEMBERS
        )

        if not determine_eligible_recipients(
            group.project, target_type, target_identifier, event, fallthrough_type
        ):
            self.logger.info("rule.fail.should_notify", extra=extra)
            return

        metrics.incr("notifications.sent", instance=self.metrics_slug, skip_internal=False)
        yield self.future(
            lambda event, futures: mail_adapter.rule_notify(
                event,
                futures,
                target_type,
                target_identifier,
                fallthrough_type,
                skip_digests,
                notification_uuid,
            )
        )

    def get_form_instance(self) -> NotifyEmailForm:
        return NotifyEmailForm(self.project, self.data)
