import logging

from django.conf import settings

from sentry.models.options.project_option import ProjectOption
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import symbolication_tasks

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tasks.console_platform_cleanup.remove_revoked_console_platform_sources",
    namespace=symbolication_tasks,
    silo_mode=SiloMode.REGION,
)
def remove_revoked_console_platform_sources(
    organization_id: int, revoked_platforms: list[str], **kwargs
) -> None:
    """
    Remove symbol sources associated with revoked console platforms from all
    projects in an organization.

    When an organization loses access to a console platform (e.g., nintendo-switch),
    this task removes any builtin symbol sources that are restricted to that platform
    from all projects in the organization.
    """
    # Find which source keys are restricted to the revoked platforms
    source_keys_to_remove: set[str] = set()
    for key, source in settings.SENTRY_BUILTIN_SOURCES.items():
        source_platforms: list[str] | None = source.get("platforms")
        if source_platforms is None:
            continue
        # If all of a source's required platforms have been revoked, remove it
        if all(p in revoked_platforms for p in source_platforms):
            source_keys_to_remove.add(key)

    if not source_keys_to_remove:
        return

    # Find all projects in this org that have explicit builtin symbol sources
    project_options = ProjectOption.objects.filter(
        project__organization_id=organization_id,
        key="sentry:builtin_symbol_sources",
    )

    for option in project_options:
        current_sources: list[str] = option.value or []
        updated_sources = [s for s in current_sources if s not in source_keys_to_remove]

        if updated_sources != current_sources:
            ProjectOption.objects.set_value(option.project_id, option.key, updated_sources)
            logger.info(
                "console_platform_cleanup.removed_sources",
                extra={
                    "organization_id": organization_id,
                    "project_id": option.project_id,
                    "removed_sources": list(source_keys_to_remove & set(current_sources)),
                },
            )
