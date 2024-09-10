from __future__ import annotations

import logging
import time
from collections.abc import MutableMapping
from typing import Any

from django.conf import settings
from django.core.cache import cache

from sentry import features, options
from sentry.locks import locks
from sentry.models.project import Project
from sentry.projectoptions.defaults import BETA_GROUPING_CONFIG, DEFAULT_GROUPING_CONFIG
from sentry.utils import metrics

logger = logging.getLogger("sentry.events.grouping")

Job = MutableMapping[str, Any]

# Used to migrate projects that have no activity via getsentry scripts
CONFIGS_TO_DEPRECATE = ()


# Used by getsentry script. Remove it once the script has been updated to call update_grouping_config_if_needed
def update_grouping_config_if_permitted(project: Project) -> None:
    update_grouping_config_if_needed(project, "script")


def update_grouping_config_if_needed(project: Project, source: str) -> None:
    current_config = project.get_option("sentry:grouping_config")
    new_config = DEFAULT_GROUPING_CONFIG

    if current_config == new_config or current_config == BETA_GROUPING_CONFIG:
        return

    # Because the way the auto grouping upgrading happening is racy, we want to
    # try to write the audit log entry and project option change just once.
    # For this a cache key is used.  That's not perfect, but should reduce the
    # risk significantly.
    cache_key = f"grouping-config-update:{project.id}:{current_config}"
    lock_key = f"grouping-update-lock:{project.id}"
    if cache.get(cache_key) is not None:
        return

    with locks.get(lock_key, duration=60, name="grouping-update-lock").acquire():
        if cache.get(cache_key) is None:
            cache.set(cache_key, "1", 60 * 5)
        else:
            return

        from sentry import audit_log
        from sentry.utils.audit import create_system_audit_entry

        # This is when we will stop calculating both old hashes (which we do in an effort to
        # preserve group continuity).
        expiry = int(time.time()) + settings.SENTRY_GROUPING_UPDATE_MIGRATION_PHASE

        changes = {
            "sentry:secondary_grouping_config": current_config,
            "sentry:secondary_grouping_expiry": expiry,
            "sentry:grouping_config": new_config,
        }

        for key, value in changes.items():
            project.update_option(key, value)

        create_system_audit_entry(
            organization=project.organization,
            target_object=project.id,
            event=audit_log.get_event_id("PROJECT_EDIT"),
            data={**changes, **project.get_audit_log_data()},
        )
        metrics.incr(
            "grouping.config_updated",
            sample_rate=options.get("grouping.config_transition.metrics_sample_rate"),
            tags={"current_config": current_config, "source": source},
        )


def is_in_transition(project: Project) -> bool:
    secondary_grouping_config = project.get_option("sentry:secondary_grouping_config")
    secondary_grouping_expiry = project.get_option("sentry:secondary_grouping_expiry")

    return bool(secondary_grouping_config) and (secondary_grouping_expiry or 0) >= time.time()


def project_uses_optimized_grouping(project: Project) -> bool:
    if options.get("grouping.config_transition.killswitch_enabled"):
        return False

    return (
        features.has(
            "organizations:grouping-suppress-unnecessary-secondary-hash",
            project.organization,
        )
        or (is_in_transition(project))
        # TODO: Yes, this is everyone - this check will soon be removed entirely
        or project.id % 5 < 5  # 100% of all non-transition projects
    )
