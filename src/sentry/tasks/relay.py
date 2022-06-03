import logging

import sentry_sdk
from django.conf import settings

from sentry.relay import projectconfig_cache, projectconfig_debounce_cache
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics
from sentry.utils.sdk import set_current_event_project

logger = logging.getLogger(__name__)


@instrumented_task(name="sentry.tasks.relay.update_config_cache", queue="relay_config")
def update_config_cache(
    generate, organization_id=None, project_id=None, public_key=None, update_reason=None
):
    """
    Update the Redis cache for the Relay projectconfig. This task is invoked
    whenever a project/org option has been saved or smart quotas potentially
    caused a change in projectconfig.

    Either organization_id or project_id has to be provided.

    :param generate: obsolete argument, do not use.
    :param organization_id: The organization for which to invalidate configs.
    :param project_id: The project for which to invalidate configs.
    :param generate: If `True`, caches will be eagerly regenerated, not only
        invalidated.
    :param update_reason: A string to set as tag in sentry.
    """
    validate_args(organization_id, project_id, public_key)

    sentry_sdk.set_tag("update_reason", update_reason)
    sentry_sdk.set_tag("generate", generate)

    try:
        keys = project_keys_to_update(
            organization_id=organization_id, project_id=project_id, public_key=public_key
        )

        # TODO: remove this if statement before this PR is merged.
        if keys and generate:
            compute_project_configs(keys)
        elif keys:
            projectconfig_cache.delete_many(key.public_key for key in keys)

    finally:
        # Delete the key in this `finally` block to make sure the debouncing key
        # is always deleted. Deleting the key at the end of the task also makes
        # debouncing more effective.
        projectconfig_debounce_cache.mark_task_done(
            organization_id=organization_id, project_id=project_id, public_key=public_key
        )


def schedule_update_config_cache(
    generate, project_id=None, organization_id=None, public_key=None, update_reason=None
):
    """
    Schedule the `update_config_cache` with debouncing applied.

    See documentation of `update_config_cache` for documentation of parameters.
    """

    if (
        settings.SENTRY_RELAY_PROJECTCONFIG_CACHE
        == "sentry.relay.projectconfig_cache.base.ProjectConfigCache"
    ):
        # This cache backend is a noop, don't bother creating a noop celery
        # task.
        metrics.incr(
            "relay.projectconfig_cache.skipped",
            tags={"reason": "noop_backend", "update_reason": update_reason},
        )
        return

    validate_args(organization_id, project_id, public_key)

    if projectconfig_debounce_cache.is_debounced(
        public_key=public_key, project_id=project_id, organization_id=organization_id
    ):
        metrics.incr(
            "relay.projectconfig_cache.skipped",
            tags={"reason": "debounce", "update_reason": update_reason},
        )
        # If this task is already in the queue, do not schedule another task.
        return

    # XXX(markus): We could schedule this task a couple seconds into the
    # future, this would make debouncing more effective. If we want to do this
    # we might want to use the sleep queue.
    metrics.incr(
        "relay.projectconfig_cache.scheduled",
        tags={"generate": generate, "update_reason": update_reason},
    )
    update_config_cache.delay(
        generate=generate,
        project_id=project_id,
        organization_id=organization_id,
        public_key=public_key,
        update_reason=update_reason,
    )

    # Checking if the project is debounced and debouncing it are two separate
    # actions that aren't atomic. If the process marks a project as debounced
    # and dies before scheduling it, the cache will be stale for the whole TTL.
    # To avoid that, make sure we first schedule the task, and only then mark
    # the project as debounced.
    projectconfig_debounce_cache.debounce(public_key, project_id, organization_id)


def validate_args(organization_id=None, project_id=None, public_key=None):
    """Validates arguments for the tasks and sets sentry scope.

    The tasks should be invoked for only one of these arguments, however because of Celery
    we want to use primitive types for the arguments.  This is the common validation to make
    sure only one is provided.
    """
    if [bool(organization_id), bool(project_id), bool(public_key)].count(True) != 1:
        raise TypeError("Must provide exactly one of organzation_id, project_id or public_key")

    if project_id:
        set_current_event_project(project_id)
    if organization_id:
        # Cannot use bind_organization_context here because we do not have a
        # model and don't want to fetch one
        sentry_sdk.set_tag("organization_id", organization_id)
    if public_key:
        sentry_sdk.set_tag("public_key", public_key)


