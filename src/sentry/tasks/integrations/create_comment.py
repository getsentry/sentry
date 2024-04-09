from sentry import analytics
from sentry.models.activity import Activity
from sentry.models.integrations.external_issue import ExternalIssue
from sentry.services.hybrid_cloud.util import region_silo_function
from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.tasks.integrations import should_comment_sync
from sentry.types.activity import ActivityType


@region_silo_function
@instrumented_task(
    name="sentry.tasks.integrations.create_comment",
    queue="integrations",
    default_retry_delay=60 * 5,
    max_retries=5,
    silo_mode=SiloMode.REGION,
)
def create_comment(external_issue_id: int, user_id: int, group_note_id: int) -> None:
    try:
        external_issue = ExternalIssue.objects.get(id=external_issue_id)
    except ExternalIssue.DoesNotExist:
        return

    installation = external_issue.get_installation()

    if not should_comment_sync(installation, external_issue):
        return

    try:
        note = Activity.objects.get(type=ActivityType.NOTE.value, id=group_note_id)
    except Activity.DoesNotExist:
        return

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
