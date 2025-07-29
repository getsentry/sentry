from __future__ import annotations

from sentry.hybridcloud.rpc import RpcModel
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.models.grouplink import GroupLink


class RpcGroupShareMetadata(RpcModel):
    title: str
    message: str


class RpcLinkedIssueSummary(RpcModel):
    title: str
    issue_link: str

    @classmethod
    def from_external_issue(cls, external_issue: ExternalIssue) -> RpcLinkedIssueSummary:
        group_link = GroupLink.objects.get(
            linked_id=external_issue.id,
            linked_type=GroupLink.LinkedType.issue,
            relationship=GroupLink.Relationship.references,
        )

        group_url = group_link.group.get_absolute_url()

        return RpcLinkedIssueSummary(
            title=external_issue.title or "",
            issue_link=group_url,
        )
