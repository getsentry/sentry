from django.utils.translation import ugettext as _

from sentry.models.commit import Commit
from sentry.tasks.base import instrumented_task
from sentry.utils.http import absolute_uri


def get_codeowners_auto_sync_failure_email_builder_args(project):
    return {
        "subject": _("Unable to Complete CODEOWNERS Auto-Sync"),
        "type": "project.codeowners-auto-sync-failure-email",
        "context": {
            "project_name": project.name,
            "url": absolute_uri(
                f"/settings/{project.organization.slug}/projects/{project.slug}/ownership/"
            ),
        },
        "template": "sentry/emails/codeowners-auto-sync-failure.txt",
        "html_template": "sentry/emails/codeowners-auto-sync-failure.html",
    }


def send_codeowners_auto_sync_failure_email(code_mapping):
    from sentry.utils.email import MessageBuilder

    owners = code_mapping.organization_integration.organization.get_owners()
    msg = MessageBuilder(
        **get_codeowners_auto_sync_failure_email_builder_args(code_mapping.project)
    )
    return msg.send_async([o.email for o in owners])


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
        ProjectOwnership,
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
            project_ownership = ProjectOwnership.objects.get(project_id=code_mapping.project_id)
        except ProjectOwnership.DoesNotExist:
            project_ownership = None

        if not project_ownership or not project_ownership.codeowners_auto_sync:
            return

        try:
            codeowner_contents = get_codeowner_contents(code_mapping)
        except Exception:
            codeowner_contents = None

        if not codeowner_contents:
            return send_codeowners_auto_sync_failure_email(code_mapping)

        codeowners = ProjectCodeOwners.objects.get(repository_project_path_config=code_mapping)

        codeowners.update_schema(codeowner_contents["raw"])

        # TODO(Nisanthan): Record analytics on auto-sync success
