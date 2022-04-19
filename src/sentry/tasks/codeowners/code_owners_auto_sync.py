from rest_framework.exceptions import NotFound

from sentry.models import Commit, ProjectCodeOwners, ProjectOwnership, RepositoryProjectPathConfig
from sentry.notifications.notifications.codeowners_auto_sync import AutoSyncNotification
from sentry.tasks.base import instrumented_task, retry


@instrumented_task(
    name="sentry.tasks.code_owners_auto_sync",
    queue="code_owners",
    default_retry_delay=60 * 5,
    max_retries=1,
)
@retry(on=(Commit.DoesNotExist,))
def code_owners_auto_sync(commit_id: int, **kwargs):
    from django.db.models import BooleanField, Case, Exists, OuterRef, Subquery, When

    from sentry.api.endpoints.organization_code_mapping_codeowners import get_codeowner_contents

    commit = Commit.objects.get(id=commit_id)

    code_mappings = (
        RepositoryProjectPathConfig.objects.filter(
            repository_id=commit.repository_id,
            organization_integration__organization_id=commit.organization_id,
        )
        .annotate(
            # By default, we don't create a ProjectOwnership record (bc we treat as a negative cache) when we create ProjectCodeOwners records.
            ownership_exists=Exists(
                ProjectOwnership.objects.filter(
                    project=OuterRef("project"),
                )
            )
        )
        .annotate(
            codeowners_auto_sync=Case(
                # The default setting for auto_sync is True even if the ProjectOwnership record doesn't exist.
                When(ownership_exists=False, then=True),
                When(
                    ownership_exists=True,
                    then=Subquery(
                        ProjectOwnership.objects.filter(project=OuterRef("project")).values_list(
                            "codeowners_auto_sync", flat=True
                        )[:1],
                    ),
                ),
                default=True,
                output_field=BooleanField(),
            )
        )
        .annotate(
            # We only want to autosync if ProjectCodeOwners records exist for the code mapping.
            has_codeowners=Exists(
                ProjectCodeOwners.objects.filter(repository_project_path_config=OuterRef("pk"))
            )
        )
        .filter(codeowners_auto_sync=True, has_codeowners=True)
    )

    for code_mapping in code_mappings:
        try:
            codeowner_contents = get_codeowner_contents(code_mapping)
        except (NotImplementedError, NotFound):
            codeowner_contents = None

        # If we fail to fetch the codeowners file, the user can manually sync. We'll send them an email on failure.
        if not codeowner_contents:
            return AutoSyncNotification(code_mapping.project).send()

        codeowners = ProjectCodeOwners.objects.get(repository_project_path_config=code_mapping)

        codeowners.update_schema(codeowner_contents["raw"])

        # TODO(Nisanthan): Record analytics on auto-sync success
