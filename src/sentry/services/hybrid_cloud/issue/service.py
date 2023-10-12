# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.


from abc import abstractmethod
from typing import Optional, cast

from sentry.services.hybrid_cloud.issue.model import RpcGroupShareMetadata
from sentry.services.hybrid_cloud.region import ByOrganizationSlug, ByRegionName
from sentry.services.hybrid_cloud.rpc import RpcService, regional_rpc_method
from sentry.silo.base import SiloMode


class IssueService(RpcService):
    """
    Avoid the temptation to expand this service.

    We want as little access to issues and events in control as possible.

    Unfortunately the issue public share link view requires it as
    we need issue data to render the initial HTML so that open-graph
    data can be included.
    """

    key = "issue"
    local_mode = SiloMode.REGION

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.services.hybrid_cloud.issue.impl import DatabaseBackedIssueService

        return DatabaseBackedIssueService()

    @regional_rpc_method(resolve=ByOrganizationSlug(), return_none_if_mapping_not_found=True)
    @abstractmethod
    def get_shared_for_org(self, *, slug: str, share_id: str) -> Optional[RpcGroupShareMetadata]:
        pass

    @regional_rpc_method(resolve=ByRegionName(), return_none_if_mapping_not_found=True)
    @abstractmethod
    def get_shared_for_region(
        self, *, region_name: str, share_id: str
    ) -> Optional[RpcGroupShareMetadata]:
        pass


issue_service = cast(IssueService, IssueService.create_delegation())
