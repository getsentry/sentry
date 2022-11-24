import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from django.conf import settings
from pytz import UTC

from sentry.dynamic_sampling.latest_release_ttas import Platform
from sentry.dynamic_sampling.utils import BOOSTED_RELEASES_LIMIT
from sentry.models import Project, Release
from sentry.utils import redis

BOOSTED_RELEASE_TIMEOUT = 60 * 60
ONE_DAY_TIMEOUT_MS = 60 * 60 * 24 * 1000
ENVIRONMENT_SEPARATOR = ":e:"
BOOSTED_RELEASE_CACHE_KEY_REGEX = re.compile(
    r"^ds::r:(?P<release_id>\d+)(:e:(?P<environment>.+))?$"
)


class TooManyBoostedReleasesException(Exception):
    pass


@dataclass(frozen=True)
class BoostedRelease:
    id: int
    timestamp: float
    environment: Optional[str]

    def to_augmented(self, release: Release, project_id: int) -> "ExtendedBoostedRelease":
        return ExtendedBoostedRelease(
            id=self.id,
            timestamp=self.timestamp,
            environment=self.environment,
            version=release.version,
            platform=Platform(self._get_project_platform_from_release(release, project_id)),
        )

    @staticmethod
    def _get_project_platform_from_release(release: Release, project_id: int) -> Optional[str]:
        try:
            return release.projects.get(id=project_id).platform  # type:ignore
        except Project.DoesNotExist:
            # If we don't find the project of this release we just default to having no platform name in the
            # BoostedRelease.
            return None


@dataclass(frozen=True)
class ExtendedBoostedRelease(BoostedRelease):
    version: str
    platform: Platform


@dataclass
class BoostedReleases:
    boosted_releases: List[BoostedRelease] = field(default_factory=list)

    def add_release(self, id: int, timestamp: float, environment: Optional[str]) -> None:
        self.boosted_releases.append(
            BoostedRelease(id=id, timestamp=timestamp, environment=environment)
        )

    def to_extended_boosted_releases(
        self, project_id: int, limit: int
    ) -> List[ExtendedBoostedRelease]:
        # We get release models in order to have all the information to extend the releases we get from the cache.
        models = self._get_releases_models(limit)
        return [
            boosted_release.to_augmented(release=models[boosted_release.id], project_id=project_id)
            for boosted_release in self.boosted_releases
            if boosted_release.id in models
        ]

    def _get_last_release_ids(self, limit: int) -> List[int]:
        return [boosted_release.id for boosted_release in self.boosted_releases[-limit:]]

    def _get_releases_models(self, limit: int) -> Dict[int, Release]:
        return {
            release.id: release
            for release in Release.objects.filter(id__in=self._get_last_release_ids(limit=limit))
        }


def _get_environment_cache_key_suffix(environment: Optional[str]) -> str:
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
    return f"ds::p:{project_id}:r:{release_id}{_get_environment_cache_key_suffix(environment)}"


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
    return f"ds::r:{release_id}{_get_environment_cache_key_suffix(environment)}"


def _extract_release_and_environment_from_cache_key(
    cache_key: str,
) -> Optional[Tuple[int, Optional[str]]]:
    """
    Extracts the release id and the environment from the cache key, in order to avoid storing the metadata also
    in the value field.
    """
    if (match := BOOSTED_RELEASE_CACHE_KEY_REGEX.match(cache_key)) is not None:
        # If the cache key matches the new format, we will extract the necessary information.
        release_id = match["release_id"]
        environment = match["environment"]

        if release_id and environment:
            return int(release_id), environment
        elif release_id:
            return int(release_id), None

    # If the cache key doesn't match the new format, we will fallback to the old format which is just an integer.
    try:
        release_id = int(cache_key)
    except ValueError:
        # If the format is not an integer we will silently return None.
        return None
    else:
        return release_id, None


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


def get_boosted_releases(project_id: int) -> BoostedReleases:
    """
    Function that returns the releases that should be boosted for a given project, and excludes expired releases.
    """
    cache_key = generate_cache_key_for_boosted_releases_hash(project_id)
    current_timestamp = datetime.utcnow().replace(tzinfo=UTC).timestamp()

    redis_client = get_redis_client_for_ds()
    old_boosted_releases = redis_client.hgetall(cache_key)

    boosted_releases = BoostedReleases()
    expired_releases = []
    for boosted_release_cache_key, timestamp in old_boosted_releases.items():
        timestamp = float(timestamp)

        if current_timestamp <= timestamp + BOOSTED_RELEASE_TIMEOUT:
            # If we are unable to parse the cache key we will silently skip the boosted release.
            if (
                extracted_data := _extract_release_and_environment_from_cache_key(
                    boosted_release_cache_key
                )
            ) is not None:
                release_id, environment = extracted_data
                boosted_releases.add_release(release_id, timestamp, environment)

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


def get_augmented_boosted_releases(project_id: int, limit: int) -> List[ExtendedBoostedRelease]:
    """
    Returns a list of boosted releases augmented with additional information such as release version and platform.
    """
    return get_boosted_releases(project_id).to_extended_boosted_releases(project_id, limit)
