from typing import Any, Optional

from django.db.models.signals import post_delete, post_save, pre_delete

from sentry import tagstore
from sentry.models import Environment, Event, Release, ReleaseEnvironment, ReleaseProject
from sentry.rules.filters.base import EventFilter
from sentry.search.utils import get_latest_release
from sentry.utils.cache import cache


def get_project_release_cache_key(project_id: int, environment_id: Optional[int] = None) -> str:
    if environment_id is None:
        return f"project:{project_id}:latest_release"
    return f"project:{project_id}:env:{environment_id}:latest_release"


# clear the cache given a Release object
def clear_release_cache(instance: Release, **kwargs: Any) -> None:
    release_project_ids = instance.projects.values_list("id", flat=True)
    cache.delete_many([get_project_release_cache_key(proj_id) for proj_id in release_project_ids])


def clear_release_environment_project_cache(instance: ReleaseEnvironment, **kwargs: Any) -> None:
    release_project_ids = instance.release.projects.values_list("id", flat=True)
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
    label = "The event is from the latest release"

    def get_latest_release(self, event: Event) -> Optional[Release]:
        environment_id = None if self.rule is None else self.rule.environment_id
        cache_key = get_project_release_cache_key(event.group.project_id, environment_id)
        latest_release = cache.get(cache_key)
        if latest_release is None:
            organization_id = event.group.project.organization_id
            environments = None
            if environment_id:
                environments = [Environment.objects.get(id=environment_id)]
            try:
                latest_release_versions = get_latest_release(
                    [event.group.project],
                    environments,
                    organization_id,
                )
            except Release.DoesNotExist:
                return None
            latest_releases = list(
                Release.objects.filter(
                    version=latest_release_versions[0], organization_id=organization_id
                )
            )
            if latest_releases:
                cache.set(cache_key, latest_releases[0], 600)
                return latest_releases[0]
            else:
                cache.set(cache_key, False, 600)
        return latest_release

    def passes(self, event: Event, state: Any) -> bool:
        latest_release = self.get_latest_release(event)
        if not latest_release:
            return False

        releases = (
            v.lower()
            for k, v in event.tags
            if k.lower() == "release" or tagstore.get_standardized_key(k) == "release"
        )

        for release in releases:
            if release == latest_release.version.lower():
                return True

        return False


post_save.connect(clear_release_cache, sender=Release, weak=False)
pre_delete.connect(clear_release_cache, sender=Release, weak=False)

post_save.connect(clear_release_project_cache, sender=ReleaseProject, weak=False)
post_delete.connect(clear_release_project_cache, sender=ReleaseProject, weak=False)

post_save.connect(clear_release_environment_project_cache, sender=ReleaseEnvironment, weak=False)
post_delete.connect(clear_release_environment_project_cache, sender=ReleaseEnvironment, weak=False)
