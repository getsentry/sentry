from __future__ import absolute_import

import logging

from django.conf import settings
from django.core.cache import cache

from sentry.tasks.base import instrumented_task

logger = logging.getLogger(__name__)


@instrumented_task(name="sentry.tasks.relay.update_config_cache", queue="relay_config")
def update_config_cache(generate, organization_id=None, project_id=None):
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
        projects = Project.objects.filter(id=project_id)
    elif organization_id:
        projects = Project.objects.filter(organization_id=organization_id)

    if generate:
        projectconfig_cache.set_many(
            [get_project_config(project, full_config=True) for project in projects]
        )
    else:
        projectconfig_cache.delete_many([project.id for project in projects])


def _get_schedule_debounce_key(project_id, organization_id):
    if organization_id:
        return "relayconfig-debounce:o:%s" % (organization_id,)
    elif project_id:
        return "relayconfig-debounce:p:%s" % (project_id,)
    else:
        raise ValueError()


def schedule_update_config_cache(generate, project_id=None, organization_id=None):
    if (
        settings.SENTRY_RELAY_PROJECTCONFIG_CACHE
        == "sentry.relay.projectconfig_cache.base.ProjectConfigCache"
    ):
        # This cache backend is a noop, don't bother creating a noop celery
        # task.
        return

    if bool(organization_id) == bool(project_id):
        raise TypeError("One of organization_id and project_id has to be provided, not both.")

    debounce_key = _get_schedule_debounce_key(project_id, organization_id)
    if cache.get(debounce_key, None):
        # If this task is already in the queue, do not schedule another task.
        return

    cache.set(debounce_key, True, 3600)

    # XXX(markus): We could schedule this task a couple seconds into the
    # future, this would make debouncing more effective. If we want to do this
    # we might want to use the sleep queue.
    update_config_cache.delay(
        generate=generate, project_id=project_id, organization_id=organization_id
    )
