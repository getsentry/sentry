from __future__ import annotations

import logging
from itertools import product
from typing import Any

from django import forms
from django.db.models.signals import post_delete, post_save

from sentry.eventstore.models import GroupEvent
from sentry.models.environment import Environment
from sentry.models.grouprelease import GroupRelease
from sentry.models.release import Release, follows_semver_versioning_scheme
from sentry.models.releaseenvironment import ReleaseEnvironment
from sentry.rules import EventState
from sentry.rules.age import (
    AgeComparisonType,
    ModelAgeType,
    age_comparison_choices,
    model_age_choices,
)
from sentry.rules.filters.base import EventFilter
from sentry.search.utils import (
    LatestReleaseOrders,
    get_first_last_release_for_group,
    get_latest_release,
)
from sentry.utils.cache import cache


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


def get_first_last_release_for_env(
    event: GroupEvent, release_age_type: str, order_type: LatestReleaseOrders
) -> Release | None:
    """
    Fetches the first/last release for the group associated with this group
    """
    group = event.group
    cache_key = get_first_last_release_for_group_cache_key(group.id, release_age_type, order_type)
    release = cache.get(cache_key)
    if release is None:

        try:
            release = get_first_last_release_for_group(
                group, order_type, release_age_type == ModelAgeType.NEWEST
            )
        except Release.DoesNotExist:
            release = None

        if release:
            cache.set(cache_key, release, 600)
        else:
            cache.set(cache_key, False, 600)

    return release


class LatestAdoptedReleaseFilter(EventFilter):
    id = "sentry.rules.filters.latest_adopted_release_filter.LatestAdoptedReleaseFilter"
    form_cls = LatestAdoptedReleaseForm
    label = "The {oldest_or_newest} adopted release associated with the event's issue is {older_or_newer} than the latest adopted release in {environment}"

    form_fields = {
        "oldest_or_newest": {"type": "choice", "choices": list(model_age_choices)},
        "older_or_newer": {"type": "choice", "choices": list(age_comparison_choices)},
        "environment": {"type": "string", "placeholder": "value"},
    }

    def get_latest_release_for_env(
        self, event: GroupEvent, environment: Environment
    ) -> Release | None:
        cache_key = get_project_release_cache_key(event.project_id, environment.id)
        latest_release = cache.get(cache_key)
        if latest_release is None:
            organization_id = event.organization.id
            try:
                latest_release_versions = get_latest_release(
                    [event.project],
                    [environment],
                    organization_id,
                    adopted=True,
                )
            except Release.DoesNotExist:
                logging.info("Latest release not found")
                return None
            latest_release = Release.objects.get(
                version=latest_release_versions[0], organization_id=organization_id
            )

            if latest_release:
                cache.set(cache_key, latest_release, 600)
            else:
                cache.set(cache_key, False, 600)
        return latest_release

    def passes(self, event: GroupEvent, state: EventState) -> bool:
        release_age_type = self.get_option("oldest_or_newest")
        age_comparison = self.get_option("older_or_newer")
        environment_name = self.get_option("environment")

        if follows_semver_versioning_scheme(event.organization.id, event.project_id):
            order_type = LatestReleaseOrders.SEMVER
        else:
            order_type = LatestReleaseOrders.DATE

        try:
            environment = Environment.get_for_organization_id(
                self.project.organization_id, environment_name
            )
        except Environment.DoesNotExist:
            return False

        latest_project_release = self.get_latest_release_for_env(event, environment)
        if not latest_project_release:
            return False

        release = get_first_last_release_for_env(event, release_age_type, order_type)
        if not release:
            return False

        if age_comparison == AgeComparisonType.NEWER:
            return is_newer_release(release, latest_project_release, order_type)
        elif age_comparison == AgeComparisonType.OLDER:
            return is_newer_release(latest_project_release, release, order_type)

        return False

    def get_form_instance(self) -> forms.Form:
        form: forms.Form = self.form_cls(self.project, self.data)
        return form


def is_newer_release(
    release: Release, comparison_release: Release, order_type: LatestReleaseOrders
):
    if (
        order_type == LatestReleaseOrders.SEMVER
        and release.is_semver_release
        and comparison_release.is_semver_release
    ):
        return release.semver_tuple > comparison_release.semver_tuple
    else:
        release_date = release.date_released if release.date_released else release.date_added
        comparison_date = (
            comparison_release.date_released
            if comparison_release.date_released
            else comparison_release.date_added
        )
        return release_date > comparison_date


def get_first_last_release_for_group_cache_key(
    group_id: int, release_age_type: str, order_type: LatestReleaseOrders
) -> str:
    return f"group:{group_id}:{release_age_type}:{order_type.name.lower()}:first_last_release"


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


def get_project_release_cache_key(project_id: int, environment_id: int) -> str:
    return f"project:{project_id}:env:{environment_id}:latest_release_adopted"


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
