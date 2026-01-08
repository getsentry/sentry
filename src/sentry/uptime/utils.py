from django.conf import settings
from redis.client import StrictRedis
from rediscluster import RedisCluster

from sentry.utils import redis
from sentry.workflow_engine.models.detector import Detector


def build_last_update_key(detector: Detector) -> str:
    return f"project-sub-last-update:detector:{detector.id}"


def build_last_seen_interval_key(detector: Detector) -> str:
    return f"project-sub-last-seen-interval:detector:{detector.id}"


def build_detector_fingerprint_component(detector: Detector) -> str:
    return f"uptime-detector:{detector.id}"


def build_fingerprint(detector: Detector) -> list[str]:
    return [build_detector_fingerprint_component(detector)]


def build_backlog_key(subscription_id: str) -> str:
    """Redis sorted set key for buffered out-of-order results."""
    return f"uptime:backlog:{subscription_id}"


def build_backlog_task_scheduled_key(subscription_id: str) -> str:
    """Redis flag key tracking if retry task is scheduled."""
    return f"uptime:backlog_task_scheduled:{subscription_id}"


def build_backlog_schedule_lock_key(subscription_id: str) -> str:
    """Redis lock key for coordinating backlog task scheduling."""
    return f"uptime:backlog_schedule_lock:{subscription_id}"


def get_cluster() -> RedisCluster | StrictRedis:
    return redis.redis_clusters.get(settings.SENTRY_UPTIME_DETECTOR_CLUSTER)
