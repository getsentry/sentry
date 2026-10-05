from sentry.models.release import Release
from sentry.search.utils import LatestReleaseOrders, get_first_last_release_for_group
from sentry.services.eventstore.models import GroupEvent
from sentry.utils.cache import cache
from sentry.workflow_engine.handlers.condition.utils.age import ModelAgeType


def get_first_last_release_for_event(
    event: GroupEvent, release_age_type: str, order_type: LatestReleaseOrders
) -> Release | None:
    """
    Fetches the first/last release for the group associated with this group event
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


def is_newer_release(
    release: Release, comparison_release: Release, order_type: LatestReleaseOrders
) -> bool:
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


def get_latest_adopted_release_cache_key(project_id: int, environment_id: int) -> str:
    return f"project:{project_id}:env:{environment_id}:latest_release_adopted"


def get_latest_release_cache_key(project_id: int, environment_id: int | None = None) -> str:
    if environment_id is None:
        return f"project:{project_id}:latest_release"
    return f"project:{project_id}:env:{environment_id}:latest_release"
