from sentry.integrations.models.external_issue import ExternalIssue
from sentry.issues.services.issue.model import RpcLinkedIssueSummary
from sentry.models.grouplink import GroupLink


def serialize_linked_issue_summary(external_issue: ExternalIssue) -> RpcLinkedIssueSummary:
    group_link = GroupLink.objects.get(
        linked_id=external_issue.id,
        linked_type=GroupLink.LinkedType.issue,
        relationship=GroupLink.Relationship.references,
    )

    group_url = group_link.group.get_absolute_url()

    return RpcLinkedIssueSummary(
        issue_link=group_url,
        date_added=external_issue.date_added,
    )
