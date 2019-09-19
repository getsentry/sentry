"""
Used for notifying a *specific* plugin
"""
from __future__ import absolute_import

from django import forms

from sentry.rules.actions.base import EventAction
from sentry.models import Integration


class PagerDutyNotifyServiceForm(forms.Form):
    tags = forms.CharField(required=False, widget=forms.TextInput())

    def __init__(self, *args, **kwargs):
        super(PagerDutyNotifyServiceForm, self).__init__(*args, **kwargs)


class PagerDutyNotifyServiceAction(EventAction):
    form_cls = PagerDutyNotifyServiceForm
    label = "Send a notification to the PagerDuty app {app} with {tags} tags"

    def __init__(self, *args, **kwargs):
        super(PagerDutyNotifyServiceAction, self).__init__(*args, **kwargs)
        self.form_fields = {
            "app": {"type": "choice", "choices": [(i.id, i.name) for i in self.get_integrations()]},
            "tags": {"type": "string", "placeholder": "i.e environment,user,my_tag"},
        }

    def after(self, event, state):

        extra = {"event_id": event.id}

        try:
            integration = Integration.objects.get(
                provider="pagerduty", organizations=self.project.organization, id=integration_id
            )
        except Integration.DoesNotExist:
            # Integration removed, rule still active.
            return

        yield "mleep"

    def get_tags_list(self):
        return [s.strip() for s in self.get_option("tags", "").split(",")]

    def get_integrations(self):
        return Integration.objects.filter(
            provider="pagerduty", organizations=self.project.organization
        )

    def get_form_instance(self):
        return self.form_cls(self.data, integrations=self.get_integrations())