def project_keys_to_update(organization_id=None, project_id=None, public_key=None):
    """Returns the project keys which need to have their config updated.

    Queries the database for the required project keys.
    """
    from sentry.models import Project, ProjectKey

    if organization_id:
        projects = list(Project.objects.filter(organization_id=organization_id))
        keys = list(ProjectKey.objects.filter(project__in=projects))
    elif project_id:
        projects = [Project.objects.get(id=project_id)]
        keys = list(ProjectKey.objects.filter(project__in=projects))
    elif public_key:
        try:
            keys = [ProjectKey.objects.get(public_key=public_key)]
        except ProjectKey.DoesNotExist:
            # In this particular case, where a project key got deleted and
            # triggered an update, we know that key doesn't exist and we want to
            # avoid creating more tasks for it.
            #
            # In other similar cases, like an org being deleted, we potentially
            # cannot find any keys anymore, so we don't know which cache keys
            # to delete.
            projectconfig_cache.set_many({public_key: {"disabled": True}})
            keys = []

    else:
        assert False

    return keys


def compute_project_configs(project_keys):
    """Computes the project configs for all given project keys."""
    from sentry.models import ProjectKeyStatus
    from sentry.relay.config import get_project_config

    config_cache = {}
    for key in project_keys:
        if key.status != ProjectKeyStatus.ACTIVE:
            project_config = {"disabled": True}
        else:
            project_config = get_project_config(
                key.project, project_keys=[key], full_config=True
            ).to_dict()
        config_cache[key.public_key] = project_config

    projectconfig_cache.set_many(config_cache)


@instrumented_task(
    name="sentry.tasks.relay.invalidate_project_config",
    queue="relay_config",
    acks_late=True,
    soft_time_limit=30,
    time_limit=32,
)
def invalidate_project_config(organization_id=None, project_id=None, public_key=None):
    """Task which re-computes an invalidated project config.

    This task can be scheduled regardless of whether the :func:`update_config_cache` task is
    scheduled as well.  It is designed to make sure a new project config is computed if
    scheduled on an invalidation trigger.  Use :func:`schedule_invalidation_task` to
    schedule this task as that will take care of the queueing semantics.

    The current implementation has some limitations:

    - The task does not synchronise with the :func:`update_config_cache` task so depending
      on when tasks complete they might have race conditions on writing the config to the
      cache and an older version might be written.

    - The task does not synchronise with more recent invocations of itself.

    These will be addressed in the future using config revisions tracked in Redis.
    """
    validate_args(organization_id, project_id, public_key)

    # Make sure we start by deleting out deduplication key so that new invalidation triggers
    # can schedule a new message while we already started computing the project config.
    projectconfig_debounce_cache.invalidation.mark_task_done(
        organization_id=organization_id, project_id=project_id, public_key=public_key
    )

    keys = project_keys_to_update(
        organization_id=organization_id, project_id=project_id, public_key=public_key
    )
    if not keys:
        return

    if organization_id:
        # Previous incarnations of this task only delete all the affected configs in this
        # case, relying of lazily filling them back in as they are requested.  Probably
        # because some organizations can have thousands of projects and they may not all be
        # active.  Do the same for now, but this could be improved.
        projectconfig_cache.delete_many(key.public_key for key in keys)
    else:
        compute_project_configs(keys)


def schedule_invalidate_config_cache(
    *, trigger, organization_id=None, project_id=None, public_key=None
):
    """Schedules the :func:`invalidate_project_config` task.

    This takes care of not scheduling a duplicate task if one is already scheduled.  The
    parameters are passed straight to the task.
    """
    # TODO: so far i failed to merge this code with schedule_update_config_cache elegantly.
    validate_args(organization_id, project_id, public_key)

    if projectconfig_debounce_cache.invalidation.is_debounced(
        public_key=public_key, project_id=project_id, organization_id=organization_id
    ):
        metrics.incr(
            "relay.projectconfig_cache.skipped",
            tags={"reason": "debounce", "update_reason": trigger, "task": "invalidation"},
        )
        # If this task is already in the queue, do not schedule another task.
        return

    metrics.incr(
        "relay.projectconfig_cache.scheduled",
        tags={"update_reason": trigger, "task": "invalidation"},
    )
    with sentry_sdk.push_scope() as scope:
        scope.set_tag("update_reason", trigger)

        invalidate_project_config.delay(
            project_id=project_id,
            organization_id=organization_id,
            public_key=public_key,
            update_reason=trigger,
        )

    projectconfig_debounce_cache.invalidation.debounce(public_key, project_id, organization_id)
