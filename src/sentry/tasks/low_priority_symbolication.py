"""
Tasks that automate the job of moving projects in and out of symbolicator's low priority queue based
on symbolication metrics stored in Redis.

This has three major tasks, executed in the following general order:
1. Scan for new suspect projects in Redis that need to be checked for LPQ eligibility. Triggers 2 and 3.
2. Determine a project's eligibility for the LPQ based on their recorded metrics.
3. Remove some specified project from the LPQ.
"""

import logging
from typing import Iterable

from sentry.tasks.base import instrumented_task
from sentry.utils import redis

logger = logging.getLogger(__name__)

# redis key for entry storing current list of LPQ members
LPQ_MEMBERS_KEY = "fill with appropriate value here"
# key for cluster that stores list of current LPQ members. may be equivalent to CLUSTER_KEY.
LPQ_CONFIG_CLUSTER_KEY = "fill with appropriate value here"

# key for cluster used to store metrics for LPQ
CLUSTER_KEY = "fill with appropriate value here"


@instrumented_task(name="sentry.tasks.symbolicator.scan_for_suspect_projects", queue="symbolicator.compute_low_priority_queue", ignore_result=True)  # type: ignore
def scan_for_suspect_projects() -> None:
    _scan_for_suspect_projects()


def _scan_for_suspect_projects() -> None:
    # todo: this is probably going to be some class wrapper around the cluster to abstract away most
    # of the nitty-gritty redis work
    cluster: redis._RedisCluster = redis.get_cluster_from_options(CLUSTER_KEY)

    suspect_projects = set([])
    for item in cluster.scan_iter(
        # assuming the format is "symbolicate_event_lpq:<project_id>:<posix timestamp or other>"
        match="symbolicate_event_lpq:*",
        count=1000,
    ):
        [_key, project_id, _else] = item.split(":")
        if project_id not in suspect_projects:
            suspect_projects.add(project_id)
            calculate_lpq_eligibility(project_id)

    # todo: populate with contents of redis-stored kill switch
    current_lpq_projects = set([])
    deleted_projects = current_lpq_projects.difference(suspect_projects)

    for deleted in deleted_projects:
        # todo: may be good to make this a batch delete
        remove_from_lpq(deleted)


@instrumented_task(name="sentry.tasks.symbolicator.calculate_lpq_eligibility", queue="symbolicator.compute_low_priority_queue", ignore_result=True)  # type: ignore
def calculate_lpq_eligibility(project_id: str) -> None:
    _calculate_lpq_eligibility(project_id)


def _calculate_lpq_eligibility(project_id: str) -> None:
    # todo: this is probably going to be some class wrapper around the cluster to abstract away most
    # of the nitty-gritty redis work
    cluster: redis._RedisCluster = redis.get_cluster_from_options(CLUSTER_KEY)
    pattern = (f"symbolicate_event_lpq:{project_id}:*",)

    def extract_timestamp(key: str) -> str:
        [_key, _project_id, timestamp] = key.split(":")
        return timestamp

    is_eligible = calculation_magic(
        [extract_timestamp(key) for key in cluster.scan_iter(match=pattern, count=1000)]
    )

    if not is_eligible:
        return

    # todo: this is probably going to be some class wrapper around the cluster to abstract away most
    # of the nitty-gritty redis work
    cluster: redis._RedisCluster = redis.get_cluster_from_options(LPQ_CONFIG_CLUSTER_KEY)
    added = cluster.sadd(name=LPQ_MEMBERS_KEY, values=[project_id])

    if added:
        # cry at sentry
        return
    else:
        # wail at sentry
        return


def calculation_magic(timestamps: Iterable[str]) -> bool:
    return False


@instrumented_task(name="sentry.tasks.symbolicator.remove_from_lpq", queue="symbolicator.compute_low_priority_queue", ignore_result=True)  # type: ignore
def remove_from_lpq(project_id: str) -> None:
    _remove_from_lpq(project_id)


def _remove_from_lpq(project_id: str) -> None:
    # todo: this is probably going to be some class wrapper around the cluster to abstract away most
    # of the nitty-gritty redis work
    cluster: redis._RedisCluster = redis.get_cluster_from_options(LPQ_CONFIG_CLUSTER_KEY)
    removed = cluster.srem(name=LPQ_MEMBERS_KEY, values=[project_id])
    if removed > 0:
        # emit some metrics
        return
