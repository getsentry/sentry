# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod
from typing import Iterable, List, Optional, cast

from sentry.services.hybrid_cloud.organization import (
    RpcOrganizationMember,
    RpcOrganizationMemberFlags,
    RpcOrganizationSummary,
    RpcUserInviteContext,
    RpcUserOrganizationContext,
)
from sentry.services.hybrid_cloud.region import (
    ByOrganizationId,
    ByOrganizationIdAttribute,
    ByOrganizationSlug,
    UnimplementedRegionResolution,
)
from sentry.services.hybrid_cloud.rpc import RpcService, regional_rpc_method
from sentry.silo import SiloMode


class OrganizationService(RpcService):
    key = "organization"
    local_mode = SiloMode.REGION

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.services.hybrid_cloud.organization.impl import DatabaseBackedOrganizationService

        return DatabaseBackedOrganizationService()

    @regional_rpc_method(resolve=ByOrganizationId("id"))
    @abstractmethod
    def get_organization_by_id(
        self, *, id: int, user_id: Optional[int] = None, slug: Optional[str] = None
    ) -> Optional[RpcUserOrganizationContext]:
        """
        Fetches the organization, team, and project data given by an organization id, regardless of its visibility
        status.  When user_id is provided, membership data related to that user from the organization
        is also given in the response.  See RpcUserOrganizationContext for more info.
        """
        pass

    @regional_rpc_method(resolve=ByOrganizationSlug())
    @abstractmethod
    def get_org_by_slug(
        self,
        *,
        slug: str,
        user_id: Optional[int] = None,
    ) -> Optional[RpcOrganizationSummary]:
        """
        Fetches the organization, by an organization slug. If user_id is passed, it will enforce visibility
        rules. This method is differentiated from get_organization_by_slug by not being cached and returning
        RpcOrganizationSummary instead of org contexts
        """
        pass

    # TODO: This should return RpcOrganizationSummary objects, since we cannot realistically span out requests and
    #  capture full org objects / teams / permissions.  But we can gather basic summary data from the control silo.
    @regional_rpc_method(resolve=UnimplementedRegionResolution())
    @abstractmethod
    def get_organizations(
        self,
        *,
        user_id: Optional[int],
        scope: Optional[str],
        only_visible: bool,
        organization_ids: Optional[List[int]] = None,
    ) -> List[RpcOrganizationSummary]:
        """
        When user_id is set, returns all organizations associated with that user id given
        a scope and visibility requirement.  When user_id is not set, but organization_ids is, provides the
        set of organizations matching those ids, ignore scope and user_id.

        When only_visible set, the organization object is only returned if it's status is Visible, otherwise any
        organization will be returned.

        Because this endpoint fetches not from region silos, but the control silo organization membership table,
        only a subset of all organization metadata is available.  Spanning out and querying multiple organizations
        for their full metadata is greatly discouraged for performance reasons.
        """
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def check_membership_by_email(
        self, *, organization_id: int, email: str
    ) -> Optional[RpcOrganizationMember]:
        """
        Used to look up an organization membership by an email
        """
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def check_membership_by_id(
        self, *, organization_id: int, user_id: int
    ) -> Optional[RpcOrganizationMember]:
        """
        Used to look up an organization membership by a user id
        """
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def get_invite_by_id(
        self,
        *,
        organization_id: int,
        organization_member_id: Optional[int] = None,
        user_id: Optional[int] = None,
        email: Optional[str] = None,
    ) -> Optional[RpcUserInviteContext]:
        pass

    @regional_rpc_method(resolve=ByOrganizationSlug())
    @abstractmethod
    def get_invite_by_slug(
        self,
        *,
        slug: str,
        organization_member_id: Optional[int] = None,
        user_id: Optional[int] = None,
        email: Optional[str] = None,
    ) -> Optional[RpcUserInviteContext]:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def delete_organization_member(
        self, *, organization_id: int, organization_member_id: int
    ) -> bool:
        """
        Delete an organization member by its id.
        """
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def set_user_for_organization_member(
        self,
        *,
        organization_member_id: int,
        organization_id: int,
        user_id: int,
    ) -> Optional[RpcOrganizationMember]:
        """
        Set the user id for an organization member.
        """
        pass

    @regional_rpc_method(resolve=ByOrganizationSlug())
    @abstractmethod
    def check_organization_by_slug(self, *, slug: str, only_visible: bool) -> Optional[int]:
        """
        If exists and matches the only_visible requirement, returns an organization's id by the slug.
        """
        pass

    def get_organization_by_slug(
        self, *, user_id: Optional[int], slug: str, only_visible: bool
    ) -> Optional[RpcUserOrganizationContext]:
        """
        Defers to check_organization_by_slug -> get_organization_by_id
        """
        org_id = self.check_organization_by_slug(slug=slug, only_visible=only_visible)
        if org_id is None:
            return None

        return self.get_organization_by_id(id=org_id, user_id=user_id)

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def add_organization_member(
        self,
        *,
        organization_id: int,
        default_org_role: str,
        user_id: Optional[int] = None,
        email: Optional[str] = None,
        flags: Optional[RpcOrganizationMemberFlags] = None,
        role: Optional[str] = None,
        inviter_id: Optional[int] = None,
        invite_status: Optional[int] = None,
    ) -> RpcOrganizationMember:
        pass

    @regional_rpc_method(resolve=ByOrganizationIdAttribute("organization_member"))
    @abstractmethod
    def add_team_member(self, *, team_id: int, organization_member: RpcOrganizationMember) -> None:
        pass

    @regional_rpc_method(resolve=UnimplementedRegionResolution())
    @abstractmethod
    def get_team_members(self, *, team_id: int) -> Iterable[RpcOrganizationMember]:
        pass

    @regional_rpc_method(resolve=ByOrganizationIdAttribute("organization_member"))
    @abstractmethod
    def update_membership_flags(self, *, organization_member: RpcOrganizationMember) -> None:
        pass

    @regional_rpc_method(resolve=ByOrganizationIdAttribute("organization_member"))
    @abstractmethod
    def get_all_org_roles(
        self,
        *,
        organization_member: Optional[RpcOrganizationMember] = None,
        member_id: Optional[int] = None,
    ) -> List[str]:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def get_top_dog_team_member_ids(self, *, organization_id: int) -> List[int]:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def remove_user(self, *, organization_id: int, user_id: int) -> RpcOrganizationMember:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def reset_idp_flags(self, *, organization_id: int) -> None:
        pass


organization_service = cast(OrganizationService, OrganizationService.create_delegation())
