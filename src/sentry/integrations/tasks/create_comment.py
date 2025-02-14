from sentry import analytics
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.models.integration import Integration
from sentry.integrations.source_code_management.metrics import (
    SCMIntegrationInteractionEvent,
    SCMIntegrationInteractionType,
)
from sentry.integrations.tasks import should_comment_sync
from sentry.models.activity import Activity
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry
from sentry.types.activity import ActivityType


@instrumented_task(
    name="sentry.integrations.tasks.create_comment",
    queue="integrations",
    default_retry_delay=60 * 5,
    max_retries=5,
    silo_mode=SiloMode.REGION,
)
@retry(exclude=(Integration.DoesNotExist))
def create_comment(external_issue_id: int, user_id: int, group_note_id: int) -> None:
    try:
        external_issue = ExternalIssue.objects.get(id=external_issue_id)
    except ExternalIssue.DoesNotExist:
        return

    assert isinstance(external_issue, ExternalIssue)

    try:
        installation = external_issue.get_installation()
    except AssertionError:
        return

    if not should_comment_sync(installation, external_issue):
        return

    try:
        note = Activity.objects.get(type=ActivityType.NOTE.value, id=group_note_id)
    except Activity.DoesNotExist:
        return

    with SCMIntegrationInteractionEvent(
        interaction_type=SCMIntegrationInteractionType.SYNC_EXTERNAL_ISSUE_COMMENT_CREATE,
        organization=external_issue.organization,
        provider_key=installation.model.get_provider().name,
        org_integration=installation.org_integration,
    ).capture() as lifecycle:
        lifecycle.add_extras(
            {
                "external_issue_id": external_issue_id,
                "integration_id": external_issue.integration_id,
                "group_note_id": group_note_id,
                "user_id": user_id,
            }
        )

        comment = installation.create_comment(external_issue.key, user_id, note)
        note.data["external_id"] = installation.get_comment_id(comment)
        note.save()
        analytics.record(
            # TODO(lb): this should be changed and/or specified?
            "integration.issue.comments.synced",
            provider=installation.model.provider,
            id=installation.model.id,
            organization_id=external_issue.organization_id,
            user_id=user_id,
        )
