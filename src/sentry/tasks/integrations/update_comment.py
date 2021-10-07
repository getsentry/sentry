from sentry import analytics
from sentry.models import Activity, ExternalIssue, Integration
from sentry.tasks.base import instrumented_task, retry
from sentry.tasks.integrations import should_comment_sync
from sentry.types.activity import ActivityType


@instrumented_task(
    name="sentry.tasks.integrations.update_comment",
    queue="integrations",
    default_retry_delay=60 * 5,
    max_retries=5,
)
# TODO(jess): Add more retry exclusions once ApiClients have better error handling
@retry(exclude=(ExternalIssue.DoesNotExist, Integration.DoesNotExist))
def update_comment(external_issue_id: int, user_id: int, group_note_id: int) -> None:
    external_issue = ExternalIssue.objects.get(id=external_issue_id)
    installation = external_issue.get_installation()

    if not should_comment_sync(installation, external_issue):
        return

    try:
        note = Activity.objects.get(type=ActivityType.NOTE.value, id=group_note_id)
    except Activity.DoesNotExist:
        return

    installation.update_comment(external_issue.key, user_id, note)
    analytics.record(
        # TODO(lb): this should be changed and/or specified?
        "integration.issue.comments.synced",
        provider=installation.model.provider,
        id=installation.model.id,
        organization_id=external_issue.organization_id,
        user_id=user_id,
    )
