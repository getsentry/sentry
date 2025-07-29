# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.


from abc import abstractmethod

from sentry.hybridcloud.rpc.resolvers import ByOrganizationId, ByOrganizationSlug, ByRegionName
from sentry.hybridcloud.rpc.service import RpcService, regional_rpc_method
from sentry.issues.services.issue.model import RpcGroupShareMetadata, RpcLinkedIssueSummary
from sentry.silo.base import SiloMode


class IssueService(RpcService):
    """
    Avoid the temptation to expand this service.

    We want as little access to issues and events in control as possible.

    Unfortunately we have a handful of workflows that require
    access to issues from control:

    - The issue public share link view requires issue data to render the initial HTML so that open-graph
      data can be included
    - Replying to issue workflow notifications by email sends webhooks to control via mailgun.
    """

    key = "issue"
    local_mode = SiloMode.REGION

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.issues.services.issue.impl import DatabaseBackedIssueService

        return DatabaseBackedIssueService()

    @regional_rpc_method(resolve=ByOrganizationSlug(), return_none_if_mapping_not_found=True)
    @abstractmethod
    def get_shared_for_org(self, *, slug: str, share_id: str) -> RpcGroupShareMetadata | None:
        pass

    @regional_rpc_method(resolve=ByRegionName(), return_none_if_mapping_not_found=True)
    @abstractmethod
    def get_shared_for_region(
        self, *, region_name: str, share_id: str
    ) -> RpcGroupShareMetadata | None:
        pass

    @regional_rpc_method(resolve=ByOrganizationId(), return_none_if_mapping_not_found=True)
    @abstractmethod
    def upsert_issue_email_reply(
        self, *, organization_id: int, group_id: int, from_email: str, text: str
    ) -> None:
        pass

    @regional_rpc_method(resolve=ByRegionName(), return_none_if_mapping_not_found=True)
    @abstractmethod
    def get_linked_issues(
        self,
        *,
        region_name: str,
        integration_id: int,
        organization_ids: list[int],
        external_issue_key: str,
    ) -> list[RpcLinkedIssueSummary]:
        """
        Returns a list of linked issue summaries for a given integration ID +
        org ID combination.

        This is intended to be used for control to fan out to individual regions
        in order to surface linked issue data related to a given set of
        integration installations.

        `organization_ids` may be a little superfluous here, but allows us to
        filter, if necessary, and validate that the issue data we're surfacing
        _does_ belong to the integration installation.
        """
        pass


issue_service = IssueService.create_delegation()
