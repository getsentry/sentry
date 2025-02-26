from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from dataclasses import asdict
from datetime import datetime, timedelta, timezone
from typing import Any

from django.utils.datastructures import OrderedSet

from sentry import analytics
from sentry.constants import ObjectStatus
from sentry.integrations.base import IntegrationInstallation
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.integrations.services.integration import integration_service
from sentry.integrations.source_code_management.commit_context import (
    CommitContextIntegration,
    FileBlameInfo,
    SourceLineInfo,
)
from sentry.issues.auto_source_code_config.code_mapping import (
    convert_stacktrace_frame_path_to_source_path,
)
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils import metrics
from sentry.utils.committers import get_stacktrace_path_from_event_frame
from sentry.utils.event_frames import EventFrame

logger = logging.getLogger("sentry.tasks.process_commit_context")


def find_commit_context_for_event_all_frames(
    code_mappings: Sequence[RepositoryProjectPathConfig],
    frames: Sequence[Mapping[str, Any]],
    organization_id: int,
    project_id: int,
    platform: str,
    sdk_name: str | None,
    extra: Mapping[str, Any],
) -> tuple[FileBlameInfo | None, IntegrationInstallation | None]:
    """
    Given a list of event frames and code mappings, finds the most recent commit.
    Will also emit analytics events for success or failure.
    """
    valid_frames = list(
        OrderedSet(
            [
                EventFrame.from_dict(frame)
                for frame in frames
                if frame.get("lineno") is not None and frame.get("in_app")
            ]
        )
    )

    (
        integration_to_files_mapping,
        num_successfully_mapped_frames,
    ) = _generate_integration_to_files_mapping(
        frames=valid_frames,
        code_mappings=code_mappings,
        platform=platform,
        sdk_name=sdk_name,
        extra=extra,
    )

    file_blames, integration_to_install_mapping = _get_blames_from_all_integrations(
        integration_to_files_mapping=integration_to_files_mapping,
        organization_id=organization_id,
        project_id=project_id,
        extra=extra,
    )

    most_recent_blame = max(file_blames, key=lambda blame: blame.commit.committedDate, default=None)
    # Only return suspect commits that are less than a year old
    selected_blame = (
        most_recent_blame
        if most_recent_blame and is_date_less_than_year(most_recent_blame.commit.committedDate)
        else None
    )

    selected_install, selected_provider = (
        integration_to_install_mapping[selected_blame.code_mapping.organization_integration_id]
        if selected_blame
        else (None, None)
    )

    _record_commit_context_all_frames_analytics(
        selected_blame=selected_blame,
        most_recent_blame=most_recent_blame,
        organization_id=organization_id,
        project_id=project_id,
        extra=extra,
        frames=valid_frames,
        file_blames=file_blames,
        num_successfully_mapped_frames=num_successfully_mapped_frames,
        selected_provider=selected_provider,
        platform=platform,
        sdk_name=sdk_name,
    )

    return (selected_blame, selected_install)


def is_date_less_than_year(date: datetime) -> bool:
    return date > datetime.now(tz=timezone.utc) - timedelta(days=365)


def get_or_create_commit_from_blame(
    blame: FileBlameInfo, organization_id: int, extra: Mapping[str, str | int]
) -> Commit:
    """
    From a blame object, see if a matching commit already exists in sentry_commit.
    If not, create it.
    """
    try:
        commit = Commit.objects.get(
            repository_id=blame.repo.id,
            key=blame.commit.commitId,
        )
        if commit.message == "":
            commit.message = blame.commit.commitMessage
            commit.save()

        return commit
    except Commit.DoesNotExist:
        logger.info(
            "process_commit_context_all_frames.no_commit_in_sentry",
            extra={
                **extra,
                "sha": blame.commit.commitId,
                "repository_id": blame.repo.id,
                "code_mapping_id": blame.code_mapping.id,
                "reason": "commit_sha_does_not_exist_in_sentry",
            },
        )

        # If a commit does not exist in sentry_commit, we will add it
        commit_author, _ = CommitAuthor.objects.get_or_create(
            organization_id=organization_id,
            email=blame.commit.commitAuthorEmail,
            defaults={"name": blame.commit.commitAuthorName},
        )
        commit = Commit.objects.create(
            organization_id=organization_id,
            repository_id=blame.repo.id,
            key=blame.commit.commitId,
            date_added=blame.commit.committedDate,
            author=commit_author,
            message=blame.commit.commitMessage,
        )

        logger.info(
            "process_commit_context_all_frames.added_commit_to_sentry_commit",
            extra={
                **extra,
                "sha": blame.commit.commitId,
                "repository_id": blame.repo.id,
                "code_mapping_id": blame.code_mapping.id,
                "reason": "commit_sha_does_not_exist_in_sentry_for_all_code_mappings",
            },
        )

        return commit


