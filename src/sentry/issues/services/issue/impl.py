# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.


from datetime import datetime

from sentry.integrations.models.external_issue import ExternalIssue
from sentry.issues.services.issue.model import RpcExternalIssueGroupMetadata, RpcGroupShareMetadata
from sentry.issues.services.issue.service import IssueService
from sentry.models.group import Group
from sentry.models.grouplink import GroupLink
from sentry.models.organization import Organization


class DatabaseBackedIssueService(IssueService):
    def get_external_issue_groups(
        self, *, region_name: str, external_issue_key: str, integration_id: int
    ) -> list[RpcExternalIssueGroupMetadata] | None:
        from sentry.integrations.services.integration import integration_service

        try:
            external_issue = ExternalIssue.objects.get(
                integration_id=integration_id, key=external_issue_key
            )
        except (
            ExternalIssue.DoesNotExist,
            # Multiple ExternalIssues are returned if organizations share one integration.
            # Since we cannot identify the organization from the request alone, for now, we just
            # avoid crashing on the MultipleObjectsReturned error.
            ExternalIssue.MultipleObjectsReturned,
        ):
            return None

        if (
            integration := integration_service.get_integration(integration_id=integration_id)
        ) is None:
            return None

        if (
            integration_service.get_organization_integration(
                organization_id=external_issue.organization_id,
                integration_id=integration_id,
            )
            is None
        ):
            return None

        organization = Organization.objects.get(id=external_issue.organization_id)

        external_issue_subquery = ExternalIssue.objects.get_for_integration(
            integration, external_issue_key
        ).values_list("id", flat=True)

        group_link_subquery: dict[int, datetime] = dict(
            GroupLink.objects.filter(
                linked_id__in=external_issue_subquery, project__organization_id=organization.id
            )
            .order_by("datetime")
            .values_list("group_id", "datetime")
        )

        groups = Group.objects.filter(
            id__in=group_link_subquery.keys(),
        )

        return [
            RpcExternalIssueGroupMetadata(
                title_url=group.get_absolute_url(params={"referrer": "sentry-issues-glance"}),
                link_date=group_link_subquery[group.id],
            )
            for group in groups
        ]

    def get_shared_for_org(self, *, slug: str, share_id: str) -> RpcGroupShareMetadata | None:
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
    ) -> RpcGroupShareMetadata | None:
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
