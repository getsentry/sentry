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
from sentry.models.options.project_option import ProjectOption
from sentry.models.project import Project
from sentry.projectoptions.defaults import BETA_GROUPING_CONFIG, DEFAULT_GROUPING_CONFIG
from sentry.utils import metrics
from sentry.utils.audit import create_system_audit_entry
from sentry.utils.locking import UnableToAcquireLock

logger = logging.getLogger("sentry.events.grouping")

Job = MutableMapping[str, Any]

# Used to migrate projects that have no activity via getsentry scripts
CONFIGS_TO_DEPRECATE = set(CONFIGURATIONS.keys()) - {
    DEFAULT_GROUPING_CONFIG,
}


def update_or_set_grouping_config_if_needed(project: Project, source: str) -> str:
    """
    Ensure that the given project has its grouping config set to the current default. Will create a
    `ProjectOption` record for any project missing one. Returns a string indicating what it did, for
    use by scripts.
    """
    current_config = project.get_option("sentry:grouping_config")

    if current_config == BETA_GROUPING_CONFIG:
        return "skipped - beta config"

    if current_config == DEFAULT_GROUPING_CONFIG:
        # If the project's current config comes back as the default one, it might be because that's
        # actually what's set in the database for that project, or it might be relying on the
        # default value of that project option. In the latter case, we can use this upgrade check as
        # a chance to set it. (We want projects to have their own record of the config they're
        # using, so that when we introduce a new one, we know to transition them.)
        project_option_exists = ProjectOption.objects.filter(
            key="sentry:grouping_config", project_id=project.id
        ).exists()

        if project_option_exists:
            return "skipped - up-to-date record exists"

    # We want to try to write the audit log entry and project option change just once, so we use a
    # cache key to avoid raciness. It's not perfect, but it reduces the risk significantly.
    cache_key = f"grouping-config-update:{project.id}:{current_config}"
    lock_key = f"grouping-update-lock:{project.id}"
    if cache.get(cache_key) is not None:
        return "skipped - race condition"

    try:
        with locks.get(lock_key, duration=60, name="grouping-update-lock").acquire():
            if cache.get(cache_key) is not None:
                return "skipped - race condition"
            else:
                cache.set(cache_key, "1", 60 * 5)

            changes: dict[str, str | int] = {"sentry:grouping_config": DEFAULT_GROUPING_CONFIG}

            # If the current config is out of date but still valid, start a transition period
            if (
                current_config != DEFAULT_GROUPING_CONFIG
                and current_config in CONFIGURATIONS.keys()
            ):
                # This is when we will stop calculating the old hash in cases where we don't find the
                # new hash (which we do in an effort to preserve group continuity).
                transition_expiry = (
                    int(time.time()) + settings.SENTRY_GROUPING_CONFIG_TRANSITION_DURATION
                )

                changes.update(
                    {
                        "sentry:secondary_grouping_config": current_config,
                        "sentry:secondary_grouping_expiry": transition_expiry,
                    }
                )

            project_option_exists = ProjectOption.objects.filter(
                key="sentry:grouping_config", project_id=project.id
            ).exists()

            for key, value in changes.items():
                project.update_option(key, value)

            create_system_audit_entry(
                organization=project.organization,
                target_object=project.id,
                event=audit_log.get_event_id("PROJECT_EDIT"),
                data={**changes, **project.get_audit_log_data()},
            )

            if current_config == DEFAULT_GROUPING_CONFIG:
                metrics.incr(
                    "grouping.default_config_set",
                    sample_rate=options.get("grouping.config_transition.metrics_sample_rate"),
                    tags={
                        "source": source,
                        "reason": "new_project" if not project.first_event else "backfill",
                    },
                )
                outcome = "record created"
            else:
                metrics.incr(
                    "grouping.outdated_config_updated",
                    sample_rate=options.get("grouping.config_transition.metrics_sample_rate"),
                    tags={
                        "source": source,
                        "current_config": current_config,
                    },
                )
                # TODO: Temporary log to debug how we're still landing in this branch even though
                # theoretically there are no projects on outdated configs
                logger.info(
                    "grouping.outdated_config_updated",
                    extra={
                        "project_id": project.id,
                        "source": source,
                        "current_config": current_config,
                        "project_option_exists": project_option_exists,
                        "options_epoch": project.get_option("sentry:option-epoch"),
                    },
                )
                outcome = "record updated"

            return outcome
    except UnableToAcquireLock:
        return "skipped - race condition"


def is_in_transition(project: Project) -> bool:
    """
    Determine if a project is currently in a grouping transition, i.e., that it has a valid
    secondary grouping config defined and that it's secondary grouping expiry date hasn't passed.
    """
    secondary_grouping_config = project.get_option("sentry:secondary_grouping_config")
    secondary_grouping_expiry = project.get_option("sentry:secondary_grouping_expiry")

    return bool(secondary_grouping_config) and (secondary_grouping_expiry or 0) >= time.time()
