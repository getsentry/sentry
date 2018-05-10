from __future__ import absolute_import

from sentry.tasks.base import instrumented_task, retry

from sentry.models import ExternalIssue, GroupLink, Integration


@instrumented_task(
    name='sentry.tasks.integrations.post_comment',
    queue='integrations',
    default_retry_delay=60 * 5,
    max_retries=5
)
# TODO(jess): Add retry exclusions once ApiClients have better error handling
@retry()
def post_comment(project_id, group_id, data, **kwargs):
    # sync Sentry comments to external issues
    external_issues = list(
        ExternalIssue.objects.filter(
            id__in=GroupLink.objects.filter(
                project_id=project_id,
                group_id=group_id,
                linked_type=GroupLink.LinkedType.issue,
            ).values_list('linked_id', flat=True)
        )
    )

    if external_issues:
        integrations = {
            i.id: i for i in Integration.objects.filter(
                id__in=[external_issue.integration_id for external_issue in external_issues]
            )
        }

        for external_issue in external_issues:
            integration = integrations[external_issue.integration_id]
            integration.get_installation().create_comment(external_issue.key, data['text'])
