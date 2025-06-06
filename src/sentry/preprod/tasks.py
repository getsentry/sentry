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
