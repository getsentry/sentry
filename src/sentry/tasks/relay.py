import logging

import sentry_sdk

from sentry.relay import projectconfig_cache, projectconfig_debounce_cache
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics
from sentry.utils.sdk import set_current_event_project

logger = logging.getLogger(__name__)


# Some projects have in the order of 150k ProjectKey entries.  We should compute these in
# batches, but for now we just have a large timeout and don't compute at all for
# organisations.
@instrumented_task(
    name="sentry.tasks.relay.build_project_config",
    queue="relay_config",
    acks_late=True,
    soft_time_limit=5,
    time_limit=10,  # Extra 5 seconds to remove the debounce key
)
def build_project_config(public_key=None, **kwargs):
    """Build a project config and put it in the Redis cache.

    This task is used to compute missing project configs, it is aggressively
    deduplicated to avoid running duplicate computations and thus should only
    be invoked using :func:`schedule_build_project_config`. Because of this
    deduplication it is not suitable for re-computing a project config when
    an option changed, use :func:`schedule_invalidate_project_config` for this.

    Do not invoke this task directly, instead use :func:`schedule_build_project_config`.
    """
    try:
        from sentry.models import ProjectKey

        sentry_sdk.set_tag("public_key", public_key)
        sentry_sdk.set_context("kwargs", kwargs)

        try:
            key = ProjectKey.objects.get(public_key=public_key)
        except ProjectKey.DoesNotExist:
            # In this particular case, where a project key got deleted and
            # triggered an update, we know that key doesn't exist and we want to
            # avoid creating more tasks for it.
            projectconfig_cache.set_many({public_key: {"disabled": True}})
        else:
            config = compute_projectkey_config(key)
            projectconfig_cache.set_many({public_key: config})

    finally:
        # Delete the key in this `finally` block to make sure the debouncing key
        # is always deleted. Deleting the key at the end of the task also makes
        # debouncing more effective.
        projectconfig_debounce_cache.mark_task_done(
            organization_id=None, project_id=None, public_key=public_key
        )


def schedule_build_project_config(public_key):
    """Schedule the `build_project_config` with debouncing applied.

    See documentation of `build_project_config` for documentation of parameters.
    """
    if projectconfig_debounce_cache.is_debounced(
        public_key=public_key, project_id=None, organization_id=None
    ):
        metrics.incr(
            "relay.projectconfig_cache.skipped",
            tags={"reason": "debounce"},
        )
        # If this task is already in the queue, do not schedule another task.
        return

    metrics.incr(
        "relay.projectconfig_cache.scheduled",
        tags={"task": "build"},
    )
    build_project_config.delay(public_key=public_key)

    # Checking if the project is debounced and debouncing it are two separate
    # actions that aren't atomic. If the process marks a project as debounced
    # and dies before scheduling it, the cache will be stale for the whole TTL.
    # To avoid that, make sure we first schedule the task, and only then mark
    # the project as debounced.
    projectconfig_debounce_cache.debounce(
        public_key=public_key, project_id=None, organization_id=None
    )


def validate_args(organization_id=None, project_id=None, public_key=None):
    """Validates arguments for the tasks and sets sentry scope.

    The tasks should be invoked for only one of these arguments, however because of Celery
    we want to use primitive types for the arguments.  This is the common validation to make
    sure only one is provided.
    """
    if [bool(organization_id), bool(project_id), bool(public_key)].count(True) != 1:
        raise TypeError("Must provide exactly one of organization_id, project_id or public_key")


def compute_configs(organization_id=None, project_id=None, public_key=None):
    """Computes all configs for the org, project or single public key.

    You must only provide one single argument, not all.

    :returns: A dict mapping all affected public keys to their config.  The dict could
       contain `None` as value which indicates the config should not exist.
    """
    from sentry.models import Project, ProjectKey

    validate_args(organization_id, project_id, public_key)
    configs = {}

    if organization_id:
        # Currently we do not re-compute all projects in an organization, instead simply
        # remove the configs and rely on relay requests to lazily re-compute them.  This
        # because some organisations have too many projects which may not be active.  At
        # some point this should be handled better.
        projects = list(Project.objects.filter(organization_id=organization_id))
        for key in ProjectKey.objects.filter(project__in=projects):
            configs[key.public_key] = None
    elif project_id:
        for key in ProjectKey.objects.filter(project_id=project_id):
            configs[key.public_key] = compute_projectkey_config(key)
    elif public_key:
        try:
            key = ProjectKey.objects.get(public_key=public_key)
        except ProjectKey.DoesNotExist:
            # There are two main reasons this might happen:
            #
            # - The invalidation task was triggered for a deletion and the ProjectKey should
            #   be deleted from the cache.
            # - Django fired the `after_save` event before a transaction creating the
            #   ProjectKey was committed.
            #
            # Thus we want to make sure we delete the project, but we do not care about
            # disabling it here, because doing so would cause it to be wrongly disabled for
            # an hour in the second case (which will be fixed at some point).  If the v3
            # task finds a non-existing ProjectKey it can disable this project.
            configs[public_key] = None
        else:
            configs[public_key] = compute_projectkey_config(key)

    else:
        raise TypeError("One of the arguments must not be None")

    return configs


