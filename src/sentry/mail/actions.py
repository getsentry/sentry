import logging

from sentry import features
from sentry.eventstore.models import Event
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
    form_cls = NotifyEmailForm
    label = "Send a notification to {targetType}"
    prompt = "Send a notification"
    metrics_slug = "EmailAction"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.form_fields = {"targetType": {"type": "mailAction", "choices": ACTION_CHOICES}}

        if features.has(
            "organizations:issue-alert-fallback-targeting", self.project.organization, actor=None
        ):
            self.label = "Send a notification to {targetType} and if none can be found then send a notification to {fallthroughType}"
            self.form_fields["fallthroughType"] = {"type": "choice", "choices": FALLTHROUGH_CHOICES}

    def render_label(self) -> str:
        if features.has(
            "organizations:issue-alert-fallback-targeting", self.project.organization, actor=None
        ):
            if "fallthroughType" not in self.data:
                self.data["fallthroughType"] = FallthroughChoiceType.ACTIVE_MEMBERS.value
            return self.label.format(**self.data)

        return "Send a notification to {targetType}".format(**self.data)

    def after(self, event, state):
        group = event.group
        extra = {"event_id": event.event_id, "group_id": group.id}
        group = event.group

        target_type = ActionTargetType(self.data["targetType"])
        target_identifier = self.data.get("targetIdentifier", None)
        skip_digests = self.data.get("skipDigests", False)

        fallthrough_type = None
        if features.has(
            "organizations:issue-alert-fallback-targeting", self.project.organization, actor=None
        ):
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
            )
        )

    def get_form_instance(self):
        return self.form_cls(self.project, self.data)


class NotifyActiveReleaseEmailAction(NotifyEmailAction):
    """
    Send an 'active_release' notification to all release committers when a new issue is seen.
    This is a specialized form of `NotifyEmailAction` in that:
        1. This action should never be configurable as a rule action by a user.
        2. The `target_type` is pinned to `RELEASE_MEMBERS`
        3. The callback invoked in `after()` does not make any use of the `RuleFuture`s since
            this action is not rule-aware.
    """

    id = "sentry.mail.actions.NotifyActiveReleaseEmailAction"
    form_cls = NotifyEmailForm
    label = f"Send a notification to {ActionTargetType.RELEASE_MEMBERS.value}"
    metrics_slug = "ActiveReleaseEmailAction"

    def after(self, event: Event, state):
        recipients = determine_eligible_recipients(
            event.group.project,
            ActionTargetType.RELEASE_MEMBERS,
            target_identifier=None,
            event=event,
        )
        if not recipients:
            self.logger.info(
                "rule.fail.should_notify",
                extra={"event_id": event.event_id, "group_id": event.group.id},
            )
            return

        metrics.incr("notifications.sent", instance=self.metrics_slug, skip_internal=False)
        yield self.future(lambda evt, futures: mail_adapter.active_release_notify(evt, state))
