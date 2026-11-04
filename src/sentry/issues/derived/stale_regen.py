from __future__ import annotations

from collections.abc import Collection

from sentry import options, ratelimits
from sentry.issues.derived.tasks import generate_project_derived_data
from sentry.utils import metrics

_PROJECT_KEY = "issues.derived.stale-regen-on-read:project:{project_id}"
_GLOBAL_KEY = "issues.derived.stale-regen-on-read:global"


def _is_allowed(key: str, limit: int, window: int) -> bool:
    _, count, _ = ratelimits.backend.is_limited_with_value(key, limit, window=window)
    # The limiter reports a count of 0 when Redis fails. It fails open, but an
    # outage must not let every stale read schedule a project-wide regeneration.
    return 0 < count <= limit


def regenerate_stale_projects(project_ids: Collection[int]) -> None:
    """Schedule a stale_only regeneration for projects that just served stale derived data.

    Each project is scheduled at most once per project window, and at most the global
    limit of projects per global window. A project that hits the global limit has
    used its project window, so it waits for the next one.
    """
    if not project_ids or not options.get("issues.derived.stale-regen-on-read-enabled"):
        return

    project_window = options.get("issues.derived.stale-regen-on-read-project-window")
    global_limit = options.get("issues.derived.stale-regen-on-read-global-limit")
    global_window = options.get("issues.derived.stale-regen-on-read-global-window")

    for project_id in sorted(project_ids):
        # Check the project first so repeat reads never touch the global counter.
        if not _is_allowed(_PROJECT_KEY.format(project_id=project_id), 1, project_window):
            result = "project_limited"
        elif not _is_allowed(_GLOBAL_KEY, global_limit, global_window):
            result = "global_limited"
        else:
            generate_project_derived_data.delay(project_id=project_id, stale_only=True)
            result = "scheduled"
        metrics.incr(
            "issues.derived.stale_regen_on_read",
            sample_rate=1.0,
            tags={"result": result},
        )
