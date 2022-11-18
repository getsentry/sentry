from datetime import datetime
from typing import Any, List, Optional, Tuple

from django.conf import settings
from pytz import UTC

from sentry.dynamic_sampling.utils import BOOSTED_RELEASES_LIMIT
from sentry.utils import redis

BOOSTED_RELEASE_TIMEOUT = 60 * 60
ONE_DAY_TIMEOUT_MS = 60 * 60 * 24 * 1000
ENVIRONMENT_SEPARATOR = ":e:"


class TooManyBoostedReleasesException(Exception):
    pass


def _get_environment_cache_key_postfix(environment: Optional[str]) -> str:
    return f"{ENVIRONMENT_SEPARATOR}{environment}" if environment else ""


def get_redis_client_for_ds() -> Any:
    cluster_key = getattr(settings, "SENTRY_DYNAMIC_SAMPLING_RULES_REDIS_CLUSTER", "default")
    return redis.redis_clusters.get(cluster_key)


def generate_cache_key_for_observed_release(
    project_id: int, release_id: int, environment: Optional[str]
) -> str:
    """
    Generates a cache key that uniquely identifies whether we observed a transaction of a given release with a given
    environment in a given project.

    The addition of the environment comes from the reasoning that we want to boost the latest release considering also
    the environment tag.

    For example some users might create the release "1.0" and send transactions with environment "dev" which we will
    boost but if after some time they send a transaction with environment "prod" in release "1.0" they expect us to
    boost also that. This requires a tuple for computing uniqueness of release, that is, the tuple (release,
    environment).
    """
    return f"ds::p:{project_id}:r:{release_id}{_get_environment_cache_key_postfix(environment)}"


def generate_cache_key_for_boosted_releases_hash(project_id: int) -> str:
    """
    Generates a cache key for the boosted releases for a given project.
    """
    return f"ds::p:{project_id}:boosted_releases"


def generate_cache_key_for_boosted_release_with_environment(
    release_id: int, environment: Optional[str]
) -> str:
    """
    Generates a cache key for the boosted release within a hash.
    """
    return f"ds::r:{release_id}{_get_environment_cache_key_postfix(environment)}"


def extract_release_and_environment_from_cache_key(cache_key: str) -> Tuple[int, Optional[str]]:
    """
    Extracts the release id and the environment from the cache key, in order to avoid storing the metadata also
    in the value field.
    """
    # Hardcoded string split based on the "generate_cache_key_for_boosted_release_with_environment()" format.
    cache_key = cache_key[6:]

    # If we have an environment we want to extract it.
    if ENVIRONMENT_SEPARATOR in cache_key:
        release_id, environment = cache_key.split(ENVIRONMENT_SEPARATOR)
        return int(release_id), environment
    else:
        return int(cache_key), None


def observe_release(project_id: int, release_id: int, environment: Optional[str]) -> bool:
    """
    Checks if release was observed in the last 24 hours, and resets the cache timeout. If the release was observed,
    returns True otherwise returns False.
    """
    redis_client = get_redis_client_for_ds()
    boosted_releases_count = redis_client.hlen(
        generate_cache_key_for_boosted_releases_hash(project_id)
    )
    if boosted_releases_count >= BOOSTED_RELEASES_LIMIT:
        raise TooManyBoostedReleasesException
    cache_key = generate_cache_key_for_observed_release(project_id, release_id, environment)

    # TODO(ahmed): Modify these two statements into one once we upgrade to a higher redis-py version as in newer
    #  versions these two operations can be done in a single call.
    release_observed = redis_client.getset(name=cache_key, value=1)
    redis_client.pexpire(cache_key, ONE_DAY_TIMEOUT_MS)
    return release_observed == "1"  # type: ignore


def get_boosted_releases(project_id: int) -> List[Tuple[int, Optional[str], float]]:
    """
    Function that returns the releases that should be boosted for a given project, and excludes expired releases.
    """
    cache_key = generate_cache_key_for_boosted_releases_hash(project_id)
    current_timestamp = datetime.utcnow().replace(tzinfo=UTC).timestamp()

    redis_client = get_redis_client_for_ds()
    old_boosted_releases = redis_client.hgetall(cache_key)

    boosted_releases = []
    expired_releases = []
    for boosted_release_cache_key, timestamp in old_boosted_releases.items():
        if current_timestamp <= float(timestamp) + BOOSTED_RELEASE_TIMEOUT:
            release_id, environment = extract_release_and_environment_from_cache_key(
                boosted_release_cache_key
            )
            boosted_releases.append((release_id, environment, float(timestamp)))
        else:
            expired_releases.append(boosted_release_cache_key)

    if expired_releases:
        redis_client.hdel(cache_key, *expired_releases)

    return boosted_releases


def add_boosted_release(project_id: int, release_id: int, environment: Optional[str]) -> None:
    """
    Function that adds a release to the list of active boosted releases for a given project.
    """
    # Called here for expired releases cleanup
    get_boosted_releases(project_id)

    cache_key = generate_cache_key_for_boosted_releases_hash(project_id)
    redis_client = get_redis_client_for_ds()
    # TODO(ahmed): Modify these two statements into one once we upgrade to a higher redis-py version as in newer
    #  versions these two operations can be done in a single call.
    redis_client.hset(
        cache_key,
        generate_cache_key_for_boosted_release_with_environment(release_id, environment),
        datetime.utcnow().replace(tzinfo=UTC).timestamp(),
    )
    redis_client.pexpire(cache_key, BOOSTED_RELEASE_TIMEOUT * 1000)
