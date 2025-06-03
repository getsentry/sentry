import sentry_sdk
from django.conf import settings
from django.db import connections, transaction
from django.db.models.signals import post_migrate

from sentry import features
from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedBigIntegerField,
    FlexibleForeignKey,
    Model,
    get_model_if_available,
    region_silo_model,
    sane_repr,
)
from sentry.locks import locks
from sentry.options.rollout import in_random_rollout
from sentry.silo.base import SiloMode
from sentry.silo.safety import unguarded_write
from sentry.tasks.base import instrumented_task
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.namespaces import ingest_errors_tasks
from sentry.utils import metrics
from sentry.utils.locking import UnableToAcquireLock
from sentry.utils.redis import redis_clusters

CACHED_ID_BLOCK_SIZE = 1000
"""
The number of short ids to pre-allocate in Redis.
"""


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
        if features.has("projects:short-id-pre-allocation-counter", project) and delta == 1:
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
        short_id, remaining = pipe.execute()

    if short_id is None:  # fallback if not populated in Redis
        metrics.incr("counter.increment_project_counter_in_cache.fallback")
        next_id = increment_project_counter_in_database(project, using=using)
        refill_cached_short_ids.delay(project.id, using=using)
        return next_id
    else:
        metrics.incr("counter.increment_project_counter_in_cache.found_in_redis")
        if remaining < CACHED_ID_BLOCK_SIZE * LOW_WATER_RATIO:
            metrics.incr("counter.increment_project_counter_in_cache.refill")
            refill_cached_short_ids.delay(project.id, using=using)

        return int(short_id)


@sentry_sdk.tracing.trace
@metrics.wraps("counter.increment_project_counter_in_database")
def increment_project_counter_in_database(project, delta=1, using="default") -> int:
    """This method primarily exists so that south code can use it."""
    if delta <= 0:
        raise ValueError("There is only one way, and that's up.")

    modern_upsert = in_random_rollout("store.projectcounter-modern-upsert-sample-rate")

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

            if modern_upsert:
                # Our postgres wrapper thing does not allow for named arguments
                cur.execute(
                    "insert into sentry_projectcounter (project_id, value) "
                    "values (%s, %s) "
                    "on conflict (project_id) do update "
                    "set value = sentry_projectcounter.value + %s "
                    "returning value",
                    [project.id, delta, delta],
                )
            else:
                cur.execute(
                    "select sentry_increment_project_counter(%s, %s)",
                    [project.id, delta],
                )

            project_counter = cur.fetchone()[0]

            if statement_timeout is not None:
                cur.execute(
                    "set local statement_timeout = %s",
                    [statement_timeout],
                )

            return project_counter


# this must be idempotent because it seems to execute twice
# (at least during test runs)
def create_counter_function(app_config, using, **kwargs) -> None:
    if app_config and app_config.name != "sentry":
        return

    if not get_model_if_available(app_config, "Counter"):
        return

    if SiloMode.get_current_mode() == SiloMode.CONTROL:
        return

    with unguarded_write(using), connections[using].cursor() as cursor:
        cursor.execute(
            """
            create or replace function sentry_increment_project_counter(
                project bigint, delta int) returns int as $$
            declare
            new_val int;
            begin
            loop
                update sentry_projectcounter set value = value + delta
                where project_id = project
                returning value into new_val;
                if found then
                return new_val;
                end if;
                begin
                insert into sentry_projectcounter(project_id, value)
                    values (project, delta)
                    returning value into new_val;
                return new_val;
                exception when unique_violation then
                end;
            end loop;
            end
            $$ language plpgsql;
        """
        )


post_migrate.connect(create_counter_function, dispatch_uid="create_counter_function", weak=False)


@instrumented_task(
    name="sentry.models.counter.refill_cached_short_ids",
    queue="shortid.counters.refill",
    silo_mode=SiloMode.REGION,
    taskworker_config=TaskworkerConfig(
        namespace=ingest_errors_tasks,
        retry=None,  # No retries since we want to try again on next counter increment
    ),
)
def refill_cached_short_ids(project_id, using="default") -> None:
    """Refills the Redis short-id counter block for a project."""
    from sentry.models.project import Project

    redis = redis_clusters.get("default")
    redis_key = make_short_id_counter_key(project_id)

    lock = locks.get(f"pc:lock:{project_id}", duration=30, name="project_short_id_counter_refill")

    try:
        with lock.acquire():
            # in case the counter was just/already filled, we can return early
            if redis.llen(redis_key) >= CACHED_ID_BLOCK_SIZE * LOW_WATER_RATIO:
                metrics.incr("counter.refill_cached_short_ids.early_return")
                return

            project = Project.objects.get_from_cache(id=project_id)

            # We need the transaction to ensure that the redis push is atomic
            # with the database counter increment,
            # otherwise we could have duplicates if the counter is incremented between
            # the database increment and the redis push.
            with transaction.atomic(using=using):
                current_value = increment_project_counter_in_database(
                    project, delta=CACHED_ID_BLOCK_SIZE, using=using
                )
                # Append the new block of values to Redis in a single operation
                start = current_value - CACHED_ID_BLOCK_SIZE + 1
                redis.rpush(redis_key, *range(start, current_value + 1))
                redis.expire(redis_key, 60 * 60 * 24 * 365)  # 1 year
                # TODO: should we delete the keys when a project is deleted instead of / in addition expiring?
    except UnableToAcquireLock:
        metrics.incr("counter.refill_cached_short_ids.lock_contention")
        return


def make_short_id_counter_key(project_id: int) -> str:
    return f"pc:{project_id}"
