import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional, Tuple

from django.conf import settings
from pytz import UTC

from sentry.dynamic_sampling.latest_release_ttas import Platform
from sentry.models import Project, Release
from sentry.search.utils import get_latest_release
from sentry.utils import redis

ENVIRONMENT_SEPARATOR = ":e:"
BOOSTED_RELEASE_CACHE_KEY_REGEX = re.compile(
    r"^ds::r:(?P<release_id>\d+)(:e:(?P<environment>.+))?$"
)


def get_redis_client_for_ds() -> Any:
    cluster_key = getattr(settings, "SENTRY_DYNAMIC_SAMPLING_RULES_REDIS_CLUSTER", "default")
    return redis.redis_clusters.get(cluster_key)


def _get_environment_cache_key(environment: Optional[str]) -> str:
    return f"{ENVIRONMENT_SEPARATOR}{environment}" if environment else ""


@dataclass(frozen=True)
class BoostedRelease:
    """
    Class that represents a boosted release fetched from Redis.
    """

    id: int
    timestamp: float
    environment: Optional[str]
    # We also store the cache key corresponding to this boosted release entry, in order to remove it efficiently.
    cache_key: str

    def extend(self, release: Release, project_id: int) -> "ExtendedBoostedRelease":
        return ExtendedBoostedRelease(
            id=self.id,
            timestamp=self.timestamp,
            environment=self.environment,
            cache_key=self.cache_key,
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
    """
    Class the represents a boosted release with added information that are injected after the base release is
    fetched from the cache.
    """

    version: str
    platform: Platform

    def is_active(self, current_timestamp: int) -> bool:
        return current_timestamp <= (self.timestamp + self.platform.time_to_adoption)


@dataclass
class BoostedReleases:
    """
    Class that hides the complexity of extending boosted releases.
    """

    boosted_releases: List[BoostedRelease] = field(default_factory=list)

    def add_release(
        self, cache_key: str, id: int, timestamp: float, environment: Optional[str]
    ) -> None:
        self.boosted_releases.append(
            BoostedRelease(cache_key=cache_key, id=id, timestamp=timestamp, environment=environment)
        )

    def to_extended_boosted_releases(
        self, project_id: int
    ) -> Tuple[List[ExtendedBoostedRelease], List[str]]:
        # We get release models in order to have all the information to extend the releases we get from the cache.
        models = self._get_releases_models()

        current_timestamp = datetime.utcnow().replace(tzinfo=UTC).timestamp()

        extended_boosted_releases = []
        expired_boosted_releases = []
        for boosted_release in self.boosted_releases:
            extended_boosted_release = boosted_release.extend(
                release=models[boosted_release.id], project_id=project_id
            )

            if extended_boosted_release.is_active(current_timestamp):
                extended_boosted_releases.append(extended_boosted_release)
            else:
                expired_boosted_releases.append(boosted_release.cache_key)

        return extended_boosted_releases, expired_boosted_releases

    def _get_last_release_ids(self) -> List[int]:
        return [boosted_release.id for boosted_release in self.boosted_releases]

    def _get_releases_models(self) -> Dict[int, Release]:
        return {
            release.id: release
            for release in Release.objects.filter(id__in=self._get_last_release_ids())
        }


class ProjectBoostedReleases:
    """
    Class responsible of hiding the complexity of handling boosted releases in the Redis hash. In addition, it provides
    all the logic to handle an upper bound in the number of boosted releases that can be simultaneously be added to
    a specific project.
    """

    # Limit of boosted releases per project.
    BOOSTED_RELEASES_LIMIT = 10
    BOOSTED_RELEASES_HASH_EXPIRATION = 60 * 60 * 1000

    def __init__(self, project_id: int):
        self.redis_client = get_redis_client_for_ds()
        self.project_id = project_id

    def add_boosted_release(self, release_id: int, environment: Optional[str]):
        """
        Adds a release to the boosted releases hash with the boosting timestamp set to the current time, signaling that
        the boosts starts now.
        """
        # If we have reached the maximum number of boosted release, we are going to pop the least recently boosted
        # release.
        if self._is_limit_reached():
            self._remove_least_recently_boosted_release()

        cache_key = self._generate_cache_key_for_boosted_releases_hash()
        self.redis_client.hset(
            cache_key,
            self._generate_cache_key_for_boosted_release(release_id, environment),
            datetime.utcnow().replace(tzinfo=UTC).timestamp(),
        )
        # In order to avoid having the boosted releases hash in memory for an indefinite amount of time, we will expire
        # it after a specific timeout.
        self.redis_client.pexpire(cache_key, self.BOOSTED_RELEASES_HASH_EXPIRATION)

    def get_extended_boosted_releases(self) -> List[ExtendedBoostedRelease]:
        """
        Returns a list of boosted releases augmented with additional information such as release version and platform.
        In addition, this function performs the cleanup of expired boosted releases.
        """
        # We read all boosted releases and we augment them in two separate loops in order to perform a single query
        # to fetch all the release models. This optimization avoids peforming a query for each release.
        active, expired = self._get_boosted_releases().to_extended_boosted_releases(self.project_id)
        # We delete all the expired releases.
        if expired:
            self.redis_client.hdel(self._generate_cache_key_for_boosted_releases_hash(), *expired)

        # We return the active extended boosted releases.
        return active

    def _get_boosted_releases(self) -> BoostedReleases:
        """
        Returns all the boosted releases and parses them based on key and value data.

        This method should not be called directly as the boosted releases are not extended, thus they contain only a
        subset of information.
        """
        boosted_releases = BoostedReleases()
        for boosted_release_cache_key, timestamp in self.redis_client.hgetall(
            self._generate_cache_key_for_boosted_releases_hash()
        ).items():
            extracted_data = self._extract_data_from_cache_key(boosted_release_cache_key)
            if extracted_data:
                release_id, environment = extracted_data
                boosted_releases.add_release(
                    cache_key=boosted_release_cache_key,
                    id=release_id,
                    timestamp=float(timestamp),
                    environment=environment,
                )

        return boosted_releases

    def _remove_least_recently_boosted_release(self):
        """
        Removes the least recently boosted release by considering the timestamp of creation.
        If multiple boosted releases have the same timestamp, the first one in order will be removed.

        This removal strategy works under the heuristic that whenever we have reached the maximum number of boosted
        transactions it makes more sense to replace the oldest boost because it was the one that already worked for
        more time. Of course, this logic doesn't work well in case boosts all happened close to each other but in that
        case no more optimal removal strategy is possible.
        """
        cache_key = self._generate_cache_key_for_boosted_releases_hash()
        boosted_releases = self.redis_client.hgetall(cache_key)

        lru_boosted_release = None
        for boosted_release, timestamp in boosted_releases.items():
            timestamp = float(timestamp)
            # With this logic we want to find the boosted release with the lowest timestamp, if multiple releases
            # have the same timestamp we are going to take the first one in the hash.
            if lru_boosted_release is None or (
                lru_boosted_release and lru_boosted_release[1] < timestamp
            ):
                lru_boosted_release = (boosted_release, timestamp)

        if lru_boosted_release:
            self.redis_client.hdel(cache_key, lru_boosted_release[0])

    def _is_limit_reached(self):
        return (
            self.redis_client.hlen(self._generate_cache_key_for_boosted_releases_hash())
            >= self.BOOSTED_RELEASES_LIMIT
        )

    def _generate_cache_key_for_boosted_releases_hash(self) -> str:
        return f"ds::p:{self.project_id}:boosted_releases"

    @staticmethod
    def _generate_cache_key_for_boosted_release(release_id: int, environment: Optional[str]) -> str:
        return f"ds::r:{release_id}{_get_environment_cache_key(environment)}"

    @staticmethod
    def _extract_data_from_cache_key(
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


@dataclass(frozen=True)
class LatestReleaseParams:
    project: Project
    release: Release
    environment: Optional[str]


class LatestReleaseBias:
    """
    Class responsible of tracking all the (release, environment) pairs that have been observed in order to compute
    whether a certain release should be boosted.
    """

    ONE_DAY_TIMEOUT_MS = 60 * 60 * 24 * 1000

    def __init__(self, latest_release_params: LatestReleaseParams):
        self.redis_client = get_redis_client_for_ds()
        self.latest_release_params = latest_release_params

    def observe_release(self) -> "LatestReleaseBooster":
        # Here we want to evaluate the observed first, so that if it is false, we don't bother verifying whether it
        # is a latest release.
        boost = not self._is_already_observed() and self._is_latest_release()

        return LatestReleaseBooster(
            boost_latest_release=boost, latest_release_params=self.latest_release_params
        )

    def _is_already_observed(self) -> bool:
        cache_key = self._generate_cache_key_for_observed_release()

        release_observed = self.redis_client.getset(name=cache_key, value=1)
        self.redis_client.pexpire(cache_key, self.ONE_DAY_TIMEOUT_MS)

        return release_observed == "1"

    def _is_latest_release(self) -> bool:
        # This function orders releases by date_released if present, otherwise date_added. Thus, those fields are
        # what defines the total order relation between all releases.
        latest_release = get_latest_release(
            projects=[self.latest_release_params.project.id],
            environments=None,
            organization_id=self.latest_release_params.project.organization.id,
        )

        if len(latest_release) == 1:
            latest_release = latest_release[0]
            return latest_release == self.latest_release_params.release.version

        return False

    def _generate_cache_key_for_observed_release(self) -> str:
        return (
            f"ds::p:{self.latest_release_params.project.id}"
            f":r:{self.latest_release_params.release.id}"
            f"{_get_environment_cache_key(self.latest_release_params.environment)}"
        )


class LatestReleaseBooster:
    """
    Class responsible of boosting a certain (release, environment) pair.
    """

    def __init__(self, boost_latest_release: bool, latest_release_params: LatestReleaseParams):
        self.boost_latest_release = boost_latest_release
        self.latest_release_params = latest_release_params
        self.project_boosted_releases = ProjectBoostedReleases(
            self.latest_release_params.project.id
        )

    def boost_if_not_observed(self, on_boosted_release_added: Callable[[], None]) -> None:
        if self.boost_latest_release:
            # We don't perform any expiration cleanup when adding a new boosted release because we know that we
            # have an upper bound in the number of elements in the hash, therefore it won't grow unbounded.
            #
            # Whenever the data is actually read by any consumer we are going to cleanup the releases.
            self.project_boosted_releases.add_boosted_release(
                self.latest_release_params.release.id, self.latest_release_params.environment
            )
            # We notify the user of this function when the boosted release has been added so that any side effects
            # can be triggered on call-site.
            on_boosted_release_added()
