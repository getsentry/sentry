# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.


from typing import Optional

from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.services.hybrid_cloud.issue.model import RpcGroupShareMetadata
from sentry.services.hybrid_cloud.issue.service import IssueService


class DatabaseBackedIssueService(IssueService):
    def get_shared_for_org(self, *, slug: str, share_id: str) -> Optional[RpcGroupShareMetadata]:
        try:
            organization = Organization.objects.get(slug=slug)
        except Organization.DoesNotExist:
            return None
        if organization.flags.disable_shared_issues:
            return None
        try:
            group = Group.objects.from_share_id(share_id)
        except Group.DoesNotExist:
            return None

        return RpcGroupShareMetadata(title=group.title, message=group.message)

    def get_shared_for_region(
        self, *, region_name: str, share_id: str
    ) -> Optional[RpcGroupShareMetadata]:
        try:
            group = Group.objects.from_share_id(share_id)
        except Group.DoesNotExist:
            return None
        if group.organization.flags.disable_shared_issues:
            return None

        return RpcGroupShareMetadata(title=group.title, message=group.message)

    def upsert_issue_email_reply(
        self, *, organization_id: int, group_id: int, from_email: str, text: str
    ) -> None:
        from sentry.tasks.email import process_inbound_email

        # Call the task synchronously so that the outbox retry works
        # correctly should this fail.
        process_inbound_email(from_email, group_id, text)