def _generate_integration_to_files_mapping(
    frames: Sequence[EventFrame],
    code_mappings: Sequence[RepositoryProjectPathConfig],
    platform: str,
    sdk_name: str | None,
    extra: Mapping[str, Any],
) -> tuple[dict[int, list[SourceLineInfo]], int]:
    """
    Because a single stack trace can be mapped to multiple integrations,
    this function is used to separate files into each integration so that
    we can later call get_commit_context_all_frames on each integration.
    """
    integration_to_files_mapping: dict[int, list[SourceLineInfo]] = {}
    num_successfully_mapped_frames = 0

    for frame in frames:
        for code_mapping in code_mappings:
            stacktrace_path = get_stacktrace_path_from_event_frame(asdict(frame))

            if not stacktrace_path:
                logger.info(
                    "process_commit_context_all_frames.no_stacktrace_path",
                    extra={
                        **extra,
                        "code_mapping_id": code_mapping.id,
                    },
                )
                continue

            src_path = convert_stacktrace_frame_path_to_source_path(
                frame=frame, platform=platform, sdk_name=sdk_name, code_mapping=code_mapping
            )

            if not src_path:
                logger.info(
                    "process_commit_context_all_frames.code_mapping_stack_root_mismatch",
                    extra={
                        **extra,
                        "code_mapping_id": code_mapping.id,
                        "stacktrace_path": stacktrace_path,
                        "stack_root": code_mapping.stack_root,
                    },
                )
                continue

            if "\\" in src_path or '"' in src_path:
                logger.info(
                    "process_commit_context_all_frames.invalid_src_path",
                    extra={
                        **extra,
                        "code_mapping_id": code_mapping.id,
                        "stacktrace_path": stacktrace_path,
                        "src_path": src_path,
                    },
                )
                continue

            num_successfully_mapped_frames += 1
            logger.info(
                "process_commit_context_all_frames.found_stacktrace_and_src_paths",
                extra={
                    **extra,
                    "code_mapping_id": code_mapping.id,
                    "stacktrace_path": stacktrace_path,
                    "src_path": src_path,
                },
            )

            files = integration_to_files_mapping.setdefault(
                code_mapping.organization_integration_id, []
            )
            files.append(
                SourceLineInfo(
                    lineno=frame.lineno,
                    path=src_path,
                    ref=code_mapping.default_branch or "master",
                    repo=code_mapping.repository,
                    code_mapping=code_mapping,
                )
            )
            break

    return integration_to_files_mapping, num_successfully_mapped_frames


