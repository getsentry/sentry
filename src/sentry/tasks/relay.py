from __future__ import absolute_import

import logging

from django.conf import settings
from django.core.cache import cache

from sentry.tasks.base import instrumented_task
from sentry.utils import metrics

logger = logging.getLogger(__name__)


@instrumented_task(name="sentry.tasks.relay.update_config_cache", queue="relay_config")
def update_config_cache(generate, organization_id=None, project_id=None, update_reason=None):
    """
    Update the Redis cache for the Relay projectconfig. This task is invoked
    whenever a project/org option has been saved or smart quotas potentially
    caused a change in projectconfig.

    Either organization_id or project_id has to be provided.

    :param organization_id: The organization for which to invalidate configs.
    :param project_id: The project for which to invalidate configs.
    :param generate: If `True`, caches will be eagerly regenerated, not only
        invalidated.
    """

    from sentry.models import Project
    from sentry.relay import projectconfig_cache
    from sentry.relay.config import get_project_config

    # Delete key before generating configs such that we never have an outdated
    # but valid cache.
    #
    # If this was running at the end of the task, it would be more effective
    # against bursts of updates, but introduces a different race where an
    # outdated cache may be used.
    debounce_key = _get_schedule_debounce_key(project_id, organization_id)
    cache.delete(debounce_key)

    if project_id:
        projects = [Project.objects.get_from_cache(id=project_id)]
    elif organization_id:
        # XXX(markus): I feel like we should be able to cache this but I don't
        # want to add another method to src/sentry/db/models/manager.py
        projects = Project.objects.filter(organization_id=organization_id)

    if generate:
        projectconfig_cache.set_many(
            {
                project.id: get_project_config(project, full_config=True).to_dict()
                for project in projects
            }
        )
    else:
        projectconfig_cache.delete_many([project.id for project in projects])

    metrics.incr(
        "relay.projectconfig_cache.done",
        tags={"generate": generate, "update_reason": update_reason},
    )


def _get_schedule_debounce_key(project_id, organization_id):
    if organization_id:
        return "relayconfig-debounce:o:%s" % (organization_id,)
    elif project_id:
        return "relayconfig-debounce:p:%s" % (project_id,)
    else:
        raise ValueError()


def schedule_update_config_cache(
    generate, project_id=None, organization_id=None, update_reason=None
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

    if bool(organization_id) == bool(project_id):
        raise TypeError("One of organization_id and project_id has to be provided, not both.")

    debounce_key = _get_schedule_debounce_key(project_id, organization_id)
    if cache.get(debounce_key, None):
        metrics.incr(
            "relay.projectconfig_cache.skipped",
            tags={"reason": "debounce", "update_reason": update_reason},
        )
        # If this task is already in the queue, do not schedule another task.
        return

    cache.set(debounce_key, True, 3600)

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
        update_reason=update_reason,
    )