def compute_projectkey_config(key):
    """Computes a single config for the given :class:`ProjectKey`.

    :returns: A dict with the project config.
    """
    from sentry.models import ProjectKeyStatus
    from sentry.relay.config import get_project_config

    if key.status != ProjectKeyStatus.ACTIVE:
        return {"disabled": True}
    else:
        return get_project_config(key.project, project_keys=[key], full_config=True).to_dict()


@instrumented_task(
    name="sentry.tasks.relay.invalidate_project_config",
    queue="relay_config",
    acks_late=True,
    soft_time_limit=25 * 60,  # 25mins
    time_limit=25 * 60 + 5,
)
def invalidate_project_config(
    organization_id=None, project_id=None, public_key=None, trigger="invalidated", **kwargs
):
    """Task which re-computes an invalidated project config.

    This task can be scheduled regardless of whether the :func:`build_project_config` task
    is scheduled as well.  It is designed to make sure a new project config is computed if
    scheduled on an invalidation trigger.  Use :func:`schedule_invalidation_task` to
    schedule this task as that will take care of the queueing semantics.

    Note that this can also be invoked for a config which does not yet exist.  E.g. this
    task will also trigger for newly created projects when they are saved to the database.
    There is also no guarantee the project was in the cache if the task is triggered if it
    already existed.

    The current implementation has some limitations:
    - The task does not synchronise with the :func:`build_project_config`.
    - The task does not synchronise with more recent invocations of itself.

    Both these mean that an outdated version of the project config could still end up in the
    cache.  These will be addressed in the future using config revisions tracked in Redis.
    """
    # Make sure we start by deleting the deduplication key so that new invalidation triggers
    # can schedule a new message while we already started computing the project config.
    projectconfig_debounce_cache.invalidation.mark_task_done(
        organization_id=organization_id, project_id=project_id, public_key=public_key
    )

    if project_id:
        set_current_event_project(project_id)
    if organization_id:
        # Cannot use bind_organization_context here because we do not have a
        # model and don't want to fetch one
        sentry_sdk.set_tag("organization_id", organization_id)
    if public_key:
        sentry_sdk.set_tag("public_key", public_key)
    sentry_sdk.set_tag("trigger", trigger)
    sentry_sdk.set_context("kwargs", kwargs)

    configs = compute_configs(
        organization_id=organization_id, project_id=project_id, public_key=public_key
    )

    deleted_keys = [key for key, cfg in configs.items() if cfg is None]
    projectconfig_cache.delete_many(deleted_keys)

    configs = {key: cfg for key, cfg in configs.items() if cfg is not None}
    projectconfig_cache.set_many(configs)


def schedule_invalidate_project_config(
    *, trigger, organization_id=None, project_id=None, public_key=None
):
    """Schedules the :func:`invalidate_project_config` task.

    This takes care of not scheduling a duplicate task if one is already scheduled.  The
    parameters are passed straight to the task.
    """
    validate_args(organization_id, project_id, public_key)

    if projectconfig_debounce_cache.invalidation.is_debounced(
        public_key=public_key, project_id=project_id, organization_id=organization_id
    ):
        # If this task is already in the queue, do not schedule another task.
        metrics.incr(
            "relay.projectconfig_cache.skipped",
            tags={"reason": "debounce", "update_reason": trigger, "task": "invalidation"},
        )
        return

    metrics.incr(
        "relay.projectconfig_cache.scheduled",
        tags={"update_reason": trigger, "task": "invalidation"},
    )

    invalidate_project_config.delay(
        project_id=project_id,
        organization_id=organization_id,
        public_key=public_key,
        trigger=trigger,
    )

    projectconfig_debounce_cache.invalidation.debounce(
        public_key=public_key, project_id=project_id, organization_id=organization_id
    )
