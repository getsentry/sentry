import logging

import sentry_sdk
from django.conf import settings

from sentry.relay import projectconfig_debounce_cache
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

    if not should_update_cache(
        organization_id=organization_id, project_id=project_id, public_key=public_key
    ):
        # XXX(iker): this approach doesn't work with celery's ack_late enabled.
        # If ack_late is enabled and the task fails after being marked as done,
        # the second attempt will exit early and not compute the project config.
        metrics.incr("relay.tasks.update_config_cache.early_return", amount=1, sample_rate=1)
        return

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


def should_update_cache(organization_id=None, project_id=None, public_key=None) -> bool:
    # Delete key before generating configs such that we never have an outdated
    # but valid cache. Also, only run task if it's still scheduled and another
    # worker hasn't picked it up.
    #
    # If this was running at the end of the task, it would be more effective
    # against bursts of updates, but introduces a different race where an
    # outdated cache may be used.
    return 0 < projectconfig_debounce_cache.mark_task_done(
        organization_id=organization_id,
        project_id=project_id,
        public_key=public_key,
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

    bools = sorted((bool(organization_id), bool(project_id), bool(public_key)))
    if bools != [False, False, True]:
        raise TypeError(
            "One of organization_id, project_id, public_key has to be provided, not many."
        )

    if projectconfig_debounce_cache.is_debounced(public_key, project_id, organization_id):
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
