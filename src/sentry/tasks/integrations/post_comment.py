from sentry import analytics, features
from sentry.models import ExternalIssue, Integration, Organization
from sentry.tasks.base import instrumented_task, retry


@instrumented_task(
    name="sentry.tasks.integrations.post_comment",
    queue="integrations",
    default_retry_delay=60 * 5,
    max_retries=5,
)
# TODO(lb): Replaced by create_comment method. Remove once all preexisting jobs have executed.
# no longer in use
# TODO(jess): Add more retry exclusions once ApiClients have better error handling
@retry(exclude=(ExternalIssue.DoesNotExist, Integration.DoesNotExist))
def post_comment(external_issue_id, data, user_id, **kwargs):
    # sync Sentry comments to an external issue
    external_issue = ExternalIssue.objects.get(id=external_issue_id)

    organization = Organization.objects.get(id=external_issue.organization_id)
    has_issue_sync = features.has("organizations:integrations-issue-sync", organization)
    if not has_issue_sync:
        return

    integration = Integration.objects.get(id=external_issue.integration_id)
    installation = integration.get_installation(organization_id=external_issue.organization_id)
    if installation.should_sync("comment"):
        installation.create_comment(external_issue.key, user_id, data["text"])
        analytics.record(
            "integration.issue.comments.synced",
            provider=integration.provider,
            id=integration.id,
            organization_id=external_issue.organization_id,
            user_id=user_id,
        )
