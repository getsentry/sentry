from __future__ import annotations

import datetime
import logging
import uuid
from collections.abc import Callable
from typing import Any

import sentry_sdk
from django.db import router, transaction
from django.utils import timezone

from sentry.models.commitcomparison import CommitComparison
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.preprod.models import (
    PreprodArtifact,
    PreprodArtifactSizeComparison,
    PreprodArtifactSizeMetrics,
    PreprodBuildConfiguration,
)
from sentry.preprod.producer import produce_preprod_artifact_to_kafka
from sentry.preprod.size_analysis.models import SizeAnalysisResults
from sentry.preprod.size_analysis.tasks import compare_preprod_artifact_size_analysis
from sentry.preprod.vcs.status_checks.size.tasks import create_preprod_status_check_task
from sentry.silo.base import SiloMode
from sentry.tasks.assemble import (
    AssembleResult,
    AssembleTask,
    ChunkFileState,
    assemble_file,
    get_assemble_status,
    set_assemble_status,
)
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import attachments_tasks, preprod_tasks
from sentry.taskworker.retry import Retry
from sentry.utils.sdk import bind_organization_context

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.preprod.tasks.assemble_preprod_artifact",
    retry=Retry(times=3),
    namespace=attachments_tasks,
    processing_deadline_duration=30,
    silo_mode=SiloMode.REGION,
)
def assemble_preprod_artifact(
    org_id: int,
    project_id: int,
    checksum: Any,
    chunks: Any,
    artifact_id: int,
    **kwargs: Any,
) -> None:
    """
    Creates a preprod artifact from uploaded chunks.
    """
    logger.info(
        "Starting preprod artifact assembly",
        extra={
            "timestamp": datetime.datetime.now().isoformat(),
            "project_id": project_id,
            "organization_id": org_id,
            "checksum": checksum,
        },
    )

    try:
        organization = Organization.objects.get_from_cache(pk=org_id)
        project = Project.objects.get(id=project_id, organization=organization)
        bind_organization_context(organization)

        assemble_result = assemble_file(
            task=AssembleTask.PREPROD_ARTIFACT,
            org_or_project=project,
            name=f"preprod-artifact-{uuid.uuid4().hex}",
            checksum=checksum,
            chunks=chunks,
            file_type="preprod.artifact",
        )

        if assemble_result is None:
            raise RuntimeError(
                f"Assemble result is None for preprod artifact assembly (project_id={project_id}, organization_id={org_id}, checksum={checksum}, preprod_artifact_id={artifact_id})"
            )

        logger.info(
            "Finished preprod artifact assembly",
            extra={
                "project_id": project_id,
                "organization_id": org_id,
                "checksum": checksum,
                "preprod_artifact_id": artifact_id,
            },
        )

        PreprodArtifact.objects.filter(id=artifact_id).update(
            file_id=assemble_result.bundle.id,
            state=PreprodArtifact.ArtifactState.UPLOADED,
        )

    except Exception as e:
        user_friendly_error_message = "Failed to assemble preprod artifact"
        sentry_sdk.capture_exception(e)
        logger.exception(
            user_friendly_error_message,
            extra={
                "project_id": project_id,
                "organization_id": org_id,
                "checksum": checksum,
                "preprod_artifact_id": artifact_id,
            },
        )
        PreprodArtifact.objects.filter(id=artifact_id).update(
            state=PreprodArtifact.ArtifactState.FAILED,
            error_code=PreprodArtifact.ErrorCode.ARTIFACT_PROCESSING_ERROR,
            error_message=user_friendly_error_message,
        )
        create_preprod_status_check_task.apply_async(
            kwargs={
                "preprod_artifact_id": artifact_id,
            }
        )

        return

    try:
        produce_preprod_artifact_to_kafka(
            project_id=project_id,
            organization_id=org_id,
            artifact_id=artifact_id,
        )
    except Exception as e:
        user_friendly_error_message = "Failed to dispatch preprod artifact event for analysis"
        sentry_sdk.capture_exception(e)
        logger.exception(
            user_friendly_error_message,
            extra={
                "project_id": project_id,
                "organization_id": org_id,
                "checksum": checksum,
                "preprod_artifact_id": artifact_id,
            },
        )
        PreprodArtifact.objects.filter(id=artifact_id).update(
            state=PreprodArtifact.ArtifactState.FAILED,
            error_code=PreprodArtifact.ErrorCode.ARTIFACT_PROCESSING_ERROR,
            error_message=user_friendly_error_message,
        )
        create_preprod_status_check_task.apply_async(
            kwargs={
                "preprod_artifact_id": artifact_id,
            }
        )
        return

    logger.info(
        "Finished preprod artifact row creation and kafka dispatch",
        extra={
            "preprod_artifact_id": artifact_id,
            "project_id": project_id,
            "organization_id": org_id,
            "checksum": checksum,
        },
    )


