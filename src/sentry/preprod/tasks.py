from __future__ import annotations

import datetime
import logging
import uuid

from django.db import router, transaction

from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.silo.base import SiloMode
from sentry.tasks.assemble import AssembleTask, ChunkFileState, assemble_file, set_assemble_status
from sentry.tasks.base import instrumented_task
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.namespaces import attachments_tasks
from sentry.utils.sdk import bind_organization_context

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.preprod.tasks.assemble_preprod_artifact",
    queue="assemble",
    silo_mode=SiloMode.REGION,
    taskworker_config=TaskworkerConfig(
        namespace=attachments_tasks,
        processing_deadline_duration=30,
    ),
)
def assemble_preprod_artifact(
    org_id,
    project_id,
    checksum,
    chunks,
    git_sha=None,
    build_configuration=None,
    **kwargs,
) -> None:
    """
    Creates a preprod artifact from uploaded chunks.
    """
    from sentry.preprod.models import PreprodArtifact, PreprodBuildConfiguration

    logger.info(
        "Starting preprod artifact assembly",
        extra={
            "timestamp": datetime.datetime.now().isoformat(),
            "project_id": project_id,
            "organization_id": org_id,
        },
    )

    try:
        organization = Organization.objects.get_from_cache(pk=org_id)
        project = Project.objects.get(id=project_id, organization=organization)
        bind_organization_context(organization)

        set_assemble_status(
            AssembleTask.PREPROD_ARTIFACT, project_id, checksum, ChunkFileState.ASSEMBLING
        )

        assemble_result = assemble_file(
            task=AssembleTask.PREPROD_ARTIFACT,
            org_or_project=project,
            name=f"preprod-artifact-{uuid.uuid4().hex}",
            checksum=checksum,
            chunks=chunks,
            file_type="preprod.artifact",
        )

        if assemble_result is None:
            return

        with transaction.atomic(router.db_for_write(PreprodArtifact)):
            build_config = None
            if build_configuration:
                build_config, _ = PreprodBuildConfiguration.objects.get_or_create(
                    project=project,
                    name=build_configuration,
                )

            # Create PreprodArtifact record
            preprod_artifact = PreprodArtifact.objects.create(
                project=project,
                file_id=assemble_result.bundle.id,
                build_configuration=build_config,
                state=PreprodArtifact.ArtifactState.UPLOADED,
            )

        logger.info(
            "Created preprod artifact",
            extra={
                "preprod_artifact_id": preprod_artifact.id,
                "project_id": project_id,
                "organization_id": org_id,
            },
        )

        logger.info(
            "Finished preprod artifact assembly",
            extra={
                "timestamp": datetime.datetime.now().isoformat(),
                "project_id": project_id,
                "organization_id": org_id,
            },
        )

        # where next set of changes will happen
        # TODO: Trigger artifact processing (size analysis, etc.)
        # This is where you'd add logic to:
        # 1. create_or_update a new row in the Commit table as well (once base_sha is added as a column to it)
        # 2. Detect artifact type (iOS/Android/etc.)
        # 3. Queue processing tasks
        # 4. Update state to PROCESSED when done (also update the date_built value to reflect when the artifact was built, among other fields)

    except Exception as e:
        logger.exception(
            "Failed to assemble preprod artifact",
            extra={
                "project_id": project_id,
                "organization_id": org_id,
            },
        )
        set_assemble_status(
            AssembleTask.PREPROD_ARTIFACT,
            project_id,
            checksum,
            ChunkFileState.ERROR,
            detail=str(e),
        )
    else:
        set_assemble_status(AssembleTask.PREPROD_ARTIFACT, project_id, checksum, ChunkFileState.OK)


