from __future__ import annotations

from typing import Any

from django.db.models.signals import post_delete, post_save, pre_delete

from sentry.models.release import Release
from sentry.models.releaseenvironment import ReleaseEnvironment
from sentry.models.releases.release_project import ReleaseProject
from sentry.rules.filters.base import EventFilter
from sentry.utils.cache import cache


def get_project_release_cache_key(project_id: int, environment_id: int | None = None) -> str:
    if environment_id is None:
        return f"project:{project_id}:latest_release"
    return f"project:{project_id}:env:{environment_id}:latest_release"


# clear the cache given a Release object
def clear_release_cache(instance: Release, **kwargs: Any) -> None:
    release_project_ids = instance.projects.values_list("id", flat=True)
    cache.delete_many([get_project_release_cache_key(proj_id) for proj_id in release_project_ids])


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


# clear the cache given a ReleaseProject object
def clear_release_project_cache(instance: ReleaseProject, **kwargs: Any) -> None:
    proj_id = instance.project_id
    cache.delete(get_project_release_cache_key(proj_id))


class LatestReleaseFilter(EventFilter):
    id = "sentry.rules.filters.latest_release.LatestReleaseFilter"
    label = "The event is from the latest release"


post_save.connect(clear_release_cache, sender=Release, weak=False)
pre_delete.connect(clear_release_cache, sender=Release, weak=False)

post_save.connect(clear_release_project_cache, sender=ReleaseProject, weak=False)
post_delete.connect(clear_release_project_cache, sender=ReleaseProject, weak=False)

post_save.connect(clear_release_environment_project_cache, sender=ReleaseEnvironment, weak=False)
post_delete.connect(clear_release_environment_project_cache, sender=ReleaseEnvironment, weak=False)
