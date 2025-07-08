from __future__ import annotations

import logging
from collections.abc import Iterable
from typing import Any

from sentry import features
from sentry.models.organization import Organization, OrganizationStatus
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, load_model_from_db, retry
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.namespaces import issues_tasks
from sentry.taskworker.retry import Retry

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tasks.update_code_owners_schema",
    queue="code_owners",
    default_retry_delay=5,
    max_retries=5,
    silo_mode=SiloMode.REGION,
    taskworker_config=TaskworkerConfig(
        namespace=issues_tasks,
        retry=Retry(
            times=5,
            delay=5,
        ),
    ),
)
@retry
def update_code_owners_schema(
    organization: int,
    integration: int | None = None,
    projects: list[int] | None = None,
    **kwargs: Any,
) -> None:
    from sentry.integrations.models.repository_project_path_config import (
        RepositoryProjectPathConfig,
    )
    from sentry.models.projectcodeowners import ProjectCodeOwners

    # This task is enqueued when projects and teams are deleted. If the
    # organization itself has also been deleted we're all done here.
    try:
        org = load_model_from_db(Organization, organization)
    except Organization.DoesNotExist:
        logger.warning(
            "Skipping update_code_owners_schema: organization does not exist",
            extra={"organization_id": organization, "integration_id": integration},
        )
        return
    if org.status == OrganizationStatus.DELETION_IN_PROGRESS:
        logger.warning(
            "Skipping update_code_owners_schema: organization deletion in progress",
            extra={"organization_id": organization, "integration_id": integration},
        )
        return

    if not features.has("organizations:integrations-codeowners", org):
        return
    try:
        code_owners: Iterable[ProjectCodeOwners] = []
        if projects:
            code_owners = ProjectCodeOwners.objects.filter(project__in=projects)

        if integration is not None:
            code_mapping_ids = RepositoryProjectPathConfig.objects.filter(
                organization_id=org.id,
                integration_id=integration,
            ).values_list("id", flat=True)

            code_owners = ProjectCodeOwners.objects.filter(
                repository_project_path_config__in=code_mapping_ids
            )

        for code_owner in code_owners:
            code_owner.update_schema(organization=org)

    # TODO(nisanthan): May need to add logging  for the cases where we might want to have more information if something fails
    except (RepositoryProjectPathConfig.DoesNotExist, ProjectCodeOwners.DoesNotExist):
        return