@instrumented_task(
    name="sentry.preprod.tasks.assemble_preprod_artifact_size_analysis",
    queue="assemble",
    silo_mode=SiloMode.REGION,
    taskworker_config=TaskworkerConfig(
        namespace=attachments_tasks,
        processing_deadline_duration=30,
    ),
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
    from sentry.preprod.models import PreprodArtifact, PreprodArtifactSizeMetrics

    logger.info(
        "Starting preprod artifact size analysis assembly",
        extra={
            "timestamp": datetime.datetime.now().isoformat(),
            "project_id": project_id,
            "organization_id": org_id,
        },
    )

    try:
        organization = Organization.objects.get_from_cache(pk=org_id)
        project = Project.objects.get(id=project_id, organization=organization)
        bind_organization_context(organization)

        set_assemble_status(
            AssembleTask.PREPROD_ARTIFACT_SIZE_ANALYSIS,
            project_id,
            checksum,
            ChunkFileState.ASSEMBLING,
        )

        assemble_result = assemble_file(
            task=AssembleTask.PREPROD_ARTIFACT_SIZE_ANALYSIS,
            org_or_project=project,
            name=f"preprod-size-analysis-{uuid.uuid4().hex}",
            checksum=checksum,
            chunks=chunks,
            file_type="preprod.size_analysis",
        )

        if assemble_result is None:
            return

        with transaction.atomic(router.db_for_write(PreprodArtifactSizeMetrics)):
            # Create or update PreprodArtifactSizeMetrics with size analysis file
            try:
                preprod_artifact = PreprodArtifact.objects.get(
                    project=project,
                    id=artifact_id,
                )

                # Upsert PreprodArtifactSizeMetrics record
                size_metrics, created = PreprodArtifactSizeMetrics.objects.update_or_create(
                    preprod_artifact=preprod_artifact,
                    defaults={
                        "analysis_file_id": assemble_result.bundle.id,
                        "metrics_artifact_type": PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,  # TODO: parse this from the treemap json
                        "state": PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
                    },
                )

                # Mark the artifact as processed
                preprod_artifact.state = PreprodArtifact.ArtifactState.PROCESSED
                preprod_artifact.save(update_fields=["state", "date_updated"])

                logger.info(
                    "Created or updated preprod artifact size metrics with analysis file",
                    extra={
                        "preprod_artifact_id": preprod_artifact.id,
                        "size_metrics_id": size_metrics.id,
                        "analysis_file_id": assemble_result.bundle.id,
                        "was_created": created,
                        "project_id": project_id,
                        "organization_id": org_id,
                    },
                )
            except PreprodArtifact.DoesNotExist:
                # Ideally this should never happen
                logger.exception(
                    "PreprodArtifact not found during size analysis assembly",
                    extra={
                        "artifact_id": artifact_id,
                        "project_id": project_id,
                        "organization_id": org_id,
                    },
                )
                # Clean up the assembled file since we can't associate it with an artifact
                try:
                    # Close the temporary file handle first
                    if (
                        hasattr(assemble_result, "bundle_temp_file")
                        and assemble_result.bundle_temp_file
                    ):
                        assemble_result.bundle_temp_file.close()
                    # Then delete the file object
                    assemble_result.bundle.delete()
                except Exception:
                    pass  # Ignore cleanup errors
                raise Exception(f"PreprodArtifact with id {artifact_id} does not exist")

        logger.info(
            "Finished preprod artifact size analysis assembly",
            extra={
                "timestamp": datetime.datetime.now().isoformat(),
                "project_id": project_id,
                "organization_id": org_id,
            },
        )

        # TODO: Trigger size related actions like notifications, etc.

    except Exception as e:
        logger.exception(
            "Failed to assemble preprod artifact size analysis",
            extra={
                "project_id": project_id,
                "organization_id": org_id,
            },
        )
        set_assemble_status(
            AssembleTask.PREPROD_ARTIFACT_SIZE_ANALYSIS,
            project_id,
            checksum,
            ChunkFileState.ERROR,
            detail=str(e),
        )
    else:
        set_assemble_status(
            AssembleTask.PREPROD_ARTIFACT_SIZE_ANALYSIS, project_id, checksum, ChunkFileState.OK
        )
