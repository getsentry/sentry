from django.conf import settings
from redis.client import StrictRedis
from rediscluster import RedisCluster

from sentry.utils import redis
from sentry.workflow_engine.models.detector import Detector


def build_last_update_key(detector: Detector) -> str:
    return f"project-sub-last-update:detector:{detector.id}"


def build_last_interval_change_timestamp_key(detector: Detector) -> str:
    return f"project-sub-last-interval-change-timestamp:detector:{detector.id}"


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


def generate_scheduled_check_times_ms(
    base_time_ms: int,
    interval_ms: int,
    count: int,
    forward: bool = True,
) -> list[int]:
    """
    Generate a sequence of scheduled check times.

    Args:
        base_time_ms: The reference scheduled check time in milliseconds
        interval_ms: The interval between checks in milliseconds
        count: Number of times to generate
        forward: If True, generate times forward from base (inclusive).
                 If False, generate times backward ending at base (inclusive).

    Returns:
        List of scheduled check times in milliseconds, in ascending order.

    """
    start = 0 if forward else -(count - 1)
    end = count if forward else 1
    return [base_time_ms + (i * interval_ms) for i in range(start, end)]
