import logging
import time

import sentry_sdk

from sentry.models.organization import Organization
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
    tmp_scheduled = time.time()
    if projectconfig_debounce_cache.is_debounced(
        public_key=public_key, project_id=None, organization_id=None
    ):
        metrics.incr(
            "relay.projectconfig_cache.skipped",
            tags={"reason": "debounce", "task": "build"},
        )
        # If this task is already in the queue, do not schedule another task.
        return

    metrics.incr(
        "relay.projectconfig_cache.scheduled",
        tags={"task": "build"},
    )
    build_project_config.delay(public_key=public_key, tmp_scheduled=tmp_scheduled)

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
        raise TypeError("Must provide exactly one of organzation_id, project_id or public_key")


def compute_configs(organization_id=None, project_id=None, public_key=None):
    """Computes all configs for the org, project or single public key.

    You must only provide one single argument, not all.

    :returns: A dict mapping all affected public keys to their config.  The dict will not
       contain keys which should be retained in the cache unchanged.
    """
    from sentry.models import Project, ProjectKey

    validate_args(organization_id, project_id, public_key)
    configs = {}

    if organization_id:
        # We want to re-compute all projects in an organization, instead of simply
        # removing the configs and rely on relay requests to lazily re-compute them.  This
        # is done because we do want want to delete project configs in `invalidate_project_config`
        # which might cause the key to disappear and trigger the task again.  Without this behavior
        # it could be possible that refrequent invalidations cause the task to take excessive time
        # to complete.
        for organization in Organization.objects.filter(id=organization_id):
            for project in Project.objects.filter(organization_id=organization_id):
                project.set_cached_field_value("organization", organization)
                for key in ProjectKey.objects.filter(project_id=project.id):
                    key.set_cached_field_value("project", project)
                    # If we find the config in the cache it means it was active.  As such we want to
                    # recalculate it.  If the config was not there at all, we leave it and avoid the
                    # cost of re-computation.
                    if projectconfig_cache.get(key.public_key) is not None:
                        configs[key.public_key] = compute_projectkey_config(key)
                        action = "recompute"
                    else:
                        action = "not-cached"
                    metrics.incr(
                        "relay.projectconfig_cache.invalidation.recompute",
                        tags={"action": action, "scope": "organization"},
                    )
    elif project_id:
        for project in Project.objects.filter(id=project_id):
            for key in ProjectKey.objects.filter(project_id=project_id):
                key.set_cached_field_value("project", project)
                # If we find the config in the cache it means it was active.  As such we want to
                # recalculate it.  If the config was not there at all, we leave it and avoid the
                # cost of re-computation.
                if projectconfig_cache.get(key.public_key) is not None:
                    configs[key.public_key] = compute_projectkey_config(key)
                    action = "recompute"
                else:
                    action = "not-cached"
                    metrics.incr(
                        "relay.projectconfig_cache.invalidation.recompute",
                        tags={"action": action, "scope": "project"},
                    )
    elif public_key:
        try:
            key = ProjectKey.objects.get(public_key=public_key)
        except ProjectKey.DoesNotExist:
            # The invalidation task was triggered for a deletion and the
            # ProjectKey should be deleted from the cache.
            #
            # This used to delete the cache entry instead of disabling it. The
            # reason for that was to work around a bug in our model signal
            # handlers that sent off the invalidation tasks before the DB
            # transaction was committed, causing us to write stale caches. That
            # bug was fixed in https://github.com/getsentry/sentry/pull/35671
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
    queue="relay_config_bulk",
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

    updated_configs = compute_configs(
        organization_id=organization_id, project_id=project_id, public_key=public_key
    )
    projectconfig_cache.set_many(updated_configs)


def schedule_invalidate_project_config(
    *,
    trigger,
    organization_id=None,
    project_id=None,
    public_key=None,
    countdown=5,
):
    """Schedules the :func:`invalidate_project_config` task.

    This takes care of not scheduling a duplicate task if one is already scheduled.  The
    parameters are passed straight to the task.

    :param countdown: The time to delay running this task in seconds.  Normally this is
       delay a little to increase the likelyhood of deduplicating invalidations but you can
       tweak this, like e.g. the :func:`invalidate_all` task does.
    """
    from sentry.models import Project, ProjectKey

    validate_args(organization_id, project_id, public_key)

    # The keys we need to check for to see if this is debounced, we want to check all
    # levels.
    check_debounce_keys = {
        "public_key": public_key,
        "project_id": project_id,
        "organization_id": organization_id,
    }
    if public_key:
        try:
            key = ProjectKey.objects.get(public_key=public_key)
        except ProjectKey.DoesNotExist:
            pass
        else:
            check_debounce_keys["project_id"] = key.project.id
            check_debounce_keys["organization_id"] = key.project.organization.id
    elif project_id:
        try:
            proj = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            pass
        else:
            check_debounce_keys["organization_id"] = proj.organization.id

    if projectconfig_debounce_cache.invalidation.is_debounced(**check_debounce_keys):
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

    invalidate_project_config.apply_async(
        countdown=countdown,
        kwargs={
            "project_id": project_id,
            "organization_id": organization_id,
            "public_key": public_key,
            "trigger": trigger,
        },
    )

    # Use the original arguments to this function to set the debounce key.
    projectconfig_debounce_cache.invalidation.debounce(
        organization_id=organization_id, project_id=project_id, public_key=public_key
    )


@instrumented_task(
    name="sentry.tasks.relay.invalidate_all_project_configs",
    queue="relay_config_bulk",
    acks_late=True,
    soft_time_limit=25 * 60,  # 25mins
    time_limit=25 * 60 + 5,
)
def invalidate_all_project_configs(**kwargs):
    """Invalidates all the currently cached active projects.

    This works by scheduling an invalidation for each organisation, this likely backlogs the
    relay_config_bulk queue however since all other invalidations deduplicate with these
    org-wide ones this does not matter as long as the backlog is cleared soon.  Calling this
    task multiple times will result in it executing multiple times, however the
    organisation-scoped invalidations will deduplicate.
    """
    for org in Organization.objects.all():
        schedule_invalidate_project_config(
            trigger="invalidate-all", organization_id=org.id, countdown=0
        )