def create_preprod_artifact(
    org_id,
    project_id,
    checksum,
    build_configuration=None,
    release_notes=None,
    head_sha=None,
    base_sha=None,
    provider=None,
    head_repo_name=None,
    base_repo_name=None,
    head_ref=None,
    base_ref=None,
    pr_number=None,
) -> PreprodArtifact | None:
    try:
        organization = Organization.objects.get_from_cache(pk=org_id)
        project = Project.objects.get(id=project_id, organization=organization)
        bind_organization_context(organization)

        with transaction.atomic(router.db_for_write(PreprodArtifact)):
            # Create CommitComparison if git information is provided
            commit_comparison = None
            if head_sha and head_repo_name and provider and head_ref:
                commit_comparison, _ = CommitComparison.objects.get_or_create(
                    organization_id=org_id,
                    head_sha=head_sha,
                    base_sha=base_sha,
                    provider=provider,
                    head_repo_name=head_repo_name,
                    base_repo_name=base_repo_name,
                    head_ref=head_ref,
                    base_ref=base_ref,
                    pr_number=pr_number,
                )
            else:
                logger.info(
                    "Skipping commit comparison creation because required vcs information is not provided",
                    extra={
                        "project_id": project_id,
                        "organization_id": org_id,
                        "head_sha": head_sha,
                        "head_repo_name": head_repo_name,
                        "provider": provider,
                        "head_ref": head_ref,
                        "base_sha": base_sha,
                        "base_repo_name": base_repo_name,
                        "base_ref": base_ref,
                        "pr_number": pr_number,
                    },
                )

            build_config = None
            if build_configuration:
                build_config, _ = PreprodBuildConfiguration.objects.get_or_create(
                    project=project,
                    name=build_configuration,
                )

            # Prepare extras data if release_notes is provided
            extras = None
            if release_notes:
                extras = {"release_notes": release_notes}

            preprod_artifact, _ = PreprodArtifact.objects.get_or_create(
                project=project,
                build_configuration=build_config,
                state=PreprodArtifact.ArtifactState.UPLOADING,
                commit_comparison=commit_comparison,
                extras=extras,
            )

            # TODO(preprod): add gating to only create if has quota
            PreprodArtifactSizeMetrics.objects.get_or_create(
                preprod_artifact=preprod_artifact,
                metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
                defaults={
                    "state": PreprodArtifactSizeMetrics.SizeAnalysisState.PENDING,
                },
            )

            logger.info(
                "Created preprod artifact row",
                extra={
                    "preprod_artifact_id": preprod_artifact.id,
                    "project_id": project_id,
                    "organization_id": org_id,
                    "checksum": checksum,
                },
            )

            return preprod_artifact

    except Exception as e:
        sentry_sdk.capture_exception(e)
        logger.exception(
            "Failed to create preprod artifact row",
            extra={
                "project_id": project_id,
                "organization_id": org_id,
                "checksum": checksum,
            },
        )
        return None


