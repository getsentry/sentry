import logging
from typing import Any, List, Mapping, Sequence, Tuple

import sentry_sdk

from sentry import analytics
from sentry.models.integrations.repository_project_path_config import RepositoryProjectPathConfig
from sentry.ownership.grammar import get_source_code_path_from_stacktrace_path
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils.committers import get_stacktrace_path_from_event_frame

logger = logging.getLogger("sentry.tasks.process_commit_context")


def find_commit_context_for_event(
    code_mappings: Sequence[RepositoryProjectPathConfig],
    frame: Mapping[str, Any],
    extra: Mapping[str, Any],
) -> List[Tuple[Mapping[str, Any], RepositoryProjectPathConfig]]:
    """

    Get all the Commit Context for an event frame using a source code integration for all the matching code mappings
    code_mappings: List of RepositoryProjectPathConfig
    frame: Event frame
    """
    result = []
    for code_mapping in code_mappings:
        if not code_mapping.organization_integration_id:
            logger.info(
                "process_commit_context.no_integration",
                extra={
                    **extra,
                    "code_mapping_id": code_mapping.id,
                },
            )
            continue

        stacktrace_path = get_stacktrace_path_from_event_frame(frame)

        if not stacktrace_path:
            logger.info(
                "process_commit_context.no_stacktrace_path",
                extra={
                    **extra,
                    "code_mapping_id": code_mapping.id,
                },
            )
            continue

        src_path = get_source_code_path_from_stacktrace_path(stacktrace_path, code_mapping)

        # src_path can be none if the stacktrace_path is an invalid filepath
        if not src_path:
            logger.info(
                "process_commit_context.no_src_path",
                extra={
                    **extra,
                    "code_mapping_id": code_mapping.id,
                    "stacktrace_path": stacktrace_path,
                },
            )
            continue

        logger.info(
            "process_commit_context.found_stacktrace_and_src_paths",
            extra={
                **extra,
                "code_mapping_id": code_mapping.id,
                "stacktrace_path": stacktrace_path,
                "src_path": src_path,
            },
        )
        integration = integration_service.get_integration(
            organization_integration_id=code_mapping.organization_integration_id
        )
        install = integration_service.get_installation(
            integration=integration, organization_id=code_mapping.organization_id
        )
        try:
            commit_context = install.get_commit_context(
                code_mapping.repository, src_path, code_mapping.default_branch, frame
            )
        except ApiError as e:
            commit_context = None
            sentry_sdk.capture_exception(e)
            analytics.record(
                "integrations.failed_to_fetch_commit_context",
                organization_id=code_mapping.organization_id,
                project_id=code_mapping.project.id,
                group_id=extra["group"],
                code_mapping_id=code_mapping.id,
                provider=integration.provider,
                error_message=e.text,
            )
            logger.error(
                "process_commit_context.failed_to_fetch_commit_context",
                extra={
                    **extra,
                    "code_mapping_id": code_mapping.id,
                    "stacktrace_path": stacktrace_path,
                    "src_path": src_path,
                    "error_message": e.text,
                },
            )

        if commit_context:
            result.append((commit_context, code_mapping))

    return result
