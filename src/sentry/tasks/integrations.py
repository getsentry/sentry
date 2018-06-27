from __future__ import absolute_import

from sentry.models import ExternalIssue, Group, GroupLink, GroupStatus, Integration, User
from sentry.integrations.exceptions import IntegrationError
from sentry.tasks.base import instrumented_task, retry


@instrumented_task(
    name='sentry.tasks.integrations.post_comment',
    queue='integrations',
    default_retry_delay=60 * 5,
    max_retries=5
)
# TODO(jess): Add more retry exclusions once ApiClients have better error handling
@retry(exclude=(ExternalIssue.DoesNotExist, Integration.DoesNotExist))
def post_comment(external_issue_id, data, **kwargs):
    # sync Sentry comments to an external issue
    external_issue = ExternalIssue.objects.get(id=external_issue_id)
    integration = Integration.objects.get(id=external_issue.integration_id)
    integration.get_installation(
        organization_id=external_issue.organization_id).create_comment(
        external_issue.key, data['text'])


@instrumented_task(
    name='sentry.tasks.integrations.jira.sync_metadata',
    queue='integrations',
    default_retry_delay=20,
    max_retries=5
)
@retry(on=(IntegrationError,))
def sync_metadata(installation):
    installation.sync_metadata()


@instrumented_task(
    name='sentry.tasks.integrations.sync_assignee_outbound',
    queue='integrations',
    default_retry_delay=60 * 5,
    max_retries=5
)
@retry(exclude=(ExternalIssue.DoesNotExist, Integration.DoesNotExist, User.DoesNotExist))
def sync_assignee_outbound(external_issue_id, user_id, assign, **kwargs):
    # sync Sentry assignee to an external issue
    external_issue = ExternalIssue.objects.get(id=external_issue_id)
    integration = Integration.objects.get(id=external_issue.integration_id)
    # assume unassign if None
    if user_id is None:
        user = None
    else:
        user = User.objects.get(id=user_id)
    integration.get_installation().sync_assignee_outbound(external_issue, user, assign=assign)


@instrumented_task(
    name='sentry.tasks.integrations.sync_status_outbound',
    queue='integrations',
    default_retry_delay=60 * 5,
    max_retries=5
)
@retry(exclude=(ExternalIssue.DoesNotExist, Integration.DoesNotExist))
def sync_status_outbound(group_id, external_issue_id, **kwargs):
    try:
        group_status = Group.objects.filter(
            id=group_id,
            status__in=[GroupStatus.UNRESOLVED, GroupStatus.RESOLVED],
        ).values_list('status', flat=True)[0]
    except IndexError:
        return

    external_issue = ExternalIssue.objects.get(id=external_issue_id)
    integration = Integration.objects.get(id=external_issue.integration_id)
    integration.get_installation().sync_status_outbound(
        external_issue, group_status == GroupStatus.RESOLVED,
    )


@instrumented_task(
    name='sentry.tasks.integrations.kick_off_status_syncs',
    queue='integrations',
    default_retry_delay=60 * 5,
    max_retries=5
)
@retry()
def kick_off_status_syncs(project_id, group_id, **kwargs):
    # doing this in a task since this has to go in the event manager
    # and didn't want to introduce additional queries there
    external_issue_ids = GroupLink.objects.filter(
        project_id=project_id,
        group_id=group_id,
        linked_type=GroupLink.LinkedType.issue,
    ).values_list('linked_id', flat=True)

    for external_issue_id in external_issue_ids:
        sync_status_outbound.apply_async(
            kwargs={
                'group_id': group_id,
                'external_issue_id': external_issue_id,
            }
        )
