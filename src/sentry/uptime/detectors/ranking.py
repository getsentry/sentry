from __future__ import annotations

import random
from datetime import timedelta
from typing import TYPE_CHECKING

from django.conf import settings
from redis.client import StrictRedis
from rediscluster import RedisCluster

from sentry.utils import redis

if TYPE_CHECKING:
    from sentry.models.project import Project


# How often should each project be flushed?
PROJECT_FLUSH_FREQUENCY = timedelta(days=1)
# How often do we want to run our task to flush the buckets?
# XXX: This might actually belong in the task when we have that?
BUCKET_FLUSH_FREQUENCY = timedelta(minutes=1)
# How often should we trim the ranked list?
RANKED_TRIM_CHANCE = 0.01
# How many urls should we trim the ranked list to?
RANKED_MAX_SIZE = 20
# Expiry we should set on all keys. Set the expiry to twice the flush frequency
# so that we definitely have time to process.
KEY_EXPIRY = PROJECT_FLUSH_FREQUENCY * 2


def _get_cluster() -> RedisCluster | StrictRedis:
    return redis.redis_clusters.get(settings.SENTRY_UPTIME_DETECTOR_CLUSTER)


def add_base_url_to_rank(project: Project, base_url: str):
    """
    Takes a project and valid base url and stores ranking information about it in Redis.

    We use two keys here: A hash set that stores a list of projects and the total number
    of events with valid hostnames that they've seen, and a zset of hostnames seen in the
    project ranked by the number of times they've been seen.

    We partition the project into buckets determined by `PROJECT_FLUSH_FREQUENCY` and
    `BUCKET_FLUSH_FREQUENCY`. So if the flush frequency is one day, and bucket flush frequency
    is 1 minute, then we'll have 1440 buckets. This allows us to spread the load of
    these checks throughout the day instead of processing them all at the same time.

    We also randomly trim the zset based on `RANKED_TRIM_CHANCE`. This means it can grow
    larger than `RANKED_MAX_SIZE`. That shouldn't cause us problems, and is preferable to
    trimming it on every call.
    """
    cluster = _get_cluster()
    bucket_key = get_project_bucket_key(project)
    pipeline = cluster.pipeline()
    pipeline.hincrby(bucket_key, str(project.id), 1)
    rank_key = get_project_hostname_rank_key(project)
    pipeline.zincrby(rank_key, 1, base_url)
    if random.random() < RANKED_TRIM_CHANCE:
        pipeline.zremrangebyrank(rank_key, 0, -(RANKED_MAX_SIZE + 1))
    project_incr_result = pipeline.execute()[0]
    if project_incr_result == 1:
        # We don't want to constantly set expire on these rows to avoid load on redis.
        # Instead we just set it when we increment the project for the first time, so
        # that we know it's when we create the zset.
        pipeline.expire(rank_key, KEY_EXPIRY)
        # We don't know if this has been expired yet, but doing it once per project
        # shouldn't be too heavy
        pipeline.expire(bucket_key, KEY_EXPIRY)
        pipeline.execute()


def get_project_bucket_key(project: Project) -> str:
    project_bucket = project.id % (PROJECT_FLUSH_FREQUENCY / BUCKET_FLUSH_FREQUENCY)
    return f"p:{project_bucket}"


def get_project_hostname_rank_key(project: Project) -> str:
    return f"p:r:{project.id}"
