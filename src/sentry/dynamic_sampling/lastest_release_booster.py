from datetime import datetime

from django.core.cache import cache
from pytz import UTC

from sentry.utils import json

BOOSTED_RELEASE_TIMEOUT = 60 * 60
ONE_DAY_TIMEOUT = 60 * 60 * 24


def generate_dynamic_sampling_lock_key(project_id):
    return f"dynamic-sampling-boost-lock:{project_id}"


def generate_cache_key_for_observed_release(project_id, release_id):
    """
    Generates a cache key for releases that had a transaction observed in the last 24 hours
    """
    return f"ds::p:{project_id}:r:{release_id}:24h"


def generate_cache_key_for_boosted_release(project_id):
    """
    Generates a cache key for the boosted releases for a given project.
    """
    return f"ds::p:{project_id}:boosted_releases:1h"


def get_boosted_releases(project_id):
    """
    Function that returns the releases that should be boosted for a given project, and excludes expired releases.
    """
    boosted_releases = json.loads(
        cache.get(generate_cache_key_for_boosted_release(project_id)) or "[]"
    )
    current_timestamp = datetime.utcnow().replace(tzinfo=UTC).timestamp()
    return [
        [release_id, timestamp]
        for release_id, timestamp in boosted_releases
        if current_timestamp <= timestamp + BOOSTED_RELEASE_TIMEOUT
    ]


def add_boosted_release(project_id, release_id):
    """
    Function that adds a release to the list of active boosted releases for a given project.
    """
    boosted_releases = get_boosted_releases(project_id)
    boosted_releases.append([release_id, datetime.utcnow().replace(tzinfo=UTC).timestamp()])
    cache.set(
        generate_cache_key_for_boosted_release(project_id),
        json.dumps(boosted_releases),
        BOOSTED_RELEASE_TIMEOUT,
    )
