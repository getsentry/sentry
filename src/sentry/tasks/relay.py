import logging

import sentry_sdk
from django.conf import settings

from sentry.relay import projectconfig_cache, projectconfig_debounce_cache
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics
from sentry.utils.sdk import set_current_event_project

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tasks.relay.update_config_cache", queue="relay_config", acks_late=True
)
def update_config_cache(
    generate, organization_id=None, project_id=None, public_key=None, update_reason=None
):
    """
    Update the Redis cache for the Relay projectconfig. This task is invoked
    whenever a project/org option has been saved or smart quotas potentially
    caused a change in projectconfig.

    Either organization_id or project_id has to be provided.

    :param organization_id: The organization for which to invalidate configs.
    :param project_id: The project for which to invalidate configs.
    :param generate: If `True`, caches will be eagerly regenerated, not only
        invalidated.
    :param update_reason: A string to set as tag in sentry.
    """
    from sentry.models import Project, ProjectKey, ProjectKeyStatus
    from sentry.relay import projectconfig_cache
    from sentry.relay.config import get_project_config

    if project_id:
        set_current_event_project(project_id)

    if organization_id:
        # Cannot use bind_organization_context here because we do not have a
        # model and don't want to fetch one
        sentry_sdk.set_tag("organization_id", organization_id)

    if public_key:
        sentry_sdk.set_tag("public_key", public_key)

    sentry_sdk.set_tag("update_reason", update_reason)
    sentry_sdk.set_tag("generate", generate)

    try:
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
                projectconfig_cache.delete_many([public_key])
                return
        else:
            assert False

        if generate:
            config_cache = {}
            for key in keys:
                if key.status != ProjectKeyStatus.ACTIVE:
                    project_config = {"disabled": True}
                else:
                    project_config = get_project_config(
                        key.project, project_keys=[key], full_config=True
                    ).to_dict()
                config_cache[key.public_key] = project_config

            projectconfig_cache.set_many(config_cache)
        else:
            cache_keys_to_delete = []
            for key in keys:
                cache_keys_to_delete.append(key.public_key)

            projectconfig_cache.delete_many(cache_keys_to_delete)

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

    # validate_args(organization_id, project_id, public_key)
    bools = sorted((bool(organization_id), bool(project_id), bool(public_key)))
    if bools != [False, False, True]:
        raise TypeError(
            "One of organization_id, project_id, public_key has to be provided, not many."
        )

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
    projectconfig_debounce_cache.debounce(
        public_key=public_key, project_id=project_id, organization_id=organization_id
    )


def validate_args(organization_id=None, project_id=None, public_key=None):
    """Validates arguments for the tasks and sets sentry scope.

    The tasks should be invoked for only one of these arguments, however because of Celery
    we want to use primitive types for the arguments.  This is the common validation to make
    sure only one is provided.
    """
    if [bool(organization_id), bool(project_id), bool(public_key)].count(True) != 1:
        raise TypeError("Must provide exactly one of organzation_id, project_id or public_key")


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
        projects = [Project.objects.get(id=project_id)]
        for key in ProjectKey.objects.filter(project__in=projects):
            configs[key.public_key] = compute_projectkey_config(key)
    elif public_key:
        try:
            key = ProjectKey.objects.get(public_key=public_key)
        except ProjectKey.DoesNotExist:
            # Someone asks for a non-existing config, to avoid hitting this code path too
            # often we disable the project in the cache which will live for 1h.
            configs[public_key] = {"disabled": True}
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
    soft_time_limit=30,
    time_limit=35,
)
def invalidate_project_config(
    organization_id=None, project_id=None, public_key=None, trigger="invalidated", **kwargs
):
    """Task which re-computes an invalidated project config.

    This task can be scheduled regardless of whether the :func:`update_config_cache` task is
    scheduled as well.  It is designed to make sure a new project config is computed if
    scheduled on an invalidation trigger.  Use :func:`schedule_invalidation_task` to
    schedule this task as that will take care of the queueing semantics.

    Note that this can also be invoked for a config which does not yet exist.  E.g. this
    task will also trigger for newly created projects when they are saved to the database.
    There is also no guarantee the project was in the cache if the task is triggered if it
    already existed.

    The current implementation has some limitations:
    - The task does not synchronise with the :func:`update_config_cache`.
    - The task does not synchronise with more recent invocations of itself.

    Both these mean that an outdated version of the project config could still end up in the
    cache.  These will be addressed in the future using config revisions tracked in Redis.
    """
    validate_args(organization_id, project_id, public_key)

    if project_id:
        set_current_event_project(project_id)
    if organization_id:
        # Cannot use bind_organization_context here because we do not have a
        # model and don't want to fetch one
        sentry_sdk.set_tag("organization_id", organization_id)
    if public_key:
        sentry_sdk.set_tag("public_key", public_key)
    sentry_sdk.set_tag("trigger", trigger)

    # Make sure we start by deleting out deduplication key so that new invalidation triggers
    # can schedule a new message while we already started computing the project config.
    projectconfig_debounce_cache.invalidation.mark_task_done(
        organization_id=organization_id, project_id=project_id, public_key=public_key
    )

    configs = compute_configs(
        organization_id=organization_id, project_id=project_id, public_key=public_key
    )

    deleted_keys = [key for key, cfg in configs.items() if cfg is None]
    projectconfig_cache.delete_many(deleted_keys)

    configs = {key: cfg for key, cfg in configs.items() if cfg is not None}
    projectconfig_cache.set_many(configs)


def schedule_invalidate_project_cache(
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
