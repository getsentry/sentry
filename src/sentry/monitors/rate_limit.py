from django.core.cache import cache

from sentry import options
from sentry.models.project import Project
from sentry.monitors.models import MonitorEnvironment
from sentry.tasks.relay import schedule_invalidate_project_config

# This module is used by the Quotas system to inform relay of the allowed
# number of check-ins that can be sent per project during the QUOTA_WINDOW.
#
# In an ideal world we would be rate-limiting monitors on the key of
# (organization, monitor_slug, environment). Unfortunately due to how Relay
# handles quota rate-limiting we're at best able to rate-limit per project.
#
# > Relay cannot do rate-limiting like this because it would need to fully
# > unmarshal the event payload to rate-limit on the monitor slug. The project_id
# > is available in the payload headers.
#
# To allow the monitors system to take-advantage of Relay's quota system to be
# used for rate-limiting, we can rate-limit per project by providing relay with
# a quota for the DataCategory.MONITOR that is calculated based on how many
# monitors the project has.
#
# There are some caveats to this:
#
# - For upserted monitors we need to give some amount of minimum quota, to
#   allow monitors to be created even when there are 0 monitors within a
#   project (since otherwise it would be completely rate-limited)
#
# - It is possible that one monitor may saturate the quota, thus rate-limiting
#   all other monitors within that project. This is an accepted side-effect of
#   doing rate-limiting this way.
#
# - We give each monitor a 'grace' number of allowed check-ins. Ideally each
#   monitor should only be checking in once per minute, so the quota could just
#   be the number of monitors in the project. However,


# Monitor check-in limits are per minute. This maps to the smallest check-in
# window that we support.
QUOTA_WINDOW = 60

# The minimum rate-limit per project for the DataCategory.MONITOR. This value
# should be high enough that it allows for a large number of monitors to be
# upserted without hitting the project rate-limit.
ALLOWED_MINIMUM = 50


def get_project_monitor_quota(
    project: Project,
    cache_bust=False,
) -> tuple[int | None, int | None]:
    """
    Determines the rate-limit for monitor check-ins across a particular
    project.

    :return: A (limit, window) tuple. (None, None) indicates no rate-limit
    """
    limit = None
    cache_key = f"project:{project.id}:monitor-env-count"

    allowed_check_ins_per_monitor = options.get("crons.per_monitor_rate_limit")

    # Cache rate-limit computation. This function will be called often by the
    # Quotas system.
    if not cache_bust:
        limit = cache.get(cache_key)

    if limit is None:
        monitor_count = MonitorEnvironment.objects.filter(monitor__project_id=project.id).count()
        limit = monitor_count * allowed_check_ins_per_monitor
        cache.set(cache_key, limit, 600)

    return (ALLOWED_MINIMUM + limit, QUOTA_WINDOW)


def update_monitor_quota(monitor_env: MonitorEnvironment):
    """
    When new monitor environments are created we recompute the per-project
    monitor check-in rate limit QuotaConfig in relay.
    """
    project = Project.objects.get_from_cache(id=monitor_env.monitor.project_id)

    get_project_monitor_quota(project, cache_bust=True)
    schedule_invalidate_project_config(
        project_id=project.id,
        trigger="monitors:monitor_created",
    )
