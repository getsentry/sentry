import logging
from typing import cast

from django.conf import settings

from sentry.models.options.project_option import ProjectOption
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import symbolication_tasks

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tasks.console_platform_cleanup.remove_inaccessible_console_platform_sources",
    namespace=symbolication_tasks,
    silo_mode=SiloMode.CELL,
)
def remove_inaccessible_console_platform_sources(
    organization_id: int, current_platforms: list[str], **kwargs
) -> None:
    """
    Remove symbol sources that the organization can no longer access from all
    projects in the organization.

    Called when console platform access is revoked.  ``current_platforms`` is the
    set of console platforms the organization still has access to *after* the
    revocation.  Any builtin source whose required platforms are all absent from
    this list is removed from every project's ``sentry:builtin_symbol_sources``.
    """
    # A source is accessible when the org has access to *any* of its platforms
    # (mirroring BuiltinSymbolSourcesEndpoint), so remove it when the org has
    # access to *none* of them.
    current_platform_set = set(current_platforms)
    source_keys_to_remove: set[str] = set()
    for key, source in settings.SENTRY_BUILTIN_SOURCES.items():
        source_platforms: list[str] | None = cast("list[str] | None", source.get("platforms"))
        if source_platforms is None:
            continue
        if not current_platform_set.intersection(source_platforms):
            source_keys_to_remove.add(key)

    if not source_keys_to_remove:
        return

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
