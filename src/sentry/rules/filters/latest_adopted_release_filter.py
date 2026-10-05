from __future__ import annotations

from django import forms

from sentry.models.environment import Environment
from sentry.rules.filters.base import EventFilter
from sentry.workflow_engine.handlers.condition.utils.age import (
    age_comparison_choices,
    model_age_choices,
)


class LatestAdoptedReleaseForm(forms.Form):
    oldest_or_newest = forms.ChoiceField(choices=list(model_age_choices))
    older_or_newer = forms.ChoiceField(choices=list(age_comparison_choices))
    environment = forms.CharField()

    def __init__(self, project, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.project = project

    def clean_environment(self):
        environment = self.cleaned_data.get("environment")
        if environment:
            try:
                Environment.get_for_organization_id(self.project.organization_id, environment)
            except Environment.DoesNotExist:
                raise forms.ValidationError(
                    "environment does not exist or is not associated with this organization"
                )
        return environment


class LatestAdoptedReleaseFilter(EventFilter):
    id = "sentry.rules.filters.latest_adopted_release_filter.LatestAdoptedReleaseFilter"
    label = "The {oldest_or_newest} release associated with the event's issue is {older_or_newer} than the latest adopted release in {environment}"

    form_fields = {
        "oldest_or_newest": {"type": "choice", "choices": list(model_age_choices)},
        "older_or_newer": {"type": "choice", "choices": list(age_comparison_choices)},
        "environment": {"type": "string", "placeholder": "value"},
    }

    def get_form_instance(self) -> LatestAdoptedReleaseForm:
        return LatestAdoptedReleaseForm(self.project, self.data)
