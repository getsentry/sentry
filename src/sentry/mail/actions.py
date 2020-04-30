from __future__ import absolute_import

from django import forms

from sentry.mail import mail_adapter
from sentry.mail.adapter import ActionTargetType
from sentry.models import Project, User
from sentry.rules.actions.base import EventAction
from sentry.utils import metrics


CHOICES = [
    (ActionTargetType.ISSUE_OWNERS.value, "Issue Owners"),
    (ActionTargetType.TEAM.value, "Team"),
    (ActionTargetType.MEMBER.value, "Member"),
]


class NotifyEmailForm(forms.Form):
    targetType = forms.ChoiceField(choices=CHOICES)
    targetIdentifier = forms.CharField(
        required=False, help_text="Only required if 'Member' or 'Team' is selected"
    )

    def __init__(self, project, *args, **kwargs):
        super(NotifyEmailForm, self).__init__(*args, **kwargs)
        self.project = project

    def clean_targetIdentifier(self):
        targetIdentifier = self.cleaned_data.get("targetIdentifier")
        # XXX: Clean up some bad data in the database
        if targetIdentifier == "None":
            targetIdentifier = None
        if targetIdentifier:
            try:
                targetIdentifier = int(targetIdentifier)
            except ValueError:
                raise forms.ValidationError("targetIdentifier must be an integer")
        return targetIdentifier

    def clean(self):
        cleaned_data = super(NotifyEmailForm, self).clean()
        try:
            targetType = ActionTargetType(cleaned_data.get("targetType"))
        except ValueError:
            msg = forms.ValidationError("Invalid targetType specified")
            self.add_error("targetType", msg)
            return

        targetIdentifier = cleaned_data.get("targetIdentifier")

        self.cleaned_data["targetType"] = targetType.value
        if targetType == ActionTargetType.ISSUE_OWNERS:
            return

        if targetIdentifier is None:
            msg = forms.ValidationError("You need to specify a Team or Member to send mail to.")
            self.add_error("targetIdentifier", msg)
            return

        if (
            targetType == ActionTargetType.TEAM
            and not Project.objects.filter(
                teams__id=int(targetIdentifier), id=self.project.id
            ).exists()
        ):
            msg = forms.ValidationError("This team is not part of the project.")
            self.add_error("targetIdentifier", msg)
            return

        if (
            targetType == ActionTargetType.MEMBER
            and not User.objects.get_from_projects(self.project.organization.id, [self.project])
            .filter(id=int(targetIdentifier))
            .exists()
        ):
            msg = forms.ValidationError("This user is not part of the project.")
            self.add_error("targetIdentifier", msg)
            return

        self.cleaned_data["targetIdentifier"] = targetIdentifier


class NotifyEmailAction(EventAction):
    form_cls = NotifyEmailForm
    label = "Send an email to {targetType}"
    prompt = "Send an email"
    metrics_slug = "EmailAction"

    def __init__(self, *args, **kwargs):
        super(NotifyEmailAction, self).__init__(*args, **kwargs)
        self.form_fields = {"targetType": {"type": "mailAction", "choices": CHOICES}}

    def after(self, event, state):
        extra = {"event_id": event.event_id}
        group = event.group

        if not mail_adapter.should_notify(group=group):
            extra["group_id"] = group.id
            self.logger.info("rule.fail.should_notify", extra=extra)
            return

        metrics.incr("notifications.sent", instance=self.metrics_slug, skip_internal=False)
        yield self.future(
            lambda event, futures: mail_adapter.rule_notify(
                event,
                futures,
                ActionTargetType(self.data["targetType"]),
                self.data.get("targetIdentifier", None),
            )
        )

    def get_form_instance(self):
        return self.form_cls(self.project, self.data)
