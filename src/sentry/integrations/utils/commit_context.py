from typing import Any, Mapping, Sequence

import sentry_sdk

from sentry import analytics
from sentry.models.integrations.repository_project_path_config import RepositoryProjectPathConfig
from sentry.ownership.grammar import get_source_code_path_from_stacktrace_path
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils.committers import get_stacktrace_path_from_event_frame


def find_commit_context_for_event(
    code_mappings: Sequence[RepositoryProjectPathConfig],
    frame: Mapping[str, Any],
    logger: Any,
    extra: Mapping[str, Any],
):
    """
    Returns the Commit Context for an event frame using a source code integration, if it exists.
    code_mappings: List of RepositoryProjectPathConfig
    frame: Event frame
    """
    commit_context = None
    selected_code_mapping = None
    for code_mapping in code_mappings:
        if not code_mapping.organization_integration:
            continue

        stacktrace_path = get_stacktrace_path_from_event_frame(frame)

        if not stacktrace_path:
            continue

        src_path = get_source_code_path_from_stacktrace_path(stacktrace_path, code_mapping)

        # src_path can be none if the stacktrace_path is an invalid filepath
        if not src_path:
            continue

        integration = code_mapping.organization_integration.integration
        install = integration.get_installation(
            code_mapping.organization_integration.organization_id
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
                organization_id=code_mapping.organization_integration.organization_id,
                project_id=code_mapping.project.id,
                code_mapping_id=code_mapping.id,
                provider=integration.provider,
                error_message=e.text,
            )

        logger.info(
            "find_commit_context_for_event.integration_fetch",
            extra=(extra or {}).update(
                {
                    "src_path": src_path,
                    "stacktrace_path": stacktrace_path,
                    "code_mapping_id": code_mapping.id,
                    "found": True if commit_context else False,
                }
            ),
        )

        if commit_context:
            selected_code_mapping = code_mapping
            break

    return commit_context, selected_code_mapping
