from typing import int
from sentry import analytics
from sentry.integrations.analytics import IntegrationIssueCommentsSyncedEvent
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.models.integration import Integration
from sentry.integrations.project_management.metrics import (
    ProjectManagementActionType,
    ProjectManagementEvent,
)
from sentry.integrations.tasks import should_comment_sync
from sentry.models.activity import Activity
from sentry.shared_integrations.exceptions import IntegrationConfigurationError
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry
from sentry.taskworker.namespaces import integrations_tasks
from sentry.taskworker.retry import Retry
from sentry.types.activity import ActivityType


@instrumented_task(
    name="sentry.integrations.tasks.create_comment",
    namespace=integrations_tasks,
    retry=Retry(times=5, delay=60 * 5),
    silo_mode=SiloMode.REGION,
)
@retry(exclude=(Integration.DoesNotExist))
def create_comment(external_issue_id: int, user_id: int, group_note_id: int) -> None:
    try:
        external_issue = ExternalIssue.objects.get(id=external_issue_id)
    except ExternalIssue.DoesNotExist:
        return

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

    with ProjectManagementEvent(
        action_type=ProjectManagementActionType.SYNC_EXTERNAL_ISSUE_COMMENT_CREATE,
        integration=installation.model,
    ).capture() as lifecycle:
        lifecycle.add_extras(
            {
                "external_issue_id": external_issue_id,
                "integration_id": external_issue.integration_id,
                "group_note_id": group_note_id,
                "user_id": user_id,
            }
        )

        try:
            comment = installation.create_comment(external_issue.key, user_id, note)
            note.data["external_id"] = installation.get_comment_id(comment)
            note.save()
            analytics.record(
                IntegrationIssueCommentsSyncedEvent(
                    provider=installation.model.provider,
                    id=installation.model.id,
                    organization_id=external_issue.organization_id,
                )
            )
        except IntegrationConfigurationError as e:
            lifecycle.record_halt(halt_reason=e)
