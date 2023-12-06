from __future__ import annotations

from typing import Any, Iterable

from sentry import features
from sentry.models.integrations.integration import Integration
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.services.hybrid_cloud.integration import RpcIntegration
from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task, load_model_from_db, retry


@instrumented_task(
    name="sentry.tasks.update_code_owners_schema",
    queue="code_owners",
    default_retry_delay=5,
    max_retries=5,
    silo_mode=SiloMode.REGION,
)
@retry
def update_code_owners_schema(
    organization: Organization | int,
    integration: Integration | RpcIntegration | int | None = None,
    projects: Iterable[Project | int] | None = None,
    **kwargs: Any,
) -> None:
    from sentry.models.integrations.repository_project_path_config import (
        RepositoryProjectPathConfig,
    )
    from sentry.models.projectcodeowners import ProjectCodeOwners

    organization = load_model_from_db(Organization, organization)

    if not features.has("organizations:integrations-codeowners", organization):
        return
    try:
        code_owners = []

        if projects:
            projects = [load_model_from_db(Project, project) for project in projects]
            code_owners = ProjectCodeOwners.objects.filter(project__in=projects)

        integration_id = _unpack_integration_id(integration)
        if integration_id is not None:
            code_mapping_ids = RepositoryProjectPathConfig.objects.filter(
                organization_id=organization.id,
                integration_id=integration_id,
            ).values_list("id", flat=True)

            code_owners = ProjectCodeOwners.objects.filter(
                repository_project_path_config__in=code_mapping_ids
            )

        for code_owner in code_owners:
            code_owner.update_schema(organization=organization)

    # TODO(nisanthan): May need to add logging  for the cases where we might want to have more information if something fails
    except (RepositoryProjectPathConfig.DoesNotExist, ProjectCodeOwners.DoesNotExist):
        return


def _unpack_integration_id(integration: Integration | RpcIntegration | int | None) -> int | None:
    if isinstance(integration, (Integration, RpcIntegration)):
        return integration.id
    return integration
