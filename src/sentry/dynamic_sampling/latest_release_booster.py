from datetime import datetime
from typing import Any, List, Tuple

from django.conf import settings
from pytz import UTC

from sentry.dynamic_sampling.utils import BOOSTED_RELEASES_LIMIT
from sentry.utils import redis

BOOSTED_RELEASE_TIMEOUT = 60 * 60
ONE_DAY_TIMEOUT_MS = 60 * 60 * 24 * 1000


class TooManyBoostedReleasesException(Exception):
    pass


def get_redis_client_for_ds() -> Any:
    cluster_key = getattr(settings, "SENTRY_DYNAMIC_SAMPLING_RULES_REDIS_CLUSTER", "default")
    return redis.redis_clusters.get(cluster_key)


def generate_cache_key_for_observed_release(project_id: int, release_id: int) -> str:
    """
    Generates a cache key for releases that had a transaction observed in the last 24 hours
    """
    return f"ds::p:{project_id}:r:{release_id}"


def generate_cache_key_for_boosted_release(project_id: int) -> str:
    """
    Generates a cache key for the boosted releases for a given project.
    """
    return f"ds::p:{project_id}:boosted_releases"


def observe_release(project_id: int, release_id: int) -> bool:
    """
    Checks if release was observed in the last 24 hours, and resets the cache timeout. If the release was observed,
    returns True otherwise returns False.
    """
    redis_client = get_redis_client_for_ds()
    boosted_releases_count = redis_client.hlen(generate_cache_key_for_boosted_release(project_id))
    if boosted_releases_count >= BOOSTED_RELEASES_LIMIT:
        raise TooManyBoostedReleasesException

    cache_key = generate_cache_key_for_observed_release(project_id, release_id)

    # TODO(ahmed): Modify these two statements into one once we upgrade to a higher redis-py version as in newer
    #  versions these two operations can be done in a single call.
    release_observed = redis_client.getset(name=cache_key, value=1)
    redis_client.pexpire(cache_key, ONE_DAY_TIMEOUT_MS)
    return release_observed == "1"  # type: ignore


def get_boosted_releases(project_id: int) -> List[Tuple[int, float]]:
    """
    Function that returns the releases that should be boosted for a given project, and excludes expired releases.
    """
    cache_key = generate_cache_key_for_boosted_release(project_id)
    current_timestamp = datetime.utcnow().replace(tzinfo=UTC).timestamp()

    redis_client = get_redis_client_for_ds()
    old_boosted_releases = redis_client.hgetall(cache_key)

    boosted_releases = []
    expired_releases = []
    for release_id, timestamp in old_boosted_releases.items():
        if current_timestamp <= float(timestamp) + BOOSTED_RELEASE_TIMEOUT:
            try:
                # Compatibility fix for new keys "ds::r:1234:e:prod".
                release_id = int(release_id)
                boosted_releases.append((release_id, float(timestamp)))
            except ValueError:
                continue
        else:
            expired_releases.append(release_id)

    if expired_releases:
        redis_client.hdel(cache_key, *expired_releases)
    return boosted_releases


def add_boosted_release(project_id: int, release_id: int) -> None:
    """
    Function that adds a release to the list of active boosted releases for a given project.
    """
    # Called here for expired releases cleanup
    get_boosted_releases(project_id)

    cache_key = generate_cache_key_for_boosted_release(project_id)
    redis_client = get_redis_client_for_ds()
    # TODO(ahmed): Modify these two statements into one once we upgrade to a higher redis-py version as in newer
    #  versions these two operations can be done in a single call.
    redis_client.hset(
        cache_key,
        release_id,
        datetime.utcnow().replace(tzinfo=UTC).timestamp(),
    )
    redis_client.pexpire(cache_key, BOOSTED_RELEASE_TIMEOUT * 1000)
