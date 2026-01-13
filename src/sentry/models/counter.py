import logging
import time

import psycopg2.errors
import sentry_sdk
from django.conf import settings
from django.db import connections, transaction
from django.db.utils import OperationalError

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedBigIntegerField,
    FlexibleForeignKey,
    Model,
    region_silo_model,
    sane_repr,
)
from sentry.locks import locks
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import ingest_errors_tasks
from sentry.utils import metrics
from sentry.utils.locking import UnableToAcquireLock
from sentry.utils.redis import redis_clusters

logger = logging.getLogger(__name__)

LOW_WATER_RATIO = 0.2
"""
If the number of short ids in Redis is less than this ratio, we will refill the block.

So if block size is 1000 and low water ratio is 0.2,
we will refill the block when there are less than 200 short ids in Redis
"""


@region_silo_model
class Counter(Model):
    __relocation_scope__ = RelocationScope.Organization

    project = FlexibleForeignKey("sentry.Project", unique=True)
    value = BoundedBigIntegerField()

    __repr__ = sane_repr("project")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_projectcounter"

    @classmethod
    def increment(cls, project, delta=1) -> int:
        """Increments a counter.  This can never decrement."""
        if delta == 1:
            # only use the cache path if delta is 1, as in other cases we're trying to resolve
            # a stuck counter
            return increment_project_counter_in_cache(project)
        else:
            return increment_project_counter_in_database(project, delta)


@sentry_sdk.tracing.trace
@metrics.wraps("counter.increment_project_counter_in_cache")
def increment_project_counter_in_cache(project, using="default") -> int:
    redis_key = make_short_id_counter_key(project.id)
    redis = redis_clusters.get("default")

    with redis.pipeline() as pipe:
        pipe.lpop(redis_key)
        pipe.llen(redis_key)
        short_id_from_redis, remaining = pipe.execute()
        short_id_from_redis = int(short_id_from_redis) if short_id_from_redis is not None else None

    if short_id_from_redis is None:  # fallback if not populated in Redis
        metrics.incr("counter.increment_project_counter_in_cache.fallback")
        short_id_from_db = increment_project_counter_in_database(project, using=using)
        refill_cached_short_ids.delay(
            project.id, block_size=calculate_cached_id_block_size(short_id_from_db), using=using
        )
        return short_id_from_db
    else:
        cached_id_block_size = calculate_cached_id_block_size(short_id_from_redis)
        metrics.incr("counter.increment_project_counter_in_cache.found_in_redis")
        if remaining < cached_id_block_size * LOW_WATER_RATIO:
            metrics.incr("counter.increment_project_counter_in_cache.refill")
            refill_cached_short_ids.delay(
                project.id,
                block_size=calculate_cached_id_block_size(short_id_from_redis),
                using=using,
            )

        return short_id_from_redis


def _is_statement_timeout_error(error: Exception) -> bool:
    """Check if the error is a statement timeout error."""
    if isinstance(error, OperationalError):
        error_msg = str(error)
        return "canceling statement due to statement timeout" in error_msg
    return False


