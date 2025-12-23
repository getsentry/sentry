from typing import Any

from rest_framework.exceptions import NotFound

from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.commit import Commit
from sentry.models.organization import Organization
from sentry.models.projectcodeowners import ProjectCodeOwners
from sentry.models.projectownership import ProjectOwnership
from sentry.notifications.notifications.codeowners_auto_sync import AutoSyncNotification
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry
from sentry.taskworker.namespaces import issues_tasks
from sentry.taskworker.retry import Retry


@instrumented_task(
    name="sentry.tasks.code_owners_auto_sync",
    namespace=issues_tasks,
    retry=Retry(times=3, delay=60),
    processing_deadline_duration=300,
    silo_mode=SiloMode.REGION,
)
@retry(on=(Commit.DoesNotExist,))
def code_owners_auto_sync(commit_id: int, **kwargs: Any) -> None:
    from django.db.models import BooleanField, Case, Exists, OuterRef, Subquery, When

    from sentry.integrations.api.endpoints.organization_code_mapping_codeowners import (
        get_codeowner_contents,
    )

    commit = Commit.objects.get(id=commit_id)

    code_mappings = (
        RepositoryProjectPathConfig.objects.filter(
            repository_id=commit.repository_id,
            project__organization_id=commit.organization_id,
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

    organization = Organization.objects.get(id=commit.organization_id)

    for code_mapping in code_mappings:
        try:
            codeowner_contents = get_codeowner_contents(code_mapping)
        except (NotImplementedError, NotFound):
            codeowner_contents = None

        # If we fail to fetch the codeowners file, the user can manually sync. We'll send them an email on failure.
        if not codeowner_contents:
            AutoSyncNotification(code_mapping.project).send()
            return

        codeowners: ProjectCodeOwners = ProjectCodeOwners.objects.get(
            repository_project_path_config=code_mapping
        )
        codeowners.update_schema(
            organization=organization,
            raw=codeowner_contents["raw"],
        )

        # TODO(Nisanthan): Record analytics on auto-sync success
