from rest_framework.exceptions import NotFound

from sentry.notifications.notifications.codeowners_auto_sync import AutoSyncNotification
from sentry.tasks.base import instrumented_task


@instrumented_task(
    name="sentry.tasks.code_owners_auto_sync",
    queue="code_owners",
    # If the task fails, the user can manually sync. We'll send them an email on failure.
    max_retries=0,
)
def code_owners_auto_sync(commit_id: int, **kwargs):
    from sentry.api.endpoints.organization_code_mapping_codeowners import get_codeowner_contents
    from sentry.models import (
        Commit,
        OrganizationIntegration,
        ProjectCodeOwners,
        ProjectOwnership,
        RepositoryProjectPathConfig,
    )

    commit = Commit.objects.get(id=commit_id)
    code_mappings = RepositoryProjectPathConfig.objects.filter(
        repository_id=commit.repository_id,
        organization_integration__in=OrganizationIntegration.objects.filter(
            organization_id=commit.organization_id
        ).values_list("id", flat=True),
    )
    for code_mapping in code_mappings:
        try:
            project_ownership = ProjectOwnership.objects.get(project_id=code_mapping.project_id)
        except ProjectOwnership.DoesNotExist:
            return

        if not project_ownership.codeowners_auto_sync:
            return

        try:
            codeowner_contents = get_codeowner_contents(code_mapping)
        except (NotImplementedError, NotFound):
            codeowner_contents = None

        if not codeowner_contents:
            return AutoSyncNotification(code_mapping).send()

        codeowners = ProjectCodeOwners.objects.get(repository_project_path_config=code_mapping)

        codeowners.update_schema(codeowner_contents["raw"])

        # TODO(Nisanthan): Record analytics on auto-sync success
