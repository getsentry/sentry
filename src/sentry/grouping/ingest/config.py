from __future__ import annotations

import logging
import time
from collections.abc import MutableMapping
from typing import Any

from django.conf import settings
from django.core.cache import cache

from sentry import audit_log, options
from sentry.grouping.strategies.configurations import CONFIGURATIONS
from sentry.locks import locks
from sentry.models.project import Project
from sentry.projectoptions.defaults import BETA_GROUPING_CONFIG, DEFAULT_GROUPING_CONFIG
from sentry.utils import metrics
from sentry.utils.audit import create_system_audit_entry

logger = logging.getLogger("sentry.events.grouping")

Job = MutableMapping[str, Any]

# Used to migrate projects that have no activity via getsentry scripts
CONFIGS_TO_DEPRECATE = set(CONFIGURATIONS.keys()) - {
    DEFAULT_GROUPING_CONFIG,
}


def update_grouping_config_if_needed(project: Project, source: str) -> None:
    current_config = project.get_option("sentry:grouping_config")

    if current_config == DEFAULT_GROUPING_CONFIG or current_config == BETA_GROUPING_CONFIG:
        return

    # We want to try to write the audit log entry and project option change just once, so we use a
    # cache key to avoid raciness. It's not perfect, but it reduces the risk significantly.
    cache_key = f"grouping-config-update:{project.id}:{current_config}"
    lock_key = f"grouping-update-lock:{project.id}"
    if cache.get(cache_key) is not None:
        return

    with locks.get(lock_key, duration=60, name="grouping-update-lock").acquire():
        if cache.get(cache_key) is not None:
            return
        else:
            cache.set(cache_key, "1", 60 * 5)

        changes: dict[str, str | int] = {"sentry:grouping_config": DEFAULT_GROUPING_CONFIG}

        # If the current config is still valid, put the project into a migration period
        if current_config in CONFIGURATIONS.keys():
            # This is when we will stop calculating the old hash in cases where we don't find the
            # new hash (which we do in an effort to preserve group continuity).
            transition_expiry = int(time.time()) + settings.SENTRY_GROUPING_UPDATE_MIGRATION_PHASE

            changes.update(
                {
                    "sentry:secondary_grouping_config": current_config,
                    "sentry:secondary_grouping_expiry": transition_expiry,
                }
            )

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