def _get_blames_from_all_integrations(
    integration_to_files_mapping: dict[int, list[SourceLineInfo]],
    organization_id: int,
    project_id: int,
    extra: Mapping[str, Any],
) -> tuple[list[FileBlameInfo], dict[int, tuple[IntegrationInstallation, str]]]:
    """
    Calls get_commit_context_all_frames for each integration, using the file
    list provided for the integration ID, and returns a combined list of
    file blames.
    """
    file_blames: list[FileBlameInfo] = []
    integration_to_install_mapping: dict[int, tuple[IntegrationInstallation, str]] = {}

    for integration_organization_id, files in integration_to_files_mapping.items():
        # find active integrations, otherwise integration proxy will not send request
        integration = integration_service.get_integration(
            organization_integration_id=integration_organization_id, status=ObjectStatus.ACTIVE
        )
        if not integration:
            continue
        log_info = {
            **extra,
            "project_id": project_id,
            "provider": integration.provider,
            "integration_id": integration.id,
        }
        install = integration.get_installation(organization_id=organization_id)
        if not isinstance(install, CommitContextIntegration):
            logger.info("process_commit_context_all_frames.unsupported_integration", extra=log_info)
            continue
        integration_to_install_mapping[integration_organization_id] = (
            install,
            integration.provider,
        )
        with metrics.timer(
            "tasks.process_commit_context_all_frames.get_commit_context",
            tags={"provider": integration.provider},
        ):
            try:
                blames = install.get_commit_context_all_frames(files, extra=extra)
                file_blames.extend(blames)
            except ApiError as e:
                metrics.incr(
                    "tasks.process_commit_context_all_frames.api_error", tags={"status": e.code}
                )
                if e.code in (401, 403, 404):
                    # Expected errors statuses should not be retried
                    logger.warning(
                        "process_commit_context_all_frames.get_commit_context_all_frames.api_error",
                        extra={**log_info, "code": e.code, "error_message": e.text},
                    )
                else:
                    if e.code == 429:
                        logger.exception(
                            "process_commit_context_all_frames.get_commit_context_all_frames.rate_limit",
                            extra={**log_info, "error_message": e.text},
                        )
                    else:
                        logger.exception(
                            "process_commit_context_all_frames.get_commit_context_all_frames.api_error",
                            extra={**log_info, "code": e.code, "error_message": e.text},
                        )
                    # Rate limit and other API errors should be raised to the task to trigger a retry
                    raise
            except Exception:
                logger.exception(
                    "process_commit_context_all_frames.get_commit_context_all_frames.unknown_error",
                    extra=log_info,
                )

    return file_blames, integration_to_install_mapping


def _record_commit_context_all_frames_analytics(
    selected_blame: FileBlameInfo | None,
    most_recent_blame: FileBlameInfo | None,
    organization_id: int,
    project_id: int,
    extra: Mapping[str, Any],
    frames: Sequence[EventFrame],
    file_blames: Sequence[FileBlameInfo],
    num_successfully_mapped_frames: int,
    selected_provider: str | None,
    platform: str,
    sdk_name: str | None,
):
    if not selected_blame:
        reason = _get_failure_reason(
            num_successfully_mapped_frames=num_successfully_mapped_frames,
            has_old_blames=most_recent_blame is not None and not selected_blame,
        )
        metrics.incr(
            "tasks.process_commit_context_all_frames.aborted",
            tags={"detail": reason},
        )
        logger.info(
            "process_commit_context_all_frames.find_commit_context_failed",
            extra={
                **extra,
                "project_id": project_id,
                "reason": reason,
                "num_frames": len(frames),
            },
        )
        analytics.record(
            "integrations.failed_to_fetch_commit_context_all_frames",
            organization_id=organization_id,
            project_id=project_id,
            group_id=extra["group"],
            event_id=extra["event"],
            num_frames=len(frames),
            num_successfully_mapped_frames=num_successfully_mapped_frames,
            reason=reason,
        )
        return

    unique_commit_ids = {blame.commit.commitId for blame in file_blames}
    unique_author_emails = {blame.commit.commitAuthorEmail for blame in file_blames}
    selected_frame_index = next(
        (
            i
            for i, frame in enumerate(frames)
            if frame.lineno == selected_blame.lineno
            and convert_stacktrace_frame_path_to_source_path(
                frame=frame,
                platform=platform,
                sdk_name=sdk_name,
                code_mapping=selected_blame.code_mapping,
            )
            == selected_blame.path
        ),
        None,
    )

    analytics.record(
        "integrations.successfully_fetched_commit_context_all_frames",
        organization_id=organization_id,
        project_id=project_id,
        group_id=extra["group"],
        event_id=extra["event"],
        num_frames=len(frames),
        num_unique_commits=len(unique_commit_ids),
        num_unique_commit_authors=len(unique_author_emails),
        num_successfully_mapped_frames=num_successfully_mapped_frames,
        selected_frame_index=selected_frame_index,
        selected_provider=selected_provider,
        selected_code_mapping_id=selected_blame.code_mapping.id,
    )


def _get_failure_reason(num_successfully_mapped_frames: int, has_old_blames: bool):
    if num_successfully_mapped_frames < 1:
        return "no_successful_code_mapping"
    if has_old_blames:
        return "commit_too_old"
    return "no_commit_found"