@sentry_sdk.tracing.trace
@metrics.wraps("counter.increment_project_counter_in_database")
def increment_project_counter_in_database(project, delta=1, using="default") -> int:
    """
    Increments the project counter in the database with retry logic for statement timeouts.
    
    This method primarily exists so that south code can use it.
    """
    if delta <= 0:
        raise ValueError("There is only one way, and that's up.")

    max_retries = 3
    base_sleep_ms = 50  # Start with 50ms
    
    for attempt in range(max_retries):
        try:
            # To prevent the statement_timeout leaking into the session we need to use
            # set local which can be used only within a transaction
            with transaction.atomic(using=using):
                with connections[using].cursor() as cur:
                    statement_timeout = None
                    if settings.SENTRY_PROJECT_COUNTER_STATEMENT_TIMEOUT:
                        # WARNING: This is not a proper fix and should be removed once
                        #          we have better way of generating next_short_id.
                        cur.execute("show statement_timeout")
                        statement_timeout = cur.fetchone()[0]
                        cur.execute(
                            "set local statement_timeout = %s",
                            [settings.SENTRY_PROJECT_COUNTER_STATEMENT_TIMEOUT],
                        )

                    # Our postgres wrapper thing does not allow for named arguments
                    cur.execute(
                        "insert into sentry_projectcounter (project_id, value) "
                        "values (%s, %s) "
                        "on conflict (project_id) do update "
                        "set value = sentry_projectcounter.value + %s "
                        "returning value",
                        [project.id, delta, delta],
                    )

                    project_counter = cur.fetchone()[0]

                    if statement_timeout is not None:
                        cur.execute(
                            "set local statement_timeout = %s",
                            [statement_timeout],
                        )

                    return project_counter
        except Exception as e:
            is_timeout = _is_statement_timeout_error(e)
            is_last_attempt = attempt == max_retries - 1
            
            if is_timeout and not is_last_attempt:
                # Calculate exponential backoff with jitter
                sleep_ms = base_sleep_ms * (2**attempt)
                metrics.incr(
                    "counter.increment_project_counter_in_database.statement_timeout_retry",
                    tags={"attempt": attempt + 1},
                )
                logger.warning(
                    "Statement timeout in increment_project_counter_in_database for project_id=%s, "
                    "attempt=%s/%s, retrying in %sms",
                    project.id,
                    attempt + 1,
                    max_retries,
                    sleep_ms,
                    exc_info=True,
                )
                time.sleep(sleep_ms / 1000.0)
            else:
                # Either not a timeout error, or it's the last attempt
                if is_timeout:
                    metrics.incr(
                        "counter.increment_project_counter_in_database.statement_timeout_exhausted"
                    )
                    logger.error(
                        "Exhausted all retry attempts for project_id=%s after %s attempts",
                        project.id,
                        max_retries,
                        exc_info=True,
                    )
                raise
    
    # This should never be reached due to the raise in the loop
    raise RuntimeError("Unexpected exit from retry loop")


@instrumented_task(
    name="sentry.models.counter.refill_cached_short_ids",
    namespace=ingest_errors_tasks,
    retry=None,  # No retries since we want to try again on next counter increment
    silo_mode=SiloMode.REGION,
)
def refill_cached_short_ids(project_id, block_size: int, using="default", **kwargs) -> None:
    """Refills the Redis short-id counter block for a project."""
    from sentry.models.project import Project

    redis = redis_clusters.get("default")
    redis_key = make_short_id_counter_key(project_id)

    lock = locks.get(f"pc:lock:{project_id}", duration=30, name="project_short_id_counter_refill")

    try:
        with lock.acquire():
            project = Project.objects.get_from_cache(id=project_id)

            # in case the counter was just/already filled, we can return early
            if redis.llen(redis_key) >= block_size * LOW_WATER_RATIO:
                metrics.incr("counter.refill_cached_short_ids.early_return")
                return

            # there is a potential race condition where the counter is incremented
            # between the db transaction end and the redis push,
            # but that should just result in skipped short ids, which is acceptable.
            current_value = increment_project_counter_in_database(
                project, delta=block_size, using=using
            )

            # Append the new block of values to Redis in a single operation
            start = current_value - block_size + 1
            redis.rpush(redis_key, *range(start, current_value + 1))
            redis.expire(redis_key, 60 * 60 * 24 * 365)  # 1 year
            # TODO: should we delete the keys when a project is deleted instead of / in addition expiring?
    except UnableToAcquireLock:
        metrics.incr("counter.refill_cached_short_ids.lock_contention")
        return


def make_short_id_counter_key(project_id: int) -> str:
    return f"pc:{project_id}"


def calculate_cached_id_block_size(counter_value: int) -> int:
    """
    to save memory in our cache, if a project's counter is less than 1000,
    we will pre-allocate 100 short ids, and if greater 1000.
    """
    if counter_value < 1000:
        return 100
    else:
        return 1000
