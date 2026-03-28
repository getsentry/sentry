from __future__ import annotations

import hashlib
import logging
from collections.abc import Sequence
from typing import TYPE_CHECKING, TypedDict

from sentry.constants import ObjectStatus
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.integrations.services.integration import integration_service
from sentry.integrations.source_code_management.repository import RepositoryIntegration
from sentry.issues.auto_source_code_config.code_mapping import (
    convert_stacktrace_frame_path_to_source_path,
)
from sentry.lang.javascript.utils import LINES_OF_CONTEXT, get_source_context
from sentry.shared_integrations.exceptions import ApiError, ApiRateLimitedError
from sentry.utils.cache import cache
from sentry.utils.event_frames import EventFrame

if TYPE_CHECKING:
    from sentry.integrations.base import IntegrationInstallation
    from sentry.integrations.services.integration.model import RpcIntegration
    from sentry.issues.endpoints.project_stacktrace_link import StacktraceLinkContext
    from sentry.models.repository import Repository

logger = logging.getLogger(__name__)

# Cache file contents for 1 hour
SOURCE_CONTEXT_CACHE_TTL = 3600


class SourceContextResult(TypedDict):
    context: list[list[int | str]]  # [[lineNo, content], ...]
    error: str | None
    source_url: str | None


def _make_cache_key(org_integration_id: int, repo_id: int, src_path: str, ref: str | None) -> str:
    path_hash = hashlib.md5(f"{src_path}:{ref or ''}".encode()).hexdigest()
    return f"scm-src-ctx:{org_integration_id}:{repo_id}:{path_hash}"


def _format_context(
    pre_context: list[bytes] | None,
    context_line: bytes | None,
    post_context: list[bytes] | None,
    lineno: int,
) -> list[list[int | str]]:
    """Format source context into [[lineNo, content], ...] tuples for the frontend."""
    result: list[list[int | str]] = []

    start_line = lineno - len(pre_context or [])

    if pre_context:
        for i, line in enumerate(pre_context):
            result.append([start_line + i, line.decode("utf-8", errors="replace")])

    if context_line is not None:
        result.append([lineno, context_line.decode("utf-8", errors="replace")])

    if post_context:
        for i, line in enumerate(post_context):
            result.append([lineno + 1 + i, line.decode("utf-8", errors="replace")])

    return result


def _resolve_integration(
    config: RepositoryProjectPathConfig,
) -> tuple[RpcIntegration, RepositoryIntegration] | None:
    """Resolve the integration and installation for a code mapping config."""
    integration = integration_service.get_integration(
        organization_integration_id=config.organization_integration_id,
        status=ObjectStatus.ACTIVE,
    )
    if not integration:
        return None

    install = integration.get_installation(organization_id=config.project.organization_id)
    if not isinstance(install, RepositoryIntegration):
        return None

    return integration, install


def _fetch_file_from_scm(
    install: IntegrationInstallation,
    integration_id: int,
    repository: Repository,
    src_path: str,
    ref: str,
    cache_key: str,
) -> tuple[str | None, str | None]:
    """
    Fetch file content from SCM, using cache when available.

    Returns (file_content, error). If error is "rate_limited", the caller
    should stop iterating entirely.
    """
    file_content: str | None = cache.get(cache_key)
    if file_content is not None:
        return file_content, None

    try:
        client = install.get_client()
    except Exception:
        logger.warning(
            "scm_source_context.get_client_error",
            extra={
                "integration_id": integration_id,
                "src_path": src_path,
            },
            exc_info=True,
        )
        return None, "integration_error"

    try:
        file_content = client.get_file(repository, src_path, ref)
    except NotImplementedError:
        return None, "get_file_not_supported"
    except ApiRateLimitedError:
        return None, "rate_limited"
    except ApiError as e:
        if e.code == 404:
            return None, "file_not_found"
        elif e.code == 403:
            return None, "integration_forbidden"
        else:
            logger.warning(
                "scm_source_context.fetch_error",
                extra={
                    "error": str(e),
                    "integration_id": integration_id,
                    "src_path": src_path,
                },
            )
            return None, "integration_error"

    if file_content is not None:
        cache.set(cache_key, file_content, SOURCE_CONTEXT_CACHE_TTL)

    return file_content, None


def _extract_source_lines(
    file_content: str,
    lineno: int,
    context_lines: int,
) -> tuple[list[list[int | str]], str | None]:
    """
    Extract context lines from file content around the given line number.

    Returns (context, error).
    """
    lines = [line.encode("utf-8") for line in file_content.splitlines()]

    if lineno < 1 or lineno > len(lines):
        return [], "line_out_of_range"

    pre_context, context_line, post_context = get_source_context(lines, lineno, context_lines)

    context = _format_context(pre_context, context_line, post_context, lineno)
    return context, None


def fetch_source_context_from_scm(
    configs: Sequence[RepositoryProjectPathConfig],
    ctx: StacktraceLinkContext,
    context_lines: int = LINES_OF_CONTEXT,
) -> SourceContextResult:
    """
    Fetch source context lines from an SCM integration for a stack trace frame.

    Iterates code mappings to resolve the frame file path to a repository path,
    then fetches the file content via the integration client and extracts the
    surrounding lines. File content is cached for 1 hour.
    """
    result: SourceContextResult = {
        "context": [],
        "error": None,
        "source_url": None,
    }

    line_no_str = ctx.get("line_no")
    if not line_no_str:
        result["error"] = "missing_line_number"
        return result

    try:
        lineno = int(line_no_str)
    except (TypeError, ValueError):
        result["error"] = "invalid_line_number"
        return result

    frame = EventFrame.from_dict(ctx)
    platform = ctx["platform"]
    sdk_name = ctx.get("sdk_name")

    # Resolve integration and install once per unique org_integration_id
    resolved_integrations: dict[int, tuple[RpcIntegration, RepositoryIntegration] | None] = {}

    for config in configs:
        src_path = convert_stacktrace_frame_path_to_source_path(
            frame=frame,
            platform=platform,
            sdk_name=sdk_name,
            code_mapping=config,
        )
        if not src_path:
            continue

        org_integration_id = config.organization_integration_id
        if org_integration_id not in resolved_integrations:
            resolved_integrations[org_integration_id] = _resolve_integration(config)

        resolved = resolved_integrations[org_integration_id]
        if resolved is None:
            continue

        integration, install = resolved

        ref = ctx.get("commit_id") or str(config.default_branch or "")

        cache_key = _make_cache_key(
            org_integration_id,
            config.repository_id,
            src_path,
            ref,
        )

        file_content, fetch_error = _fetch_file_from_scm(
            install, integration.id, config.repository, src_path, ref, cache_key
        )

        if fetch_error:
            result["error"] = fetch_error
            if fetch_error == "rate_limited":
                return result
            continue

        if file_content is None:
            continue

        context, extract_error = _extract_source_lines(file_content, lineno, context_lines)
        if extract_error:
            result["error"] = extract_error
            continue

        result["context"] = context
        result["error"] = None

        try:
            source_url = install.get_stacktrace_link(
                config.repository, src_path, str(config.default_branch or ""), ctx.get("commit_id")
            )
            result["source_url"] = source_url
        except ApiError:
            pass

        return result

    if not result["error"]:
        result["error"] = "no_code_mapping_match"
    return result
