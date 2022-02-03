import logging

from sentry import features
from sentry.models.commit import Commit
from sentry.tasks.base import instrumented_task
from sentry.utils.email import MessageBuilder
from sentry.utils.http import absolute_uri

logger = logging.getLogger("sentry.tasks.code_owners")


def generate_failed_to_fetch_codeowner_contents_email(project):
    new_context = {
        "project_name": project.name,
        "url": absolute_uri(
            f"/settings/{project.organization.slug}/projects/{project.slug}/ownership/"
        ),
    }

    return MessageBuilder(
        subject="Unable to Complete CODEOWNERS Auto-Sync",
        context=new_context,
        template="sentry/emails/identity-invalid.txt",
        html_template="sentry/emails/identity-invalid.html",
    )


@instrumented_task(
    name="sentry.tasks.update_code_owners_schema",
    queue="code_owners",
    default_retry_delay=5,
    max_retries=5,
)
def update_code_owners_schema(organization, integration=None, projects=None, **kwargs):
    from sentry.models import ProjectCodeOwners, RepositoryProjectPathConfig

    if not features.has("organizations:integrations-codeowners", organization):
        return
    try:
        code_owners = []

        if projects:
            code_owners = ProjectCodeOwners.objects.filter(project__in=projects)

        if integration:
            code_mapping_ids = RepositoryProjectPathConfig.objects.filter(
                organization_integration__organization=organization,
                organization_integration__integration=integration,
            ).values_list("id", flat=True)

            code_owners = ProjectCodeOwners.objects.filter(
                repository_project_path_config__in=code_mapping_ids
            )

        for code_owner in code_owners:
            code_owner.update_schema()

    # TODO(nisanthan): May need to add logging  for the cases where we might want to have more information if something fails
    except (RepositoryProjectPathConfig.DoesNotExist, ProjectCodeOwners.DoesNotExist):
        return


@instrumented_task(
    name="sentry.tasks.code_owners_auto_sync",
    queue="code_owners",
    # If the task fails, the user can manually sync. We'll send them an email on failure.
    max_retries=0,
)
def code_owners_auto_sync(commit: Commit, **kwargs):
    from sentry.api.endpoints.organization_code_mapping_codeowners import get_codeowner_contents
    from sentry.models import (
        OrganizationIntegration,
        ProjectCodeOwners,
        RepositoryProjectPathConfig,
    )

    code_mappings = RepositoryProjectPathConfig.objects.filter(
        repository_id=commit.repository_id,
        organization_integration__in=OrganizationIntegration.objects.filter(
            organization_id=commit.organization_id
        ).values_list("id", flat=True),
    )

    for code_mapping in code_mappings:
        try:
            codeowner_contents = get_codeowner_contents(code_mapping)
        except Exception:
            # Notify owners that auto-sync failed to fetch contents.
            owners = code_mapping.organization_integration.organization.get_owners()
            msg = generate_failed_to_fetch_codeowner_contents_email(code_mapping.project)
            return msg.send_async([o.email for o in owners])

        if codeowner_contents:
            codeowners = ProjectCodeOwners.objects.get(repository_project_path_config=code_mapping)

            codeowners.raw = codeowner_contents
            codeowners.update_schema()

            # TODO(Nisanthan): Record analytics on auto-sync success