def _assemble_preprod_artifact_file(
    assemble_task: str,
    project_id: int,
    org_id: int,
    checksum: str,
    chunks: Any,
    callback: Callable[[AssembleResult, Any], None],
):
    logger.info(
        "Starting preprod file assembly",
        extra={
            "organization_id": org_id,
            "project_id": project_id,
            "assemble_task": assemble_task,
            "checksum": checksum,
        },
    )

    try:
        organization = Organization.objects.get_from_cache(pk=org_id)
        project = Project.objects.get(id=project_id, organization=organization)
        bind_organization_context(organization)

        set_assemble_status(
            assemble_task,
            project_id,
            checksum,
            ChunkFileState.ASSEMBLING,
        )

        assemble_result = assemble_file(
            task=assemble_task,
            org_or_project=project,
            name=f"preprod-file-{assemble_task}-{uuid.uuid4().hex}",
            checksum=checksum,
            chunks=chunks,
            file_type="preprod.file",
        )
        if assemble_result is None:
            state, detail = get_assemble_status(assemble_task, project_id, checksum)
            logger.error(
                "Failed to assemble preprod file",
                extra={
                    "organization_id": org_id,
                    "project_id": project_id,
                    "assemble_task": assemble_task,
                    "checksum": checksum,
                    "detail": detail,
                    "state": state,
                },
            )
            return

        callback(assemble_result, project)
    except Exception as e:
        logger.exception(
            "Failed to assemble preprod file",
            extra={
                "organization_id": org_id,
                "project_id": project_id,
                "assemble_task": assemble_task,
                "checksum": checksum,
            },
        )
        set_assemble_status(
            assemble_task,
            project_id,
            checksum,
            ChunkFileState.ERROR,
            detail=str(e),
        )
    else:
        set_assemble_status(assemble_task, project_id, checksum, ChunkFileState.OK)


def _assemble_preprod_artifact_size_analysis(
    assemble_result: AssembleResult, project, artifact_id: int, org_id: int
):
    preprod_artifact = None
    try:
        preprod_artifact = PreprodArtifact.objects.get(
            project=project,
            id=artifact_id,
        )
    except PreprodArtifact.DoesNotExist:
        # Ideally this should never happen
        logger.exception(
            "PreprodArtifact not found during size analysis assembly",
            extra={
                "preprod_artifact_id": artifact_id,
                "project_id": project.id,
                "organization_id": org_id,
            },
        )
        # Clean up the assembled file since we can't associate it with an artifact
        try:
            # Close the temporary file handle first
            if hasattr(assemble_result, "bundle_temp_file") and assemble_result.bundle_temp_file:
                assemble_result.bundle_temp_file.close()
            # Then delete the file object
            assemble_result.bundle.delete()
        except Exception:
            pass  # Ignore cleanup errors
        raise Exception(f"PreprodArtifact with id {artifact_id} does not exist")

    try:
        size_analysis_results = SizeAnalysisResults.parse_raw(
            assemble_result.bundle_temp_file.read()
        )

        with transaction.atomic(router.db_for_write(PreprodArtifactSizeMetrics)):
            # TODO(preprod): parse this from the treemap json and handle other artifact types
            size_metrics, created = PreprodArtifactSizeMetrics.objects.update_or_create(
                preprod_artifact=preprod_artifact,
                metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
                defaults={
                    "analysis_file_id": assemble_result.bundle.id,
                    "min_install_size": None,  # No min value at this time
                    "max_install_size": size_analysis_results.install_size,
                    "min_download_size": None,  # No min value at this time
                    "max_download_size": size_analysis_results.download_size,
                    "processing_version": size_analysis_results.analysis_version,
                    "state": PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
                },
            )

        # Trigger size analysis comparison if eligible
        logger.info(
            "Created or updated preprod artifact size metrics with analysis file",
            extra={
                "preprod_artifact_id": preprod_artifact.id,
                "size_metrics_id": size_metrics.id,
                "analysis_file_id": assemble_result.bundle.id,
                "was_created": created,
                "project_id": project.id,
                "organization_id": org_id,
            },
        )

    except Exception as e:
        logger.exception(
            "Failed to process size analysis results",
            extra={
                "preprod_artifact_id": artifact_id,
                "project_id": project.id,
                "organization_id": org_id,
            },
        )

        with transaction.atomic(router.db_for_write(PreprodArtifactSizeMetrics)):
            try:
                PreprodArtifactSizeMetrics.objects.update_or_create(
                    preprod_artifact=preprod_artifact,
                    metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
                    defaults={
                        "state": PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED,
                        "error_code": PreprodArtifactSizeMetrics.ErrorCode.PROCESSING_ERROR,
                        "error_message": str(e),
                    },
                )
            except Exception:
                logger.exception(
                    "Failed to update preprod artifact size metrics",
                    extra={
                        "preprod_artifact_id": artifact_id,
                        "project_id": project.id,
                        "organization_id": org_id,
                    },
                )

        # Re-raise to trigger further error handling if needed
        raise

    # Always trigger status check update (success or failure)
    create_preprod_status_check_task.apply_async(
        kwargs={
            "preprod_artifact_id": artifact_id,
        }
    )

    # Trigger size analysis comparison if eligible
    compare_preprod_artifact_size_analysis.apply_async(
        kwargs={
            "project_id": project.id,
            "org_id": org_id,
            "artifact_id": artifact_id,
        }
    )


