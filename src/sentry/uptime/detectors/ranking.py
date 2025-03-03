from __future__ import annotations

import random
from datetime import datetime, timedelta
from typing import TYPE_CHECKING

from django.conf import settings
from redis.client import StrictRedis
from rediscluster import RedisCluster

from sentry.constants import UPTIME_AUTODETECTION
from sentry.uptime.models import get_active_auto_monitor_count_for_org
from sentry.uptime.subscriptions.subscriptions import (
    MAX_AUTO_SUBSCRIPTIONS_PER_ORG,
    MaxUrlsForDomainReachedException,
    check_url_limits,
)
from sentry.utils import metrics, redis

if TYPE_CHECKING:
    from sentry.models.organization import Organization
    from sentry.models.project import Project


# How often should each organization be flushed?
ORGANIZATION_FLUSH_FREQUENCY = timedelta(days=1)
# How often do we want to run our task to flush the buckets?
# XXX: This might actually belong in the task when we have that?
BUCKET_FLUSH_FREQUENCY = timedelta(minutes=1)
NUMBER_OF_BUCKETS = int(ORGANIZATION_FLUSH_FREQUENCY / BUCKET_FLUSH_FREQUENCY)
# How often should we trim the ranked list?
RANKED_TRIM_CHANCE = 0.01
# How many urls should we trim the ranked list to?
RANKED_MAX_SIZE = 20
# Expiry we should set on all keys. Set the expiry to twice the flush frequency
# so that we definitely have time to process.
KEY_EXPIRY = ORGANIZATION_FLUSH_FREQUENCY * 2


def _get_cluster() -> RedisCluster | StrictRedis:
    return redis.redis_clusters.get(settings.SENTRY_UPTIME_DETECTOR_CLUSTER)


def add_base_url_to_rank(project: Project, base_url: str):
    """
    Takes a project and valid base url and stores ranking information about it in Redis.

    We use three keys here: A set that stores the list of organizations that have seen urls,
    a sorted set that stores a list of projects ranked by the total number of events with valid hostnames
    that they've seen, and a sorted set of hostnames seen in the project ranked by the number of times
    they've been seen.

    We partition the organizations into buckets determined by `ORGANIZATION_FLUSH_FREQUENCY` and
    `BUCKET_FLUSH_FREQUENCY`. So if the flush frequency is one day, and bucket flush frequency
    is 1 minute, then we'll have 1440 buckets. This allows us to spread the load of
    these checks throughout the day instead of processing them all at the same time.

    We also randomly trim the zset based on `RANKED_TRIM_CHANCE`. This means it can grow
    larger than `RANKED_MAX_SIZE`. That shouldn't cause us problems, and is preferable to
    trimming it on every call.
    """
    cluster = _get_cluster()
    org_projects_key = build_org_projects_key(project.organization)
    pipeline = cluster.pipeline()
    pipeline.zincrby(org_projects_key, 1, str(project.id))
    rank_key = get_project_base_url_rank_key(project)
    pipeline.zincrby(rank_key, 1, base_url)
    if random.random() < RANKED_TRIM_CHANCE:
        pipeline.zremrangebyrank(rank_key, 0, -(RANKED_MAX_SIZE + 1))
    project_incr_result = pipeline.execute()[0]
    if project_incr_result == 1:
        metrics.incr("uptime.detectors.added_project")
        pipeline = cluster.pipeline()
        # Avoid adding the org to this set constantly, and instead just do it once per project
        bucket_key = get_organization_bucket_key(project.organization)
        pipeline.sadd(bucket_key, str(project.organization_id))
        pipeline.expire(bucket_key, KEY_EXPIRY)
        # We don't want to constantly set expire on these rows to avoid load on redis.
        # Instead, we just set it when we increment the project for the first time, so
        # that we know it's when we create the zset.
        pipeline.expire(rank_key, KEY_EXPIRY)
        # We don't know if this key has been expired yet, but expiring it once per project
        # shouldn't be too heavy
        pipeline.expire(org_projects_key, KEY_EXPIRY)
        pipeline.execute()


def get_candidate_projects_for_org(org: Organization) -> list[tuple[int, int]]:
    """
    Gets all projects related to the organization that have seen urls. Returns a tuple of (project_id, total_urls_seen).
    Project ids are sorted by `total_urls_seen` desc.
    """
    key = build_org_projects_key(org)
    cluster = _get_cluster()
    return [
        (int(project_id), count)
        for project_id, count in cluster.zrange(
            key, 0, -1, desc=True, withscores=True, score_cast_func=int
        )
    ]


def delete_candidate_projects_for_org(org: Organization) -> None:
    """
    Deletes candidate projects related to the organization that have seen urls.
    """
    key = build_org_projects_key(org)
    cluster = _get_cluster()
    cluster.delete(key)


def get_candidate_urls_for_project(project: Project, limit=5) -> list[tuple[str, int]]:
    """
    Gets all the candidate urls for a project. Returns a tuple of (url, times_url_seen). Urls are sorted by
    `times_url_seen` desc.
    """
    key = get_project_base_url_rank_key(project)
    cluster = _get_cluster()
    candidate_urls = cluster.zrange(key, 0, -1, desc=True, withscores=True, score_cast_func=int)
    urls = []
    for candidate_url, url_count in candidate_urls:
        try:
            check_url_limits(candidate_url)
            urls.append((candidate_url, url_count))
        except MaxUrlsForDomainReachedException:
            pass
        if len(urls) == limit:
            break
    return urls


def delete_candidate_urls_for_project(project: Project) -> None:
    """
    Deletes all current candidate rules for a project.
    """
    key = get_project_base_url_rank_key(project)
    cluster = _get_cluster()
    cluster.delete(key)


def get_project_base_url_rank_key(project: Project) -> str:
    return f"p:r:{project.id}"


def build_organization_bucket_key(bucket: int):
    return f"o:{bucket}"


def get_organization_bucket_key(organization: Organization) -> str:
    org_bucket = int(organization.id % NUMBER_OF_BUCKETS)
    return build_organization_bucket_key(org_bucket)


def get_organization_bucket_key_for_datetime(bucket_datetime: datetime) -> str:
    date_bucket = int((bucket_datetime.timestamp() // 60) % NUMBER_OF_BUCKETS)
    return build_organization_bucket_key(date_bucket)


def build_org_projects_key(organization: Organization) -> str:
    return f"o-p:{organization.id}"


def get_organization_bucket(bucket: datetime) -> set[int]:
    """
    Fetch all organizations from a specific datetime bucket. Returns a set of organization ids
    that have projects that have seen urls.
    """
    key = get_organization_bucket_key_for_datetime(bucket)
    cluster = _get_cluster()
    return {int(organization_id) for organization_id in cluster.smembers(key)}


def delete_organization_bucket(bucket: datetime) -> None:
    """
    Delete all organizations from a specific datetime bucket.
    """
    key = get_organization_bucket_key_for_datetime(bucket)
    cluster = _get_cluster()
    cluster.delete(key)


def should_detect_for_organization(organization: Organization) -> bool:
    if not organization.get_option("sentry:uptime_autodetection", UPTIME_AUTODETECTION):
        return False

    if get_active_auto_monitor_count_for_org(organization) >= MAX_AUTO_SUBSCRIPTIONS_PER_ORG:
        return False
    return True


def should_detect_for_project(project: Project) -> bool:
    return project.get_option("sentry:uptime_autodetection", True)
