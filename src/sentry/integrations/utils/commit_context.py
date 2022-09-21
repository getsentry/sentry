from typing import Any, Mapping, Sequence

from sentry.models.integrations.repository_project_path_config import RepositoryProjectPathConfig
from sentry.ownership.grammar import get_source_code_path_from_stacktrace_path


def get_stacktrace_path_from_event_frame(self, frame: Mapping[str, Any]):
    """
    Returns the filepath from a stacktrace's frame.
    frame: Event frame
    """
    return frame.get("munged_filename") or frame.get("filename") or frame.get("abs_path")


def find_commit_context_for_event(
    self, code_mappings: Sequence[RepositoryProjectPathConfig], frame: Mapping[str, Any]
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

        src_path = get_source_code_path_from_stacktrace_path(stacktrace_path, code_mapping)
        integration = code_mapping.organization_integration.integration
        install = integration.get_installation(
            code_mapping.organization_integration.organization_id
        )
        commit_context = install.get_commit_context(
            code_mapping.repository, src_path, code_mapping.default_branch, frame
        )

        if commit_context:
            selected_code_mapping = code_mapping
            break

        return commit_context, selected_code_mapping
