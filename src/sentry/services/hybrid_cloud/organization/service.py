# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.
import abc
from abc import abstractmethod
from typing import Any, Iterable, List, Mapping, Optional, Union, cast

from django.dispatch import Signal

from sentry.services.hybrid_cloud import OptionValue, silo_mode_delegation
from sentry.services.hybrid_cloud.organization.model import (
    RpcOrganization,
    RpcOrganizationFlagsUpdate,
    RpcOrganizationMember,
    RpcOrganizationMemberFlags,
    RpcOrganizationSignal,
    RpcOrganizationSummary,
    RpcRegionUser,
    RpcUserInviteContext,
    RpcUserOrganizationContext,
)
from sentry.services.hybrid_cloud.region import (
    ByOrganizationId,
    ByOrganizationIdAttribute,
    ByOrganizationSlug,
    ByRegionName,
    RequireSingleOrganization,
    UnimplementedRegionResolution,
)
from sentry.services.hybrid_cloud.rpc import RpcService, regional_rpc_method
from sentry.services.hybrid_cloud.user.model import RpcUser
from sentry.silo import SiloMode


class OrganizationService(RpcService):
    key = "organization"
    local_mode = SiloMode.REGION

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.services.hybrid_cloud.organization.impl import DatabaseBackedOrganizationService

        return DatabaseBackedOrganizationService()

    def get(self, id: int) -> Optional[RpcOrganization]:
        org_context = self.get_organization_by_id(id=id)
        return org_context.organization if org_context else None

    @regional_rpc_method(resolve=ByOrganizationId("id"))
    @abstractmethod
    def serialize_organization(
        self,
        *,
        id: int,
        as_user: Optional[RpcUser] = None,
    ) -> Optional[Any]:
        """
        Attempts to serialize a given organization.  Note that this can be None if the organization is already deleted
        in the corresponding region silo.
        """
        pass

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

    @regional_rpc_method(resolve=ByOrganizationSlug(), return_none_if_mapping_not_found=True)
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

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def update_flags(self, *, organization_id: int, flags: RpcOrganizationFlagsUpdate) -> None:
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

    @regional_rpc_method(resolve=ByOrganizationSlug(), return_none_if_mapping_not_found=True)
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

    @regional_rpc_method(resolve=ByOrganizationSlug(), return_none_if_mapping_not_found=True)
    @abstractmethod
    def check_organization_by_slug(self, *, slug: str, only_visible: bool) -> Optional[int]:
        """
        If exists and matches the only_visible requirement, returns an organization's id by the slug.
        """
        pass

    def get_organization_by_slug(
        self, *, slug: str, only_visible: bool, user_id: Optional[int] = None
    ) -> Optional[RpcUserOrganizationContext]:
        """
        Defers to check_organization_by_slug -> get_organization_by_id
        """
        from sentry.models import OrganizationStatus

        org_id = self.check_organization_by_slug(slug=slug, only_visible=only_visible)
        if org_id is None:
            return None

        org_context = self.get_organization_by_id(id=org_id, user_id=user_id)
        if (
            only_visible
            and org_context
            and org_context.organization.status != OrganizationStatus.ACTIVE
        ):
            return None
        return org_context

    @regional_rpc_method(resolve=RequireSingleOrganization())
    @abstractmethod
    def get_default_organization(self) -> RpcOrganization:
        pass

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

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def merge_users(self, *, organization_id: int, from_user_id: int, to_user_id: int) -> None:
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
    def update_default_role(self, *, organization_id: int, default_role: str) -> RpcOrganization:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def remove_user(self, *, organization_id: int, user_id: int) -> Optional[RpcOrganizationMember]:
        pass

    @regional_rpc_method(resolve=ByRegionName())
    @abstractmethod
    def update_region_user(self, *, user: RpcRegionUser, region_name: str) -> None:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def reset_idp_flags(self, *, organization_id: int) -> None:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def get_option(self, *, organization_id: int, key: str) -> OptionValue:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def update_option(self, *, organization_id: int, key: str, value: OptionValue) -> bool:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def delete_option(self, *, organization_id: int, key: str) -> None:
        pass

    @regional_rpc_method(resolve=ByOrganizationId())
    @abstractmethod
    def send_signal(
        self,
        *,
        signal: RpcOrganizationSignal,
        organization_id: int,
        args: Mapping[str, Optional[Union[int, str]]],
    ) -> None:
        pass

    def schedule_signal(
        self,
        signal: Signal,
        organization_id: int,
        args: Mapping[str, Optional[Union[int, str]]],
    ) -> None:
        _organization_signal_service.schedule_signal(
            signal=signal, organization_id=organization_id, args=args
        )


class OrganizationSignalService(abc.ABC):
    @abc.abstractmethod
    def schedule_signal(
        self,
        signal: Signal,
        organization_id: int,
        args: Mapping[str, Optional[Union[int, str]]],
    ) -> None:
        pass


def _signal_from_outbox() -> OrganizationSignalService:
    from sentry.services.hybrid_cloud.organization.impl import OutboxBackedOrganizationSignalService

    return OutboxBackedOrganizationSignalService()


def _signal_from_on_commit() -> OrganizationSignalService:
    from sentry.services.hybrid_cloud.organization.impl import (
        OnCommitBackedOrganizationSignalService,
    )

    return OnCommitBackedOrganizationSignalService()


_organization_signal_service: OrganizationSignalService = silo_mode_delegation(
    {
        SiloMode.REGION: _signal_from_on_commit,
        SiloMode.CONTROL: _signal_from_outbox,
        SiloMode.MONOLITH: _signal_from_on_commit,
    }
)

organization_service = cast(OrganizationService, OrganizationService.create_delegation())