@instrumented_task(
    name="sentry.preprod.tasks.assemble_preprod_artifact_size_analysis",
    namespace=attachments_tasks,
    processing_deadline_duration=30,
    silo_mode=SiloMode.REGION,
)
def assemble_preprod_artifact_size_analysis(
    org_id,
    project_id,
    checksum,
    chunks,
    artifact_id=None,
    **kwargs,
) -> None:
    """
    Creates a size analysis file for a preprod artifact from uploaded chunks.
    """
    _assemble_preprod_artifact_file(
        AssembleTask.PREPROD_ARTIFACT_SIZE_ANALYSIS,
        project_id,
        org_id,
        checksum,
        chunks,
        lambda assemble_result, project: _assemble_preprod_artifact_size_analysis(
            assemble_result, project, artifact_id, org_id
        ),
    )


def _assemble_preprod_artifact_installable_app(
    assemble_result: AssembleResult, project, artifact_id, org_id
):
    try:
        preprod_artifact = PreprodArtifact.objects.get(
            project=project,
            id=artifact_id,
        )
    except PreprodArtifact.DoesNotExist:
        # Ideally this should never happen
        logger.exception(
            "PreprodArtifact not found during installable app assembly",
            extra={
                "artifact_id": artifact_id,
                "project_id": project.id,
                "organization_id": org_id,
            },
        )
        # Clean up the assembled file since we can't associate it with an artifact
        try:
            # Close the temporary file handle first
            if hasattr(assemble_result, "bundle_temp_file") and assemble_result.bundle_temp_file:
                assemble_result.bundle_temp_file.close()
            # Then delete the file object
            assemble_result.bundle.delete()
        except Exception:
            pass  # Ignore cleanup errors
        raise Exception(f"PreprodArtifact with id {artifact_id} does not exist")

    # Update artifact state in its own transaction with proper database routing
    with transaction.atomic(router.db_for_write(PreprodArtifact)):
        preprod_artifact.installable_app_file_id = assemble_result.bundle.id
        preprod_artifact.save(update_fields=["installable_app_file_id", "date_updated"])


@instrumented_task(
    name="sentry.preprod.tasks.assemble_preprod_artifact_installable_app",
    namespace=attachments_tasks,
    processing_deadline_duration=30,
    silo_mode=SiloMode.REGION,
)
def assemble_preprod_artifact_installable_app(
    org_id, project_id, checksum, chunks, artifact_id, **kwargs
):
    _assemble_preprod_artifact_file(
        AssembleTask.PREPROD_ARTIFACT_INSTALLABLE_APP,
        project_id,
        org_id,
        checksum,
        chunks,
        lambda assemble_result, project: _assemble_preprod_artifact_installable_app(
            assemble_result, project, artifact_id, org_id
        ),
    )


