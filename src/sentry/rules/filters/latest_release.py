from django.db.models.signals import post_save, post_delete, pre_delete

from sentry import tagstore
from sentry.api.serializers.models.project import bulk_fetch_project_latest_releases
from sentry.models import Release, ReleaseProject
from sentry.rules.filters.base import EventFilter
from sentry.utils.cache import cache


def get_project_release_cache_key(project_id):
    return f"project:{project_id}:latest_release"


# clear the cache given a Release object
def clear_release_cache(instance, **kwargs):
    release_project_ids = instance.projects.values_list("id", flat=True)
    cache.delete_many([get_project_release_cache_key(proj_id) for proj_id in release_project_ids])


# clear the cache given a ReleaseProject object
def clear_release_project_cache(instance, **kwargs):
    proj_id = instance.project_id
    cache.delete(get_project_release_cache_key(proj_id))


class LatestReleaseFilter(EventFilter):
    label = "The event is from the latest release"

    def get_latest_release(self, event):
        cache_key = get_project_release_cache_key(event.group.project_id)
        latest_release = cache.get(cache_key)
        if latest_release is None:
            latest_releases = bulk_fetch_project_latest_releases([event.group.project])
            if latest_releases:
                cache.set(cache_key, latest_releases[0], 600)
                return latest_releases[0]
            else:
                cache.set(cache_key, False, 600)
        return latest_release

    def passes(self, event, state):
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
