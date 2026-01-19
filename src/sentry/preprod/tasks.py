from __future__ import annotations

import datetime
import logging
import uuid
from collections.abc import Callable
from typing import Any

import sentry_sdk
from django.db import router, transaction
from django.utils import timezone

from sentry import features
from sentry.constants import DataCategory
from sentry.models.commitcomparison import CommitComparison
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.preprod.eap.write import (
    produce_preprod_build_distribution_to_eap,
    produce_preprod_size_metric_to_eap,
)
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
from sentry.taskworker.namespaces import preprod_tasks
from sentry.taskworker.retry import Retry
from sentry.utils import metrics
from sentry.utils.outcomes import Outcome, track_outcome
from sentry.utils.sdk import bind_organization_context

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.preprod.tasks.assemble_preprod_artifact",
    retry=Retry(times=3),
    namespace=preprod_tasks,
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
            "organization_slug": organization.slug,
            "checksum": checksum,
        },
    )


def create_preprod_artifact(
    org_id: int,
    project_id: int,
    checksum: str,
    build_configuration_name: str | None = None,
    release_notes: str | None = None,
    head_sha: str | None = None,
    base_sha: str | None = None,
    provider: str | None = None,
    head_repo_name: str | None = None,
    base_repo_name: str | None = None,
    head_ref: str | None = None,
    base_ref: str | None = None,
    pr_number: int | None = None,
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
            if build_configuration_name:
                build_config, _ = PreprodBuildConfiguration.objects.get_or_create(
                    project=project,
                    name=build_configuration_name,
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
) -> None:
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
    assemble_result: AssembleResult, project: Project, artifact_id: int | None, org_id: int
) -> None:
    if artifact_id is None:
        logger.error(
            "PreprodArtifact artifact_id is None in size analysis assembly",
            extra={"project_id": project.id, "organization_id": org_id},
        )
        return

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

    size_metrics_updated: list[PreprodArtifactSizeMetrics] = []
    # Track whether the metrics transaction completed successfully. Once metrics are
    # committed as COMPLETED, they should NOT be changed to FAILED even if subsequent
    # operations fail - the analysis data is valid.
    metrics_committed_successfully = False
    try:
        size_analysis_results = SizeAnalysisResults.parse_raw(
            assemble_result.bundle_temp_file.read()
        )
        was_created = False

        # Build list inside transaction, only assign to size_metrics_updated after
        # transaction commits. If the transaction rolls back, we don't want stale
        # references to objects that don't exist in the database.
        metrics_in_transaction: list[PreprodArtifactSizeMetrics] = []
        with transaction.atomic(router.db_for_write(PreprodArtifactSizeMetrics)):
            app_components = size_analysis_results.app_components or []

            if not app_components:
                # No components in results - fall back to top-level sizes for backwards compatibility
                # Don't include identifier in lookup to match old behavior and find any existing
                # MAIN_ARTIFACT regardless of identifier value
                size_metrics, created = PreprodArtifactSizeMetrics.objects.update_or_create(
                    preprod_artifact=preprod_artifact,
                    metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
                    defaults={
                        "identifier": None,
                        "analysis_file_id": assemble_result.bundle.id,
                        "min_install_size": None,
                        "max_install_size": size_analysis_results.install_size,
                        "min_download_size": None,
                        "max_download_size": size_analysis_results.download_size,
                        "processing_version": size_analysis_results.analysis_version,
                        "state": PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
                    },
                )
                was_created = created
                metrics_in_transaction.append(size_metrics)
            else:
                for app_component in app_components:
                    # MAIN_ARTIFACT uses NULL identifier for backwards compatibility
                    # Other types use identifier to differentiate multiple components
                    identifier = (
                        None
                        if app_component.component_type
                        == PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT
                        else app_component.app_id
                    )

                    size_metrics, created = PreprodArtifactSizeMetrics.objects.update_or_create(
                        preprod_artifact=preprod_artifact,
                        metrics_artifact_type=app_component.component_type,
                        identifier=identifier,
                        defaults={
                            "analysis_file_id": assemble_result.bundle.id,
                            "min_install_size": None,  # No min value at this time
                            "max_install_size": app_component.install_size,
                            "min_download_size": None,  # No min value at this time
                            "max_download_size": app_component.download_size,
                            "processing_version": size_analysis_results.analysis_version,
                            "state": PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
                        },
                    )
                    was_created = created or was_created
                    metrics_in_transaction.append(size_metrics)

            # Delete any stale metrics that are no longer in the current analysis results.
            # This prevents inconsistent analysis_file_id values when components are removed
            # between analysis runs, which would otherwise cause a 409 error on download.
            current_metric_ids = [m.id for m in metrics_in_transaction]
            PreprodArtifactSizeMetrics.objects.filter(preprod_artifact=preprod_artifact).exclude(
                id__in=current_metric_ids
            ).delete()

        # Transaction committed - metrics are now COMPLETED and valid. Any subsequent
        # failures should NOT invalidate these metrics.
        metrics_committed_successfully = True
        size_metrics_updated = metrics_in_transaction

        try:
            organization = preprod_artifact.project.organization
            if features.has("organizations:preprod-size-metrics-eap-write", organization):
                for size_metric in size_metrics_updated:
                    produce_preprod_size_metric_to_eap(
                        size_metric=size_metric,
                        organization_id=org_id,
                        project_id=project.id,
                    )
                logger.info(
                    "Successfully wrote preprod size metrics to EAP",
                    extra={
                        "preprod_artifact_id": preprod_artifact.id,
                        "size_metrics_ids": [m.id for m in size_metrics_updated],
                        "organization_id": org_id,
                        "project_id": project.id,
                    },
                )
        except Exception as eap_error:
            logger.exception(
                "Failed to write preprod size metrics to EAP",
                extra={
                    "preprod_artifact_id": preprod_artifact.id,
                    "size_metrics_ids": [m.id for m in size_metrics_updated],
                    "organization_id": org_id,
                    "project_id": project.id,
                    "error": str(eap_error),
                },
            )

        if size_analysis_results.analysis_duration is not None:
            with transaction.atomic(router.db_for_write(PreprodArtifact)):
                preprod_artifact.refresh_from_db()
                if preprod_artifact.extras is None:
                    preprod_artifact.extras = {}
                preprod_artifact.extras.update(
                    {"analysis_duration": size_analysis_results.analysis_duration}
                )
                preprod_artifact.save(update_fields=["extras"])

        # Trigger size analysis comparison if eligible
        logger.info(
            "Created or updated preprod artifact size metrics with analysis file",
            extra={
                "preprod_artifact_id": preprod_artifact.id,
                "size_metrics_ids": [size_metrics.id for size_metrics in size_metrics_updated],
                "analysis_file_id": assemble_result.bundle.id,
                "was_created": was_created,
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

        # Only mark metrics as FAILED if the metrics transaction didn't complete.
        # If metrics were successfully committed as COMPLETED, they contain valid
        # analysis data and should not be overwritten due to subsequent failures
        # (like extras update).
        if not metrics_committed_successfully:
            with transaction.atomic(router.db_for_write(PreprodArtifactSizeMetrics)):
                try:
                    # Mark the PENDING MAIN_ARTIFACT as FAILED to avoid leaving it stuck.
                    # Note: We always update MAIN_ARTIFACT here because that's what gets
                    # created initially in PENDING state when the artifact is uploaded.
                    PreprodArtifactSizeMetrics.objects.update_or_create(
                        preprod_artifact=preprod_artifact,
                        metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
                        defaults={
                            "identifier": None,
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
    finally:
        # Ensure the temp file is closed to avoid resource leaks
        try:
            assemble_result.bundle_temp_file.close()
        except Exception:
            pass

        time_now = timezone.now()
        e2e_size_analysis_duration = time_now - preprod_artifact.date_added
        artifact_type_name = "unknown"
        if preprod_artifact.artifact_type is not None:
            try:
                artifact_type_name = PreprodArtifact.ArtifactType(
                    preprod_artifact.artifact_type
                ).name.lower()
            except (ValueError, AttributeError):
                artifact_type_name = "unknown"

        # TODO: Remove project_id_value once this metric's volume get too big to avoid high cardinality cost issues
        metrics.distribution(
            "preprod.size_analysis.results_e2e",
            e2e_size_analysis_duration.total_seconds(),
            sample_rate=1.0,
            tags={
                "project_id_value": project.id,
                "organization_id_value": org_id,
                "artifact_type": artifact_type_name,
            },
        )

        # Always trigger status check update (success or failure)
        create_preprod_status_check_task.apply_async(
            kwargs={
                "preprod_artifact_id": artifact_id,
            }
        )

    # Ideally we want to report an outcome at most once per
    # preprod_artifact. This isn't yet robust to:
    # - multiple calls to assemble_file racing
    # - multiple reprocessed builds
    track_outcome(
        org_id=project.organization_id,
        project_id=project.id,
        outcome=Outcome.ACCEPTED,
        reason=None,
        quantity=1,
        category=DataCategory.SIZE_ANALYSIS,
        # If None this defaults to the current time. This seems
        # better than the time of the upload (which could have
        # been long before the analysis runs).
        timestamp=None,
        # We have neither of the below since size analysis is
        # not triggered by an event or reported via a DSN.
        # The id of the event.
        event_id=None,
        # The id of the DSN.
        key_id=None,
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
    namespace=preprod_tasks,
    processing_deadline_duration=30,
    silo_mode=SiloMode.REGION,
)
def assemble_preprod_artifact_size_analysis(
    org_id: int,
    project_id: int,
    checksum: str,
    chunks: Any,
    artifact_id: int | None = None,
    **kwargs: Any,
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
    assemble_result: AssembleResult, project: Project, artifact_id: int, org_id: int
) -> None:
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

    try:
        organization = preprod_artifact.project.organization
        if features.has("organizations:preprod-build-distribution-eap-write", organization):
            produce_preprod_build_distribution_to_eap(
                artifact=preprod_artifact,
                organization_id=org_id,
                project_id=project.id,
            )
            logger.info(
                "Successfully wrote preprod build distribution to EAP",
                extra={
                    "preprod_artifact_id": preprod_artifact.id,
                    "organization_id": org_id,
                    "project_id": project.id,
                },
            )
    except Exception:
        logger.exception(
            "Failed to write preprod build distribution to EAP",
            extra={
                "preprod_artifact_id": preprod_artifact.id,
                "organization_id": org_id,
                "project_id": project.id,
            },
        )

    # Ideally we want to report an outcome at most once per
    # preprod_artifact. This isn't yet robust to:
    # - multiple calls to assemble_file racing
    # - multiple reprocessed builds
    track_outcome(
        org_id=project.organization_id,
        project_id=project.id,
        outcome=Outcome.ACCEPTED,
        reason=None,
        quantity=1,
        category=DataCategory.INSTALLABLE_BUILD,
        # If None this defaults to the current time. This seems
        # better than the time of the upload (which could have
        # been long before the analysis runs).
        timestamp=None,
        # We have neither of the below since size analysis is
        # not triggered by an event or reported via a DSN.
        # The id of the event.
        event_id=None,
        # The id of the DSN.
        key_id=None,
    )


@instrumented_task(
    name="sentry.preprod.tasks.assemble_preprod_artifact_installable_app",
    namespace=preprod_tasks,
    processing_deadline_duration=30,
    silo_mode=SiloMode.REGION,
)
def assemble_preprod_artifact_installable_app(
    org_id: int, project_id: int, checksum: str, chunks: Any, artifact_id: int, **kwargs: Any
) -> None:
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
def detect_expired_preprod_artifacts() -> None:
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
            sentry_sdk.capture_message(
                "PreprodArtifact expired",
                level="error",
                extras={
                    "artifact_id": artifact_id,
                },
            )
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
