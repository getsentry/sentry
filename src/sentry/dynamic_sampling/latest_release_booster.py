import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional, Tuple

from django.conf import settings
from pytz import UTC

from sentry.dynamic_sampling.latest_release_ttas import Platform
from sentry.models import Project, Release
from sentry.utils import redis

BOOSTED_RELEASE_TIMEOUT = 60 * 60
ONE_DAY_TIMEOUT_MS = 60 * 60 * 24 * 1000

ENVIRONMENT_SEPARATOR = ":e:"
EXPIRATION_TIMESTAMP_SEPARATOR = ":t:"

BOOSTED_RELEASE_CACHE_KEY_REGEX = re.compile(
    r"^ds::r:(?P<release_id>\d+)(:e:(?P<environment>.+))?$"
)
OBSERVED_RELEASE_REGEX = re.compile(
    r"^ds::r:(?P<release_id>\d+)(:t:(?P<expiration_timestamp>\d+))(:e:(?P<environment>.+))?$"
)


class TooManyBoostedReleasesException(Exception):
    pass


def get_redis_client_for_ds() -> Any:
    cluster_key = getattr(settings, "SENTRY_DYNAMIC_SAMPLING_RULES_REDIS_CLUSTER", "default")
    return redis.redis_clusters.get(cluster_key)


def _generate_cache_key_for_boosted_releases_hash(project_id: int) -> str:
    return f"ds::p:{project_id}:boosted_releases"


def _get_environment_cache_key(environment: Optional[str]) -> str:
    return f"{ENVIRONMENT_SEPARATOR}{environment}" if environment else ""


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


@dataclass(frozen=True)
class LatestReleaseParams:
    project_id: int
    release_id: int
    environment: Optional[str]


class LatestReleaseObserver:
    def __init__(self, latest_release_params: LatestReleaseParams):
        self.redis_client = get_redis_client_for_ds()
        self.latest_release_params = latest_release_params

    def observe_release(self) -> "LatestReleaseBooster":
        if self._is_already_observed():
            return LatestReleaseBooster(
                boost_latest_release=False, params=self.latest_release_params
            )

        return LatestReleaseBooster(boost_latest_release=True, params=self.latest_release_params)

    def _is_already_observed(self) -> bool:
        cache_key = self._generate_cache_key_for_observed_release()
        release_observed = self.redis_client.getset(name=cache_key, value=1)
        self.redis_client.pexpire(cache_key, ONE_DAY_TIMEOUT_MS)

        return release_observed == "1"

    def _generate_cache_key_for_observed_release(self) -> str:
        return (
            f"ds::p:{self.latest_release_params.project_id}"
            f":r:{self.latest_release_params.release_id}"
            f"{_get_environment_cache_key(self.latest_release_params.environment)}"
        )


class LatestReleaseBooster:
    def __init__(self, boost_latest_release: bool, params: LatestReleaseParams):
        self.redis_client = get_redis_client_for_ds()
        self.boost_latest_release = boost_latest_release
        self.params = params

    def boost_if_not_observed(self, on_boosted_release_added: Callable[[], None]) -> None:
        if self.boost_latest_release:
            self._add_boosted_release()
            on_boosted_release_added()

    def _add_boosted_release(self) -> None:
        # TODO: for now we mimic the old implementation but we would like to more explicitly only remove expired
        #  boosted releases here.
        BoostedReleasesRepository().get_boosted_releases(self.params.project_id)

        cache_key = _generate_cache_key_for_boosted_releases_hash(project_id=self.params.project_id)
        self.redis_client.hset(
            cache_key,
            self._generate_cache_key_for_boosted_release_with_environment(),
            datetime.utcnow().replace(tzinfo=UTC).timestamp(),
        )
        self.redis_client.pexpire(cache_key, BOOSTED_RELEASE_TIMEOUT * 1000)

    def _generate_cache_key_for_boosted_release_with_environment(self) -> str:
        return (
            f"ds::r:{self.params.release_id}{_get_environment_cache_key(self.params.environment)}"
        )


class BoostedReleasesRepository:
    def get_boosted_releases(self, project_id: int) -> BoostedReleases:
        """
        Function that returns the releases that should be boosted for a given project, and excludes expired releases.
        """
        cache_key = _generate_cache_key_for_boosted_releases_hash(project_id=project_id)
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
                    extracted_data := self._extract_release_and_environment_from_cache_key(
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

    def get_augmented_boosted_releases(
        self, project_id: int, limit: int
    ) -> List[ExtendedBoostedRelease]:
        """
        Returns a list of boosted releases augmented with additional information such as release version and platform.
        """
        return self.get_boosted_releases(project_id).to_extended_boosted_releases(project_id, limit)

    @staticmethod
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

            return int(release_id), environment

        # If the cache key doesn't match the new format, we will fallback to the old format which is just an integer.
        try:
            release_id = int(cache_key)
        except ValueError:
            # If the format is not an integer we will silently return None.
            return None
        else:
            return release_id, None