@instrumented_task(
    name="sentry.preprod.tasks.detect_expired_preprod_artifacts",
    namespace=preprod_tasks,
    processing_deadline_duration=60,
    silo_mode=SiloMode.REGION,
)
def detect_expired_preprod_artifacts():
    """
    Detects PreprodArtifacts and related entities that have been processing for more than 30 minutes
    and updates their state to errored.

    This includes:
    - PreprodArtifacts that have been processing for more than 30 minutes
    - PreprodArtifactSizeMetrics that have been in progress for more than 30 minutes
    - PreprodArtifactSizeComparisons that have been in progress for more than 30 minutes
    """
    current_time = timezone.now()
    timeout_threshold = current_time - datetime.timedelta(minutes=30)

    logger.info(
        "preprod.tasks.detect_expired_preprod_artifacts.starting",
        extra={
            "current_time": current_time.isoformat(),
            "timeout_threshold": timeout_threshold.isoformat(),
        },
    )

    # note: looks for date_updated rather than date_added just to keep things more conservative for now
    expired_artifacts = PreprodArtifact.objects.filter(
        state__in=[PreprodArtifact.ArtifactState.UPLOADING, PreprodArtifact.ArtifactState.UPLOADED],
        date_updated__lte=timeout_threshold,
    )

    expired_artifacts_count = 0
    updated_artifact_ids = []

    try:
        with transaction.atomic(router.db_for_write(PreprodArtifact)):
            expired_artifact_ids = list(expired_artifacts.values_list("id", flat=True))

            expired_artifacts_count = expired_artifacts.update(
                state=PreprodArtifact.ArtifactState.FAILED,
                error_code=PreprodArtifact.ErrorCode.ARTIFACT_PROCESSING_TIMEOUT,
                error_message="Artifact processing timed out after 30 minutes",
            )

            if expired_artifacts_count > 0:
                logger.info(
                    "preprod.tasks.detect_expired_preprod_artifacts.batch_updated_expired_artifacts_as_failed",
                    extra={
                        "expired_artifacts_count": expired_artifacts_count,
                    },
                )
                updated_artifact_ids = expired_artifact_ids
    except Exception:
        logger.exception(
            "preprod.tasks.detect_expired_preprod_artifacts.failed_to_batch_update_expired_artifacts",
        )
        expired_artifacts_count = 0
        updated_artifact_ids = []

    if updated_artifact_ids:
        for artifact_id in updated_artifact_ids:
            try:
                create_preprod_status_check_task.apply_async(
                    kwargs={"preprod_artifact_id": artifact_id}
                )
            except Exception:
                logger.exception(
                    "preprod.tasks.detect_expired_preprod_artifacts.failed_to_trigger_status_check",
                    extra={"artifact_id": artifact_id},
                )

    # Find expired PreprodArtifactSizeMetrics (those in PROCESSING state for more than 30 minutes)
    # Note: ignore size metrics in a pending state
    expired_size_metrics = PreprodArtifactSizeMetrics.objects.filter(
        state=PreprodArtifactSizeMetrics.SizeAnalysisState.PROCESSING,
        date_updated__lte=timeout_threshold,
    )

    try:
        with transaction.atomic(router.db_for_write(PreprodArtifactSizeMetrics)):
            expired_size_metrics_count = expired_size_metrics.update(
                state=PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED,
                error_code=PreprodArtifactSizeMetrics.ErrorCode.TIMEOUT,
                error_message="Size analysis processing timed out after 30 minutes",
            )

            if expired_size_metrics_count > 0:
                logger.info(
                    "preprod.tasks.detect_expired_preprod_artifacts.batch_updated_expired_size_metrics_as_failed",
                    extra={
                        "expired_size_metrics_count": expired_size_metrics_count,
                    },
                )
    except Exception:
        logger.exception(
            "preprod.tasks.detect_expired_preprod_artifacts.failed_to_batch_update_expired_size_metrics",
        )
        expired_size_metrics_count = 0

    # Find expired PreprodArtifactSizeComparisons (those in PROCESSING state for more than 30 minutes)
    # Note: ignore size comparisons in a pending state
    expired_size_comparisons = PreprodArtifactSizeComparison.objects.filter(
        state=PreprodArtifactSizeComparison.State.PROCESSING, date_updated__lte=timeout_threshold
    )

    try:
        with transaction.atomic(router.db_for_write(PreprodArtifactSizeComparison)):
            expired_size_comparisons_count = expired_size_comparisons.update(
                state=PreprodArtifactSizeComparison.State.FAILED,
                error_code=PreprodArtifactSizeComparison.ErrorCode.TIMEOUT,
                error_message="Size comparison processing timed out after 30 minutes",
            )

            if expired_size_comparisons_count > 0:
                logger.info(
                    "preprod.tasks.detect_expired_preprod_artifacts.batch_updated_expired_size_comparisons_as_failed",
                    extra={
                        "expired_size_comparisons_count": expired_size_comparisons_count,
                    },
                )
    except Exception:
        logger.exception(
            "preprod.tasks.detect_expired_preprod_artifacts.failed_to_batch_update_expired_size_comparisons",
        )
        expired_size_comparisons_count = 0

    logger.info(
        "preprod.tasks.detect_expired_preprod_artifacts.completed",
        extra={
            "expired_artifacts_count": expired_artifacts_count,
            "expired_size_metrics_count": expired_size_metrics_count,
            "expired_size_comparisons_count": expired_size_comparisons_count,
            "total_expired_count": expired_artifacts_count
            + expired_size_metrics_count
            + expired_size_comparisons_count,
        },
    )
