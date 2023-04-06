from sentry import features
from sentry.models import Integration, Organization, Project
from sentry.tasks.base import instrumented_task, load_model_from_db


@instrumented_task(
    name="sentry.tasks.update_code_owners_schema",
    queue="code_owners",
    default_retry_delay=5,
    max_retries=5,
)
def update_code_owners_schema(organization, integration=None, projects=None, **kwargs):
    from sentry.models import ProjectCodeOwners, RepositoryProjectPathConfig

    organization = load_model_from_db(Organization, organization)

    if not features.has("organizations:integrations-codeowners", organization):
        return
    try:
        code_owners = []

        if projects:
            projects = [load_model_from_db(Project, project) for project in projects]
            code_owners = ProjectCodeOwners.objects.filter(project__in=projects)

        if integration:
            integration = load_model_from_db(Integration, integration, allow_cache=False)
            code_mapping_ids = RepositoryProjectPathConfig.find_all_by_org_and_integration(
                organization_id=organization.id,
                integration_id=integration.id,
            )

            code_owners = ProjectCodeOwners.objects.filter(
                repository_project_path_config__in=code_mapping_ids
            )

        for code_owner in code_owners:
            code_owner.update_schema(organization=organization)

    # TODO(nisanthan): May need to add logging  for the cases where we might want to have more information if something fails
    except (RepositoryProjectPathConfig.DoesNotExist, ProjectCodeOwners.DoesNotExist):
        return
