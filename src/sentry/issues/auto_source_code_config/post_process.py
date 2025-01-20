import logging

from sentry import options
from sentry.eventstore.models import GroupEvent
from sentry.locks import locks
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.tasks.auto_source_code_config import auto_source_code_config, derive_code_mappings
from sentry.utils.cache import cache

from .code_mapping import SUPPORTED_LANGUAGES

logger = logging.getLogger(__name__)


def post_process_auto_source_code_config(event: GroupEvent) -> None:
    try:
        project = event.project
        group_id = event.group_id

        # Supported platforms
        if event.data.get("platform") not in SUPPORTED_LANGUAGES:
            return

        if can_process_group(event.organization, event.project, group_id):
            if options.get("system.new-auto-source-code-config-queue"):
                auto_source_code_config.delay(
                    project.id, group_id=group_id, event_id=event.event_id
                )
            else:
                derive_code_mappings.delay(project.id, group_id=group_id, event_id=event.event_id)

    except Exception:
        logger.exception("Failed to process automatic source code config.")


def can_process_group(org: Organization, project: Project, group_id: int) -> bool:
    # To limit the overall number of tasks, only process one issue per project per hour. In
    # order to give the most issues a chance to to be processed, don't reprocess any given
    # issue for at least 24 hours.
    project_key = f"auto_source_code_config:{org.id}:{project.id}"
    group_key = f"auto_source_code_config:{org.id}:{project.id}:{group_id}"
    name = "auto_source_code_config:can_process"

    if cache.get(project_key) is None:
        # We don't want to block the post processing queue for this project for too long
        lock = locks.get(key=project_key, duration=1, name=f"{name}:project")
        with lock.acquire():
            cache.set(project_key, True, 3600)  # 1 hour

        # We don't want to block the post processing queue for this project for too long
        lock = locks.get(key=group_key, duration=1, name=f"{name}:group")
        with lock.acquire():
            cache.set(group_key, True, 86400)  # 24 hours
            return True

    return False
