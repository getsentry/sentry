from sentry.mail import mail_adapter
from sentry.mail.forms.notify_email import NotifyEmailForm
from sentry.notifications.types import ACTION_CHOICES, ActionTargetType
from sentry.rules.actions.base import EventAction
from sentry.utils import metrics


class NotifyEmailAction(EventAction):
    form_cls = NotifyEmailForm
    label = "Send a notification to {targetType}"
    prompt = "Send a notification"
    metrics_slug = "EmailAction"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.form_fields = {"targetType": {"type": "mailAction", "choices": ACTION_CHOICES}}

    def after(self, event, state):
        extra = {"event_id": event.event_id}
        group = event.group

        target_type = ActionTargetType(self.data["targetType"])

        if not mail_adapter.should_notify(target_type, group=group):
            extra["group_id"] = group.id
            self.logger.info("rule.fail.should_notify", extra=extra)
            return

        metrics.incr("notifications.sent", instance=self.metrics_slug, skip_internal=False)
        yield self.future(
            lambda event, futures: mail_adapter.rule_notify(
                event, futures, target_type, self.data.get("targetIdentifier", None)
            )
        )

    def get_form_instance(self):
        return self.form_cls(self.project, self.data)
