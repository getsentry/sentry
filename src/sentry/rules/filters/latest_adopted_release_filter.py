from __future__ import annotations

from itertools import product
from typing import Any

from django import forms
from django.db.models.signals import post_delete, post_save

from sentry.models.environment import Environment
from sentry.models.grouprelease import GroupRelease
from sentry.models.release import Release
from sentry.models.releaseenvironment import ReleaseEnvironment
from sentry.rules.filters.base import EventFilter
from sentry.search.utils import LatestReleaseOrders
from sentry.utils.cache import cache
from sentry.workflow_engine.handlers.condition.utils.age import (
    ModelAgeType,
    age_comparison_choices,
    model_age_choices,
)
from sentry.workflow_engine.handlers.condition.utils.releases import (
    get_first_last_release_for_group_cache_key,
)
from sentry.workflow_engine.handlers.condition.utils.releases import (
    get_latest_adopted_release_cache_key as get_project_release_cache_key,
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


def clear_get_first_last_release_for_group_cache(instance: GroupRelease, **kwargs: Any) -> None:
    model_ages_types = [ModelAgeType.NEWEST, ModelAgeType.OLDEST]
    order_types = [val for val in LatestReleaseOrders]
    cache.delete_many(
        [
            get_first_last_release_for_group_cache_key(
                instance.group_id, model_age_type, order_type
            )
            for model_age_type, order_type in product(model_ages_types, order_types)
        ]
    )


def clear_release_environment_project_cache(instance: ReleaseEnvironment, **kwargs: Any) -> None:
    try:
        release_project_ids = instance.release.projects.values_list("id", flat=True)
    except Release.DoesNotExist:
        # This can happen during deletions as release projects are removed before the release is.
        return

    cache.delete_many(
        [
            get_project_release_cache_key(proj_id, instance.environment_id)
            for proj_id in release_project_ids
        ]
    )


post_save.connect(clear_get_first_last_release_for_group_cache, sender=GroupRelease, weak=False)
post_delete.connect(clear_get_first_last_release_for_group_cache, sender=GroupRelease, weak=False)

post_save.connect(clear_release_environment_project_cache, sender=ReleaseEnvironment, weak=False)
post_delete.connect(clear_release_environment_project_cache, sender=ReleaseEnvironment, weak=False)
